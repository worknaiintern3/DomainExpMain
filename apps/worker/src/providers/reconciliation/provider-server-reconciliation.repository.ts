import {
  inventoryNodes,
  providerAccounts,
  providerConnections,
  providerResourceLinks,
  servers,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@domainpulse/database';
import { and, asc, eq, lte } from 'drizzle-orm';

import type { DiscoveredProviderServer } from '../provider-adapter.types';
import { ProviderReconciliationError } from '../provider.errors';
import { isPublicIpAddress } from './public-ip';
import type {
  ActivateProviderServerResourceLinkInput,
  ProviderServerReconciliationStore,
  ProviderServerReconciliationTransaction,
  ProviderServerResourceLinkOutcome,
  ReconciledServerRecord,
} from './provider-server-reconciliation.types';

function metadataFor(providerStatus: string): Record<string, unknown> {
  return { providerStatus };
}

function equalMetadata(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const MAX_IP_MATCH_CANDIDATES = 10;

class PostgresProviderServerReconciliationTransaction
implements ProviderServerReconciliationTransaction {
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

  async findLinkedServerNodeId(
    externalResourceType: string,
    externalResourceId: string,
  ): Promise<string | undefined> {
    const [link] = await this.transaction
      .select({ nodeId: providerResourceLinks.nodeId })
      .from(providerResourceLinks)
      .where(
        and(
          eq(providerResourceLinks.workspaceId, this.workspaceId),
          eq(providerResourceLinks.connectionId, this.connectionId),
          eq(providerResourceLinks.externalResourceType, externalResourceType),
          eq(providerResourceLinks.externalResourceId, externalResourceId),
          eq(providerResourceLinks.entityKind, 'SERVER'),
        ),
      )
      .limit(1);
    return link?.nodeId;
  }

  async findOrCreateServer(
    discovered: DiscoveredProviderServer,
    providerAccountId: string,
    synchronizedAt: Date,
  ): Promise<ReconciledServerRecord> {
    const matched = await this.findUnlinkedServerByIp(discovered.primaryIp);
    if (matched) return { ...matched, created: false };

    const expiresAt = discovered.expiresAt ? new Date(discovered.expiresAt) : null;

    const [created] = await this.transaction
      .insert(servers)
      .values({
        createdAt: synchronizedAt,
        expiresAt,
        hostname: discovered.hostname,
        inventoryState: 'TRACKED',
        name: discovered.canonicalName,
        operatingSystem: discovered.operatingSystem,
        primaryIp: discovered.primaryIp,
        provenance: 'PROVIDER_API',
        providerAccountId,
        region: discovered.region,
        serverKind: discovered.serverKind,
        updatedAt: synchronizedAt,
        workspaceId: this.workspaceId,
      })
      .returning({ id: servers.id, provenance: servers.provenance });
    if (!created) {
      throw new ProviderReconciliationError('INTERNAL_INTEGRITY_ERROR');
    }
    return { ...created, created: true };
  }

  async updateServerExpiry(
    nodeId: string,
    expiresAt: string | null,
    synchronizedAt: Date,
  ): Promise<void> {
    // Resolve server id from node id via inventory_nodes
    const [node] = await this.transaction
      .select({ entityId: inventoryNodes.entityId })
      .from(inventoryNodes)
      .where(
        and(
          eq(inventoryNodes.workspaceId, this.workspaceId),
          eq(inventoryNodes.nodeId, nodeId),
          eq(inventoryNodes.entityKind, 'SERVER'),
        ),
      )
      .limit(1);
    if (!node) return;
    const parsedExpiry = expiresAt ? new Date(expiresAt) : null;
    await this.transaction
      .update(servers)
      .set({ expiresAt: parsedExpiry, updatedAt: synchronizedAt })
      .where(
        and(
          eq(servers.workspaceId, this.workspaceId),
          eq(servers.id, node.entityId),
        ),
      );
  }

  async resolveServerNodeId(serverId: string): Promise<string | undefined> {
    const [node] = await this.transaction
      .select({ nodeId: inventoryNodes.nodeId })
      .from(inventoryNodes)
      .where(
        and(
          eq(inventoryNodes.workspaceId, this.workspaceId),
          eq(inventoryNodes.entityKind, 'SERVER'),
          eq(inventoryNodes.entityId, serverId),
        ),
      )
      .limit(1);
    return node?.nodeId;
  }

  async activateResourceLink(
    input: ActivateProviderServerResourceLinkInput,
  ): Promise<ProviderServerResourceLinkOutcome> {
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
          entityKind: 'SERVER',
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
      existing.entityKind !== 'SERVER' ||
      existing.status !== 'ACTIVE' ||
      existing.missingSince !== null ||
      !equalMetadata(existing.externalMetadata, externalMetadata);
    const updated = await this.transaction
      .update(providerResourceLinks)
      .set({
        entityKind: 'SERVER',
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

  /**
   * First-time-only IP match. The stable provider-link path in the service
   * resolves already-linked servers before this is ever reached, so this
   * helper must never re-target a linked server on IP change. It attaches
   * to an existing row ONLY when the discovered IP is globally routable
   * public AND exactly one eligible (same-workspace, tracked, same IP,
   * not already claimed by another active provider link) unlinked server
   * exists. Zero candidates, a non-public IP, multiple eligible
   * candidates, or a truncated candidate window all fail safe to
   * `undefined` so the caller creates a new `PROVIDER_API` server instead
   * of guessing. A server with no discovered IP never matches here.
   */
  private async findUnlinkedServerByIp(
    primaryIp: string | null,
  ): Promise<{ id: string; provenance: string } | undefined> {
    if (primaryIp === null || !isPublicIpAddress(primaryIp)) return undefined;

    const candidates = await this.transaction
      .select({ id: servers.id, provenance: servers.provenance })
      .from(servers)
      .where(
        and(
          eq(servers.workspaceId, this.workspaceId),
          eq(servers.primaryIp, primaryIp),
          eq(servers.inventoryState, 'TRACKED'),
        ),
      )
      .orderBy(asc(servers.createdAt))
      .limit(MAX_IP_MATCH_CANDIDATES + 1);

    let match: { id: string; provenance: string } | undefined;
    for (const candidate of candidates) {
      const nodeId = await this.resolveServerNodeId(candidate.id);
      if (!nodeId) continue;
      const [activeLink] = await this.transaction
        .select({ id: providerResourceLinks.id })
        .from(providerResourceLinks)
        .where(
          and(
            eq(providerResourceLinks.workspaceId, this.workspaceId),
            eq(providerResourceLinks.nodeId, nodeId),
            eq(providerResourceLinks.status, 'ACTIVE'),
          ),
        )
        .limit(1);
      if (!activeLink) {
        // Two or more eligible candidates: ambiguous, do not guess.
        if (match) return undefined;
        match = candidate;
      }
    }
    // The candidate window may have been truncated, so a single in-window
    // match is not provably unique: fail safe instead of attaching.
    if (match && candidates.length > MAX_IP_MATCH_CANDIDATES) return undefined;
    return match;
  }
}

export class PostgresProviderServerReconciliationStore
implements ProviderServerReconciliationStore {
  constructor(private readonly client: DatabaseClient) {}

  async withWorkspaceTransaction<T>(
    workspaceId: string,
    connectionId: string,
    operation: (transaction: ProviderServerReconciliationTransaction) => Promise<T>,
  ): Promise<T> {
    return await this.client.withWorkspaceContext(workspaceId, async (transaction) => {
      const reconciliationTransaction =
        new PostgresProviderServerReconciliationTransaction(
        transaction,
        workspaceId,
        connectionId,
      );
      return await operation(reconciliationTransaction);
    });
  }
}
