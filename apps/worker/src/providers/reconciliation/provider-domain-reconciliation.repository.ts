import {
  domains,
  inventoryNodes,
  providerAccounts,
  providerConnections,
  providerResourceLinks,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@domainpulse/database';
import { and, eq, lte } from 'drizzle-orm';

import type {
  ActivateProviderResourceLinkInput,
  ProviderDomainReconciliationStore,
  ProviderDomainReconciliationTransaction,
  ProviderResourceLinkOutcome,
  ReconciledDomainRecord,
} from './provider-domain-reconciliation.types';
import { ProviderReconciliationError } from '../provider.errors';

function metadataFor(providerStatus: string): Record<string, unknown> {
  return { providerStatus };
}

function equalMetadata(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

class PostgresProviderDomainReconciliationTransaction
implements ProviderDomainReconciliationTransaction {
  constructor(
    private readonly transaction: DatabaseTransaction,
    private readonly workspaceId: string,
    private readonly connectionId: string,
  ) {}

  async resolveConnectionProviderAccountId(
    providerKey: string,
  ): Promise<string | undefined> {
    const [connection] = await this.transaction
      .select({ providerAccountId: providerConnections.providerAccountId })
      .from(providerConnections)
      .innerJoin(
        providerAccounts,
        and(
          eq(providerAccounts.workspaceId, providerConnections.workspaceId),
          eq(providerAccounts.id, providerConnections.providerAccountId),
        ),
      )
      .where(
        and(
          eq(providerConnections.workspaceId, this.workspaceId),
          eq(providerConnections.id, this.connectionId),
          eq(providerAccounts.workspaceId, this.workspaceId),
          eq(providerAccounts.providerKey, providerKey),
        ),
      )
      .limit(1);
    return connection?.providerAccountId;
  }

  async findOrCreateDomain(
    canonicalDomain: string,
    synchronizedAt: Date,
  ): Promise<ReconciledDomainRecord> {
    const existing = await this.findDomain(canonicalDomain);
    if (existing) return { ...existing, created: false };

    const [created] = await this.transaction
      .insert(domains)
      .values({
        createdAt: synchronizedAt,
        domainName: canonicalDomain,
        inventoryState: 'TRACKED',
        normalizedDomainName: canonicalDomain,
        provenance: 'PROVIDER_API',
        updatedAt: synchronizedAt,
        workspaceId: this.workspaceId,
      })
      .onConflictDoNothing({
        target: [domains.workspaceId, domains.normalizedDomainName],
      })
      .returning({
        dnsProviderAccountId: domains.dnsProviderAccountId,
        id: domains.id,
        provenance: domains.provenance,
      });
    if (created) return { ...created, created: true };

    const raced = await this.findDomain(canonicalDomain);
    if (!raced) {
      throw new ProviderReconciliationError('INTERNAL_INTEGRITY_ERROR');
    }
    return { ...raced, created: false };
  }

  async associateDnsProvider(
    domainId: string,
    providerAccountId: string,
    synchronizedAt: Date,
  ): Promise<boolean> {
    const updated = await this.transaction
      .update(domains)
      .set({ dnsProviderAccountId: providerAccountId, updatedAt: synchronizedAt })
      .where(
        and(
          eq(domains.workspaceId, this.workspaceId),
          eq(domains.id, domainId),
        ),
      )
      .returning({ id: domains.id });
    return updated.length > 0;
  }

  async resolveDomainNodeId(domainId: string): Promise<string | undefined> {
    const [node] = await this.transaction
      .select({ nodeId: inventoryNodes.nodeId })
      .from(inventoryNodes)
      .where(
        and(
          eq(inventoryNodes.workspaceId, this.workspaceId),
          eq(inventoryNodes.entityKind, 'DOMAIN'),
          eq(inventoryNodes.entityId, domainId),
        ),
      )
      .limit(1);
    return node?.nodeId;
  }

  async activateResourceLink(
    input: ActivateProviderResourceLinkInput,
  ): Promise<ProviderResourceLinkOutcome> {
    const [existing] = await this.transaction
      .select()
      .from(providerResourceLinks)
      .where(
        and(
          eq(providerResourceLinks.workspaceId, this.workspaceId),
          eq(providerResourceLinks.connectionId, this.connectionId),
          eq(providerResourceLinks.externalResourceType, input.externalResourceType),
          eq(providerResourceLinks.externalResourceId, input.externalResourceId),
        ),
      )
      .limit(1);
    const externalMetadata = metadataFor(input.providerStatus);
    if (existing && existing.lastSyncedAt > input.synchronizedAt) {
      return 'UNCHANGED';
    }

    if (!existing) {
      const inserted = await this.transaction
        .insert(providerResourceLinks)
        .values({
          connectionId: this.connectionId,
          createdAt: input.synchronizedAt,
          entityKind: 'DOMAIN',
          externalMetadata,
          externalResourceId: input.externalResourceId,
          externalResourceType: input.externalResourceType,
          lastSeenAt: input.synchronizedAt,
          lastSyncedAt: input.synchronizedAt,
          nodeId: input.nodeId,
          status: 'ACTIVE',
          updatedAt: input.synchronizedAt,
          workspaceId: this.workspaceId,
        })
        .onConflictDoNothing({
          target: [
            providerResourceLinks.workspaceId,
            providerResourceLinks.connectionId,
            providerResourceLinks.externalResourceType,
            providerResourceLinks.externalResourceId,
          ],
        })
        .returning({ id: providerResourceLinks.id });
      if (inserted.length > 0) return 'CREATED';
      return await this.activateResourceLink(input);
    }

    const changed =
      existing.nodeId !== input.nodeId ||
      existing.entityKind !== 'DOMAIN' ||
      existing.status !== 'ACTIVE' ||
      existing.missingSince !== null ||
      !equalMetadata(existing.externalMetadata, externalMetadata);
    const updated = await this.transaction
      .update(providerResourceLinks)
      .set({
        entityKind: 'DOMAIN',
        externalMetadata,
        lastSeenAt: input.synchronizedAt,
        lastSyncedAt: input.synchronizedAt,
        missingSince: null,
        nodeId: input.nodeId,
        status: 'ACTIVE',
        updatedAt: input.synchronizedAt,
      })
      .where(
        and(
          eq(providerResourceLinks.workspaceId, this.workspaceId),
          eq(providerResourceLinks.id, existing.id),
          lte(providerResourceLinks.lastSyncedAt, input.synchronizedAt),
        ),
      )
      .returning({ id: providerResourceLinks.id });
    return updated.length > 0 && changed ? 'UPDATED' : 'UNCHANGED';
  }

  async markMissingResources(
    externalResourceType: string,
    seenExternalResourceIds: ReadonlySet<string>,
    synchronizedAt: Date,
  ): Promise<number> {
    const links = await this.transaction
      .select()
      .from(providerResourceLinks)
      .where(
        and(
          eq(providerResourceLinks.workspaceId, this.workspaceId),
          eq(providerResourceLinks.connectionId, this.connectionId),
          eq(providerResourceLinks.externalResourceType, externalResourceType),
        ),
      );
    let newlyMissing = 0;
    for (const link of links) {
      if (
        seenExternalResourceIds.has(link.externalResourceId) ||
        link.lastSyncedAt > synchronizedAt
      ) {
        continue;
      }
      const transition = link.status === 'ACTIVE';
      const updated = await this.transaction
        .update(providerResourceLinks)
        .set({
          lastSyncedAt: synchronizedAt,
          missingSince: transition ? synchronizedAt : link.missingSince,
          status: 'MISSING_FROM_PROVIDER',
          updatedAt: synchronizedAt,
        })
        .where(
          and(
            eq(providerResourceLinks.workspaceId, this.workspaceId),
            eq(providerResourceLinks.id, link.id),
            lte(providerResourceLinks.lastSyncedAt, synchronizedAt),
          ),
        )
        .returning({ id: providerResourceLinks.id });
      if (transition && updated.length > 0) newlyMissing += 1;
    }
    return newlyMissing;
  }

  private async findDomain(canonicalDomain: string): Promise<{
    readonly dnsProviderAccountId: string | null;
    readonly id: string;
    readonly provenance: string;
  } | undefined> {
    const [domain] = await this.transaction
      .select({
        dnsProviderAccountId: domains.dnsProviderAccountId,
        id: domains.id,
        provenance: domains.provenance,
      })
      .from(domains)
      .where(
        and(
          eq(domains.workspaceId, this.workspaceId),
          eq(domains.normalizedDomainName, canonicalDomain),
        ),
      )
      .limit(1);
    return domain;
  }
}

export class PostgresProviderDomainReconciliationStore
implements ProviderDomainReconciliationStore {
  constructor(private readonly client: DatabaseClient) {}

  async withWorkspaceTransaction<T>(
    workspaceId: string,
    connectionId: string,
    operation: (transaction: ProviderDomainReconciliationTransaction) => Promise<T>,
  ): Promise<T> {
    return await this.client.withWorkspaceContext(workspaceId, async (transaction) => {
      const reconciliationTransaction =
        new PostgresProviderDomainReconciliationTransaction(
        transaction,
        workspaceId,
        connectionId,
      );
      return await operation(reconciliationTransaction);
    });
  }
}
