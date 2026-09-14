import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { lifecycleTimestamps, workspaces } from './tenancy';
import { providerAccounts } from './portfolio';

export const providerConnectionAuthTypeEnum = pgEnum(
  'provider_connection_auth_type',
  ['CLOUDFLARE_API_TOKEN'],
);

export const providerConnectionValidationStatusEnum = pgEnum(
  'provider_connection_validation_status',
  ['PENDING', 'VALID', 'INVALID'],
);

export const providerConnectionSyncStatusEnum = pgEnum(
  'provider_connection_sync_status',
  ['IDLE', 'PENDING', 'SYNCING', 'SUCCESS', 'FAILED'],
);

/**
 * Workspace-owned encrypted provider credentials.
 *
 * `provider_accounts` remains pure inventory identity and never stores secrets.
 * This table owns the AES-256-GCM envelope only:
 * base64 ciphertext, 12-byte IV, 16-byte auth tag, and the key version that
 * selects the decryption key. Plaintext credentials are never stored here and
 * must never be returned through API responses; decryption happens in memory
 * only during validation/sync (future phases). There are no routes in Phase 10B
 * and no external provider calls.
 */
export const providerConnections = pgTable(
  'provider_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    providerAccountId: uuid('provider_account_id').notNull(),
    authType: providerConnectionAuthTypeEnum('auth_type').notNull(),
    encryptedCiphertext: text('encrypted_ciphertext').notNull(),
    encryptionIv: text('encryption_iv').notNull(),
    encryptionAuthTag: text('encryption_auth_tag').notNull(),
    keyVersion: integer('key_version').notNull(),
    credentialMask: text('credential_mask').notNull(),
    validationStatus: providerConnectionValidationStatusEnum(
      'validation_status',
    )
      .default('PENDING')
      .notNull(),
    lastValidatedAt: timestamp('last_validated_at', {
      mode: 'date',
      withTimezone: true,
    }),
    validationErrorCode: text('validation_error_code'),
    syncStatus: providerConnectionSyncStatusEnum('sync_status')
      .default('IDLE')
      .notNull(),
    syncIntervalMinutes: integer('sync_interval_minutes')
      .default(1_440)
      .notNull(),
    lastSyncAt: timestamp('last_sync_at', {
      mode: 'date',
      withTimezone: true,
    }),
    nextSyncAt: timestamp('next_sync_at', {
      mode: 'date',
      withTimezone: true,
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('provider_connections_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    uniqueIndex('provider_connections_workspace_account_unique').on(
      table.workspaceId,
      table.providerAccountId,
    ),
    index('provider_connections_workspace_next_sync_idx')
      .on(table.workspaceId, table.nextSyncAt)
      .where(sql`${table.nextSyncAt} is not null`),
    foreignKey({
      columns: [table.workspaceId, table.providerAccountId],
      foreignColumns: [providerAccounts.workspaceId, providerAccounts.id],
      name: 'provider_connections_account_fk',
    }).onDelete('cascade'),
    check(
      'provider_connections_ciphertext_envelope',
      sql`length(${table.encryptedCiphertext}) between 4 and 8192 and ${table.encryptedCiphertext} ~ '^[A-Za-z0-9+/]+={0,2}$'`,
    ),
    check(
      'provider_connections_iv_envelope',
      sql`length(${table.encryptionIv}) = 16 and ${table.encryptionIv} ~ '^[A-Za-z0-9+/]{16}$'`,
    ),
    check(
      'provider_connections_auth_tag_envelope',
      sql`length(${table.encryptionAuthTag}) = 24 and ${table.encryptionAuthTag} ~ '^[A-Za-z0-9+/]{22}==$'`,
    ),
    check(
      'provider_connections_key_version_positive',
      sql`${table.keyVersion} >= 1`,
    ),
    check(
      'provider_connections_credential_mask_display',
      sql`length(btrim(${table.credentialMask})) > 0 and char_length(${table.credentialMask}) <= 255`,
    ),
    check(
      'provider_connections_sync_interval_bounds',
      sql`${table.syncIntervalMinutes} between 60 and 10080`,
    ),
    check(
      'provider_connections_error_code_canonical',
      sql`${table.validationErrorCode} is null or ${table.validationErrorCode} ~ '^[A-Z0-9_]{1,64}$'`,
    ),
    check(
      'provider_connections_validation_consistent',
      sql`
        (
          ${table.validationStatus} = 'PENDING'
          and ${table.lastValidatedAt} is null
          and ${table.validationErrorCode} is null
        )
        or
        (
          ${table.validationStatus} = 'VALID'
          and ${table.lastValidatedAt} is not null
          and ${table.validationErrorCode} is null
        )
        or
        (
          ${table.validationStatus} = 'INVALID'
          and ${table.lastValidatedAt} is not null
          and ${table.validationErrorCode} is not null
        )
      `,
    ),
  ],
);

export type ProviderConnection = typeof providerConnections.$inferSelect;
export type NewProviderConnection = typeof providerConnections.$inferInsert;
