import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { lifecycleTimestamps, users, workspaces } from './tenancy';

export const notificationAssetTypeEnum = pgEnum('notification_asset_type', [
  'domain',
  'server',
  'hosting',
  'ssl',
]);

export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', [
  'pending',
  'sent',
  'delivered',
  'failed',
]);

export const notificationDeviceTokens = pgTable(
  'notification_device_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    platform: text('platform').default('unknown').notNull(),
    deviceName: text('device_name'),
    appVersion: text('app_version'),
    isActive: boolean('is_active').default(true).notNull(),
    lastSeenAt: timestamp('last_seen_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('notification_device_tokens_token_unique').on(table.token),
    index('notification_device_tokens_user_active_idx').on(table.userId, table.isActive),
  ],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').default(true).notNull(),
    reminderThresholds: jsonb('reminder_thresholds')
      .$type<number[]>()
      .default([15, 7, 3, 1, 0])
      .notNull(),
    domainsEnabled: boolean('domains_enabled').default(true).notNull(),
    serversEnabled: boolean('servers_enabled').default(true).notNull(),
    hostingEnabled: boolean('hosting_enabled').default(true).notNull(),
    sslEnabled: boolean('ssl_enabled').default(true).notNull(),
    quietHoursEnabled: boolean('quiet_hours_enabled').default(false).notNull(),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('notification_preferences_user_id_unique').on(table.userId),
  ],
);

export const notificationHistory = pgTable(
  'notification_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetId: text('asset_id').notNull(),
    assetType: text('asset_type').notNull(),
    assetName: text('asset_name').notNull(),
    expiryDate: timestamp('expiry_date', { mode: 'date', withTimezone: true }).notNull(),
    reminderThreshold: integer('reminder_threshold').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: text('status').default('sent').notNull(),
    ticketId: text('ticket_id'),
    receiptId: text('receipt_id'),
    failureReason: text('failure_reason'),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { mode: 'date', withTimezone: true }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('notification_history_asset_cycle_unique').on(
      table.assetId,
      table.expiryDate,
      table.reminderThreshold,
      table.userId,
    ),
    index('notification_history_user_created_idx').on(table.userId, table.createdAt),
    index('notification_history_status_idx').on(table.status),
  ],
);

export const assetExpiries = pgTable(
  'asset_expiries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetType: text('asset_type').notNull(),
    assetName: text('asset_name').notNull(),
    hostname: text('hostname'),
    provider: text('provider'),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    status: text('status').default('active').notNull(),
    timeZone: text('time_zone').default('Asia/Kolkata').notNull(),
    notificationPreferences: jsonb('notification_preferences').$type<{
      reminderThresholds?: number[];
    }>(),
    lastCheckedAt: timestamp('last_checked_at', { mode: 'date', withTimezone: true }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    index('asset_expiries_workspace_type_idx').on(table.workspaceId, table.assetType),
    index('asset_expiries_owner_status_expires_idx').on(
      table.ownerUserId,
      table.status,
      table.expiresAt,
    ),
  ],
);

export const schedulerLocks = pgTable('scheduler_locks', {
  id: text('id').primaryKey(),
  lockedUntil: timestamp('locked_until', { mode: 'date', withTimezone: true }).notNull(),
  lockedBy: text('locked_by').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type NotificationDeviceToken = typeof notificationDeviceTokens.$inferSelect;
export type NewNotificationDeviceToken = typeof notificationDeviceTokens.$inferInsert;

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;

export type NotificationHistoryItem = typeof notificationHistory.$inferSelect;
export type NewNotificationHistoryItem = typeof notificationHistory.$inferInsert;

export type AssetExpiry = typeof assetExpiries.$inferSelect;
export type NewAssetExpiry = typeof assetExpiries.$inferInsert;

export type SchedulerLock = typeof schedulerLocks.$inferSelect;
export type NewSchedulerLock = typeof schedulerLocks.$inferInsert;
