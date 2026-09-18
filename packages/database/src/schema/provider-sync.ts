import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { graphEntityKindEnum, inventoryNodes } from './graph';
import { providerConnections } from './provider-connections';
import { lifecycleTimestamps, workspaces } from './tenancy';

export const providerSyncRunTriggerEnum = pgEnum('provider_sync_run_trigger', [
  'INITIAL',
  'MANUAL',
  'SCHEDULED',
  'RETRY',
]);

export const providerSyncRunStatusEnum = pgEnum('provider_sync_run_status', [
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'PARTIAL',
  'FAILED',
]);

export const providerResourceLinkStatusEnum = pgEnum(
  'provider_resource_link_status',
  ['ACTIVE', 'MISSING_FROM_PROVIDER'],
);

/**
 * Durable queue and audit history for provider synchronization.
 *
 * `provider_connections` itself is the schedule "target" (it already owns
 * `sync_status`/`next_sync_at`/`sync_interval_minutes`), so unlike monitoring
 * there is no separate target table. Only the three cross-workspace queue
 * operations (schedule/claim/reclaim) require SECURITY DEFINER functions;
 * INITIAL and MANUAL rows are inserted directly by ordinary workspace-scoped
 * DML, matching the Phase 9 monitoring precedent.
 */
export const providerSyncRuns = pgTable(
  'provider_sync_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    connectionId: uuid('connection_id').notNull(),
    trigger: providerSyncRunTriggerEnum('trigger').notNull(),
    status: providerSyncRunStatusEnum('status').default('QUEUED').notNull(),
    availableAt: timestamp('available_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    claimedAt: timestamp('claimed_at', { mode: 'date', withTimezone: true }),
    leaseExpiresAt: timestamp('lease_expires_at', {
      mode: 'date',
      withTimezone: true,
    }),
    startedAt: timestamp('started_at', { mode: 'date', withTimezone: true }),
    finishedAt: timestamp('finished_at', { mode: 'date', withTimezone: true }),
    durationMs: integer('duration_ms'),
    attemptNo: integer('attempt_no').default(1).notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    itemsDiscovered: integer('items_discovered').default(0).notNull(),
    itemsCreated: integer('items_created').default(0).notNull(),
    itemsUpdated: integer('items_updated').default(0).notNull(),
    itemsUnchanged: integer('items_unchanged').default(0).notNull(),
    itemsMissing: integer('items_missing').default(0).notNull(),
    errorCode: text('error_code'),
    errorDetail: text('error_detail'),
    summaryMetadata: jsonb('summary_metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('provider_sync_runs_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    unique(
      'provider_sync_runs_workspace_connection_idempotency_unique',
    ).on(table.workspaceId, table.connectionId, table.idempotencyKey),
    index('provider_sync_runs_queue_due_idx')
      .on(table.availableAt, table.createdAt, table.id)
      .where(sql`${table.status} = 'QUEUED'`),
    index('provider_sync_runs_workspace_connection_created_idx').on(
      table.workspaceId,
      table.connectionId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.workspaceId, table.connectionId],
      foreignColumns: [providerConnections.workspaceId, providerConnections.id],
      name: 'provider_sync_runs_connection_fk',
    }).onDelete('cascade'),
    check(
      'provider_sync_runs_duration_nonnegative',
      sql`${table.durationMs} is null or ${table.durationMs} >= 0`,
    ),
    check('provider_sync_runs_attempt_positive', sql`${table.attemptNo} >= 1`),
    check(
      'provider_sync_runs_idempotency_key_internal_hash',
      sql`${table.idempotencyKey} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'provider_sync_runs_items_nonnegative',
      sql`
        ${table.itemsDiscovered} >= 0
        and ${table.itemsCreated} >= 0
        and ${table.itemsUpdated} >= 0
        and ${table.itemsUnchanged} >= 0
        and ${table.itemsMissing} >= 0
      `,
    ),
    check(
      'provider_sync_runs_error_code_canonical',
      sql`${table.errorCode} is null or ${table.errorCode} ~ '^[A-Z0-9_]{1,64}$'`,
    ),
    check(
      'provider_sync_runs_error_detail_paired',
      sql`
        (${table.errorCode} is null and ${table.errorDetail} is null)
        or (
          ${table.errorCode} is not null
          and ${table.errorDetail} is not null
          and length(btrim(${table.errorDetail})) > 0
          and char_length(${table.errorDetail}) <= 2048
        )
      `,
    ),
    check(
      'provider_sync_runs_metadata_object',
      sql`jsonb_typeof(${table.summaryMetadata}) = 'object'`,
    ),
    check(
      'provider_sync_runs_metadata_bounded',
      sql`octet_length(${table.summaryMetadata}::text) <= 16384`,
    ),
    check(
      'provider_sync_runs_timestamp_order',
      sql`(${table.leaseExpiresAt} is null or ${table.claimedAt} is null or ${table.leaseExpiresAt} > ${table.claimedAt}) and (${table.finishedAt} is null or ${table.startedAt} is null or ${table.finishedAt} >= ${table.startedAt})`,
    ),
    check(
      'provider_sync_runs_state_consistent',
      sql`
        (
          ${table.status} = 'QUEUED'
          and ${table.claimedAt} is null
          and ${table.leaseExpiresAt} is null
          and ${table.startedAt} is null
          and ${table.finishedAt} is null
          and ${table.durationMs} is null
        )
        or
        (
          ${table.status} = 'RUNNING'
          and ${table.claimedAt} is not null
          and ${table.leaseExpiresAt} is not null
          and ${table.startedAt} is not null
          and ${table.finishedAt} is null
          and ${table.durationMs} is null
        )
        or
        (
          ${table.status} in ('SUCCESS', 'PARTIAL', 'FAILED')
          and ${table.startedAt} is not null
          and ${table.finishedAt} is not null
          and ${table.leaseExpiresAt} is null
        )
      `,
    ),
    check(
      'provider_sync_runs_error_status_consistent',
      sql`
        (
          ${table.status} in ('QUEUED', 'RUNNING', 'SUCCESS')
          and ${table.errorCode} is null
        )
        or
        (
          ${table.status} in ('PARTIAL', 'FAILED')
          and ${table.errorCode} is not null
        )
      `,
    ),
  ],
);

/**
 * Stable external provider-resource identity, kept out of core inventory
 * tables. Links a graph entity node (via the existing DB-backed
 * `inventory_nodes` type-integrity mechanism) to the connection that
 * discovered it and the provider's own identifier for that resource.
 *
 * Reconciliation is conservative: `MISSING_FROM_PROVIDER` may only be set
 * from a sync run whose provider enumeration was confirmed complete. A node
 * may legitimately hold more than one link of the same external resource
 * type from the same connection over time (for example a zone recreated
 * upstream retires its old link and gains a new one), so uniqueness is
 * scoped to the external identity itself, never to the node.
 */
export const providerResourceLinks = pgTable(
  'provider_resource_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    connectionId: uuid('connection_id').notNull(),
    nodeId: uuid('node_id').notNull(),
    entityKind: graphEntityKindEnum('entity_kind').notNull(),
    externalResourceType: text('external_resource_type').notNull(),
    externalResourceId: text('external_resource_id').notNull(),
    status: providerResourceLinkStatusEnum('status')
      .default('ACTIVE')
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', { mode: 'date', withTimezone: true })
      .notNull(),
    lastSyncedAt: timestamp('last_synced_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    missingSince: timestamp('missing_since', {
      mode: 'date',
      withTimezone: true,
    }),
    externalMetadata: jsonb('external_metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('provider_resource_links_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    unique(
      'provider_resource_links_workspace_connection_external_unique',
    ).on(
      table.workspaceId,
      table.connectionId,
      table.externalResourceType,
      table.externalResourceId,
    ),
    index('provider_resource_links_workspace_connection_status_idx').on(
      table.workspaceId,
      table.connectionId,
      table.status,
    ),
    index('provider_resource_links_workspace_node_idx').on(
      table.workspaceId,
      table.nodeId,
    ),
    foreignKey({
      columns: [table.workspaceId, table.connectionId],
      foreignColumns: [providerConnections.workspaceId, providerConnections.id],
      name: 'provider_resource_links_connection_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.nodeId, table.entityKind],
      foreignColumns: [
        inventoryNodes.workspaceId,
        inventoryNodes.nodeId,
        inventoryNodes.entityKind,
      ],
      name: 'provider_resource_links_node_fk',
    }).onDelete('cascade'),
    check(
      'provider_resource_links_entity_kind_allowed',
      sql`${table.entityKind} in ('DOMAIN', 'SERVER', 'CLOUD_RESOURCE')`,
    ),
    check(
      'provider_resource_links_external_resource_type_canonical',
      sql`char_length(${table.externalResourceType}) <= 64 and ${table.externalResourceType} ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'`,
    ),
    check(
      'provider_resource_links_external_resource_id_bounds',
      sql`length(btrim(${table.externalResourceId})) > 0 and char_length(${table.externalResourceId}) <= 1024`,
    ),
    check(
      'provider_resource_links_metadata_object',
      sql`jsonb_typeof(${table.externalMetadata}) = 'object'`,
    ),
    check(
      'provider_resource_links_metadata_bounded',
      sql`octet_length(${table.externalMetadata}::text) <= 16384`,
    ),
    check(
      'provider_resource_links_seen_before_synced',
      sql`${table.lastSeenAt} <= ${table.lastSyncedAt}`,
    ),
    check(
      'provider_resource_links_status_consistent',
      sql`
        (${table.status} = 'ACTIVE' and ${table.missingSince} is null)
        or
        (
          ${table.status} = 'MISSING_FROM_PROVIDER'
          and ${table.missingSince} is not null
          and ${table.lastSeenAt} <= ${table.missingSince}
          and ${table.missingSince} <= ${table.lastSyncedAt}
        )
      `,
    ),
  ],
);

export type ProviderSyncRun = typeof providerSyncRuns.$inferSelect;
export type NewProviderSyncRun = typeof providerSyncRuns.$inferInsert;
export type ProviderResourceLink = typeof providerResourceLinks.$inferSelect;
export type NewProviderResourceLink = typeof providerResourceLinks.$inferInsert;
