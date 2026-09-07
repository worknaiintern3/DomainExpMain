import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { lifecycleTimestamps, users } from './tenancy';

export const passwordCredentials = pgTable(
  'password_credentials',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    passwordUpdatedAt: timestamp('password_updated_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    check(
      'password_credentials_password_hash_not_blank',
      sql`length(btrim(${table.passwordHash})) > 0`,
    ),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp('revoked_at', {
      mode: 'date',
      withTimezone: true,
    }),
    lastSeenAt: timestamp('last_seen_at', {
      mode: 'date',
      withTimezone: true,
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('sessions_refresh_token_hash_unique').on(
      table.refreshTokenHash,
    ),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
    check(
      'sessions_refresh_token_hash_not_blank',
      sql`length(btrim(${table.refreshTokenHash})) > 0`,
    ),
    check(
      'sessions_expires_after_creation',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export type PasswordCredential = typeof passwordCredentials.$inferSelect;
export type NewPasswordCredential = typeof passwordCredentials.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
