import {
  cloudResources,
  inventoryNodes,
  providerAccounts,
  providerConnections,
  providerResourceLinks,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@domainpulse/database';
import { and, eq, isNotNull, lte } from 'drizzle-orm';

import { ProviderReconciliationError } from '../provider.errors';
import type { ProviderResourceLinkOutcome } from './provider-domain-reconciliation.types';
import type {
  ActivateCloudResourceLinkInput,
  ProviderCloudResourceReconciliationStore,
  ProviderCloudResourceReconciliationTransaction,
  ReconciledCloudResourceRecord,
  UpsertCloudResourceInput,
} from './provider-cloud-resource-reconciliation.types';

/** Deterministic, key-order-independent JSON comparison: provider responses (tag maps especially) have no guaranteed key order, so a naive `JSON.stringify` comparison would report spurious changes on every sync. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function equalMetadata(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return stableStringify(left) === stableStringify(right);
}

class PostgresProviderCloudResourceReconciliationTransaction
implements ProviderCloudResourceReconciliationTransaction {
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

  /**
   * `cloud_resources.updated_at` (an ordinary lifecycle timestamp elsewhere
   * in the schema -- see `lifecycleTimestamps()`) is used, for this table's
   * provider-sync write path specifically, as a monotonic watermark: the
   * `synchronizedAt` of the most recent sync run that has *observed* this
   * resource, whether or not that observation changed any field. This is a
   * local convention of this repository's write path only -- no other
   * reader (the inventory API sorts/paginates cloud resources by
   * `createdAt`+`id`, never `updatedAt`) attaches a different meaning to it,
   * so repurposing it here does not conflict with any existing consumer.
   *
   * Advancing the watermark unconditionally (even when name/region are
   * unchanged) is required, not optional: a sync run T2 that observes no
   * field change must still record "as of T2, this is confirmed current",
   * so that an older, slower-to-finish run T1 (synchronizedAt < T2) can
   * never overwrite it afterwards merely because T2 never issued a write to
   * bump the watermark past T1's timestamp. Every accepted write is a
   * compare-and-swap guarded by `updated_at <= synchronizedAt`, mirroring
   * `provider_resource_links.last_synced_at`'s existing guard.
   */
  async upsertCloudResource(
    input: UpsertCloudResourceInput,
  ): Promise<ReconciledCloudResourceRecord> {
    const existing = await this.findCloudResource(input.providerAccountId, input.resourceType, input.externalResourceId);
    if (existing) {
      return await this.applyWatermarkedResourceWrite(existing, input);
    }

    const [created] = await this.transaction
      .insert(cloudResources)
      .values({
        createdAt: input.synchronizedAt,
        externalResourceId: input.externalResourceId,
        inventoryState: 'TRACKED',
        name: input.name,
        provenance: 'PROVIDER_API',
        providerAccountId: input.providerAccountId,
        region: input.region,
        resourceType: input.resourceType,
        updatedAt: input.synchronizedAt,
        workspaceId: this.workspaceId,
      })
      .onConflictDoNothing({
        // `cloud_resources_workspace_provider_external_unique` (see the
        // schema/migration) is a *partial* unique index -- `WHERE
        // external_resource_id IS NOT NULL` -- because externalResourceId
        // is nullable (to allow user-added cloud resources with no
        // provider-assigned ID, mirroring `provider_accounts`'
        // `externalAccountId`/`..._workspace_provider_external_unique`
        // pattern for the identical reason). PostgreSQL only matches an
        // `ON CONFLICT` target against a partial index when the predicate
        // is restated here too; a bare column-list target (as this call
        // used to have) cannot infer a partial index and raises 42P10
        // ("no unique or exclusion constraint matching the ON CONFLICT
        // specification"). Every row this repository ever inserts has a
        // real, non-null `externalResourceId` (provider-discovered
        // resources always carry one), so this predicate is always
        // satisfied for this call site.
        target: [
          cloudResources.workspaceId,
          cloudResources.providerAccountId,
          cloudResources.resourceType,
          cloudResources.externalResourceId,
        ],
        where: isNotNull(cloudResources.externalResourceId),
      })
      .returning({ id: cloudResources.id });
    if (created) return { created: true, id: created.id };

    // Lost the insert race to a concurrent transaction: apply the same
    // watermarked-write rule against whatever it left behind, rather than
    // assuming the winner's row is automatically newer than this input.
    const raced = await this.findCloudResource(input.providerAccountId, input.resourceType, input.externalResourceId);
    if (!raced) {
      throw new ProviderReconciliationError('INTERNAL_INTEGRITY_ERROR');
    }
    return await this.applyWatermarkedResourceWrite(raced, input);
  }

  private async applyWatermarkedResourceWrite(
    existing: { readonly id: string; readonly name: string; readonly region: string | null; readonly updatedAt: Date },
    input: UpsertCloudResourceInput,
  ): Promise<ReconciledCloudResourceRecord> {
    if (input.synchronizedAt < existing.updatedAt) {
      // Strictly older observation than the recorded watermark: this sync's
      // data is stale relative to a sync that has already been accepted
      // (whether or not that sync changed any field) and must not mutate
      // the row at all -- not name/region, not the watermark.
      return { created: false, id: existing.id };
    }
    // synchronizedAt >= existing.updatedAt: this observation is at least as
    // new as anything previously accepted. Always advance the watermark to
    // synchronizedAt (even if name/region are identical to what's already
    // stored) so a later-arriving-but-actually-older sync can never pass
    // this same guard afterwards. The WHERE clause re-checks the watermark
    // at write time (compare-and-swap), since the value read above can be
    // stale by the time this statement executes under concurrent writers.
    await this.transaction
      .update(cloudResources)
      .set({ name: input.name, region: input.region, updatedAt: input.synchronizedAt })
      .where(
        and(
          eq(cloudResources.workspaceId, this.workspaceId),
          eq(cloudResources.id, existing.id),
          lte(cloudResources.updatedAt, input.synchronizedAt),
        ),
      );
    // Whether this UPDATE affected a row or matched zero rows (a concurrent
    // transaction advanced the watermark past `input.synchronizedAt`
    // between our read and this write), the safe response is the same:
    // `id` never changes, and this function returns no other row data, so
    // there is nothing to re-read in either case.
    return { created: false, id: existing.id };
  }

  async resolveCloudResourceNodeId(cloudResourceId: string): Promise<string | undefined> {
    const [node] = await this.transaction
      .select({ nodeId: inventoryNodes.nodeId })
      .from(inventoryNodes)
      .where(
        and(
          eq(inventoryNodes.workspaceId, this.workspaceId),
          eq(inventoryNodes.entityKind, 'CLOUD_RESOURCE'),
          eq(inventoryNodes.entityId, cloudResourceId),
        ),
      )
      .limit(1);
    return node?.nodeId;
  }

  async activateResourceLink(
    input: ActivateCloudResourceLinkInput,
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
    if (existing && existing.lastSyncedAt > input.synchronizedAt) {
      return 'UNCHANGED';
    }

    if (!existing) {
      const inserted = await this.transaction
        .insert(providerResourceLinks)
        .values({
          connectionId: this.connectionId,
          createdAt: input.synchronizedAt,
          entityKind: 'CLOUD_RESOURCE',
          externalMetadata: input.externalMetadata,
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
      existing.entityKind !== 'CLOUD_RESOURCE' ||
      existing.status !== 'ACTIVE' ||
      existing.missingSince !== null ||
      !equalMetadata(existing.externalMetadata, input.externalMetadata);
    const updated = await this.transaction
      .update(providerResourceLinks)
      .set({
        entityKind: 'CLOUD_RESOURCE',
        externalMetadata: input.externalMetadata,
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

  private async findCloudResource(
    providerAccountId: string,
    resourceType: string,
    externalResourceId: string,
  ): Promise<
    { readonly id: string; readonly name: string; readonly region: string | null; readonly updatedAt: Date } | undefined
  > {
    const [resource] = await this.transaction
      .select({
        id: cloudResources.id,
        name: cloudResources.name,
        region: cloudResources.region,
        updatedAt: cloudResources.updatedAt,
      })
      .from(cloudResources)
      .where(
        and(
          eq(cloudResources.workspaceId, this.workspaceId),
          eq(cloudResources.providerAccountId, providerAccountId),
          eq(cloudResources.resourceType, resourceType),
          eq(cloudResources.externalResourceId, externalResourceId),
        ),
      )
      .limit(1);
    return resource;
  }
}

export class PostgresProviderCloudResourceReconciliationStore
implements ProviderCloudResourceReconciliationStore {
  constructor(private readonly client: DatabaseClient) {}

  async withWorkspaceTransaction<T>(
    workspaceId: string,
    connectionId: string,
    operation: (transaction: ProviderCloudResourceReconciliationTransaction) => Promise<T>,
  ): Promise<T> {
    return await this.client.withWorkspaceContext(workspaceId, async (transaction) => {
      const reconciliationTransaction =
        new PostgresProviderCloudResourceReconciliationTransaction(
        transaction,
        workspaceId,
        connectionId,
      );
      return await operation(reconciliationTransaction);
    });
  }
}
