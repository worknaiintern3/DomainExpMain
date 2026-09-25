import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { lifecycleTimestamps, users } from './tenancy';

export const mobileAppConfig = pgTable('mobile_app_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  appName: text('app_name').default('DomainPulse').notNull(),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').default('#2563EB').notNull(),
  secondaryColor: text('secondary_color').default('#1E293B').notNull(),
  maintenanceMode: boolean('maintenance_mode').default(false).notNull(),
  maintenanceMessage: text('maintenance_message'),
  ...lifecycleTimestamps(),
});

export const mobileFeatureFlags = pgTable(
  'mobile_feature_flags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    enabled: boolean('enabled').default(true).notNull(),
    minAppVersion: text('min_app_version'),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('mobile_feature_flags_key_unique').on(table.key),
    check('mobile_feature_flags_key_not_blank', sql`length(btrim(${table.key})) > 0`),
  ],
);

export const mobileNavigationConfig = pgTable(
  'mobile_navigation_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    icon: text('icon').notNull(),
    route: text('route').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    badge: text('badge'),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('mobile_navigation_config_key_unique').on(table.key),
    index('mobile_navigation_config_sort_order_idx').on(table.sortOrder),
  ],
);

export const mobileHomeConfig = pgTable(
  'mobile_home_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sectionKey: text('section_key').notNull(),
    title: text('title').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    configJson: jsonb('config_json'),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('mobile_home_config_section_key_unique').on(table.sectionKey),
    index('mobile_home_config_sort_order_idx').on(table.sortOrder),
  ],
);

export const mobileAnnouncements = pgTable(
  'mobile_announcements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').default('info').notNull(),
    actionUrl: text('action_url'),
    actionLabel: text('action_label'),
    isActive: boolean('is_active').default(true).notNull(),
    startsAt: timestamp('starts_at', { mode: 'date', withTimezone: true }),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    index('mobile_announcements_is_active_idx').on(table.isActive),
  ],
);

export const mobileAppVersions = pgTable(
  'mobile_app_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    platform: text('platform').notNull(), // 'ios', 'android', 'all'
    minimumVersion: text('minimum_version').default('1.0.0').notNull(),
    latestVersion: text('latest_version').default('1.0.0').notNull(),
    forceUpdate: boolean('force_update').default(false).notNull(),
    updateUrl: text('update_url'),
    releaseNotes: text('release_notes'),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('mobile_app_versions_platform_unique').on(table.platform),
  ],
);

export const mobileAuditLogs = pgTable(
  'mobile_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    target: text('target').notNull(),
    details: text('details'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('mobile_audit_logs_user_id_idx').on(table.userId),
    index('mobile_audit_logs_action_idx').on(table.action),
    index('mobile_audit_logs_created_at_idx').on(table.createdAt),
  ],
);

export type MobileAppConfigTable = typeof mobileAppConfig.$inferSelect;
export type NewMobileAppConfig = typeof mobileAppConfig.$inferInsert;

export type MobileFeatureFlagTable = typeof mobileFeatureFlags.$inferSelect;
export type NewMobileFeatureFlag = typeof mobileFeatureFlags.$inferInsert;

export type MobileNavigationConfigTable = typeof mobileNavigationConfig.$inferSelect;
export type NewMobileNavigationConfig = typeof mobileNavigationConfig.$inferInsert;

export type MobileHomeConfigTable = typeof mobileHomeConfig.$inferSelect;
export type NewMobileHomeConfig = typeof mobileHomeConfig.$inferInsert;

export type MobileAnnouncementTable = typeof mobileAnnouncements.$inferSelect;
export type NewMobileAnnouncement = typeof mobileAnnouncements.$inferInsert;

export type MobileAppVersionTable = typeof mobileAppVersions.$inferSelect;
export type NewMobileAppVersion = typeof mobileAppVersions.$inferInsert;

export type MobileAuditLogTable = typeof mobileAuditLogs.$inferSelect;
export type NewMobileAuditLog = typeof mobileAuditLogs.$inferInsert;
