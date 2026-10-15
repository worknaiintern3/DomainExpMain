import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { lifecycleTimestamps, users } from './tenancy';

/**
 * Verified Google Play Console account connections per application user.
 *
 * Each customer/user connects their own Google account with the
 * https://www.googleapis.com/auth/androidpublisher scope. Tokens are stored
 * encrypted (AES-256-GCM) and are never exposed in plaintext or sent to
 * client devices. The developerAccountId is verified against Google Play
 * Developer API before being trusted.
 */
export const googlePlayConnections = pgTable(
  'google_play_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    googleAccountId: text('google_account_id').notNull(),
    googleAccountEmail: text('google_account_email').notNull(),
    developerAccountId: text('developer_account_id'),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('google_play_connections_user_id_unique').on(table.userId),
    index('google_play_connections_developer_account_id_idx').on(
      table.developerAccountId,
    ),
  ],
);

/**
 * Short-lived server-side state for one in-flight Google Play Console OAuth transaction.
 * Binds CSRF state, PKCE codeVerifier, and optional developerAccountId to the requesting user.
 */
export const googlePlayOauthStates = pgTable(
  'google_play_oauth_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    state: text('state').notNull(),
    codeVerifier: text('code_verifier').notNull(),
    developerAccountId: text('developer_account_id'),
    redirectUri: text('redirect_uri'),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('google_play_oauth_states_state_unique').on(table.state),
    index('google_play_oauth_states_user_id_idx').on(table.userId),
    index('google_play_oauth_states_expires_at_idx').on(table.expiresAt),
  ],
);

export type GooglePlayConnection = typeof googlePlayConnections.$inferSelect;
export type NewGooglePlayConnection = typeof googlePlayConnections.$inferInsert;
export type GooglePlayOAuthState = typeof googlePlayOauthStates.$inferSelect;
export type NewGooglePlayOAuthState = typeof googlePlayOauthStates.$inferInsert;
