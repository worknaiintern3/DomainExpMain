import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { lifecycleTimestamps, users } from './tenancy';

/**
 * `login` transactions authenticate an unauthenticated caller and never
 * carry `linkingUserId`. `link` transactions authenticate-and-attach for an
 * *already* signed-in DomainPulse user and always carry `linkingUserId` --
 * see the `oauth_transactions_flow_linking_user_invariant` check below,
 * which is the DB-enforced version of that same rule.
 */
export const oauthTransactionFlowEnum = pgEnum('oauth_transaction_flow', [
  'login',
  'link',
]);

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

/**
 * Google (and, later, any other OIDC/OAuth provider) as a pure identity
 * provider: a separate, additive credential table exactly like
 * `passwordCredentials` -- never a column on `users`, never a second
 * session/auth system. Canonical identity is `(provider, providerSubject)`
 * only; `providerEmail`/`providerEmailVerified` are last-observed display
 * metadata, never used to look up or authorize an account (see
 * oauth-identity.repository.ts). Phase 10K implements Google only --
 * `provider` is a plain canonical string, not an enum, so a future provider
 * needs no schema change, but no provider-plugin machinery exists yet.
 * No RLS: matches `users`/`sessions`/`passwordCredentials`, none of which
 * carry workspace-scoped row-level security -- this is identity data, not
 * workspace inventory data.
 */
export const oauthIdentities = pgTable(
  'oauth_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    providerEmail: text('provider_email'),
    providerEmailVerified: boolean('provider_email_verified')
      .default(false)
      .notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('oauth_identities_provider_subject_unique').on(
      table.provider,
      table.providerSubject,
    ),
    uniqueIndex('oauth_identities_user_provider_unique').on(
      table.userId,
      table.provider,
    ),
    index('oauth_identities_user_id_idx').on(table.userId),
    check(
      'oauth_identities_provider_canonical',
      sql`${table.provider} ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'`,
    ),
    check(
      'oauth_identities_provider_subject_not_blank',
      sql`length(btrim(${table.providerSubject})) > 0`,
    ),
    check(
      'oauth_identities_provider_email_not_blank',
      sql`${table.providerEmail} is null or length(btrim(${table.providerEmail})) > 0`,
    ),
  ],
);

/**
 * Short-lived server-side state for one in-flight OAuth authorization-code
 * flow: binds a CSRF `state`, a PKCE `codeVerifier`, and an ID-token `nonce`
 * to a single browser round trip. Supports two flows: `login` (unauthenticated
 * sign-in/sign-up) and `link` (an already-authenticated user attaching a
 * Google identity to their own `users.id`). `linkingUserId` is the
 * authoritative record of *which* DomainPulse user initiated a `link`
 * transaction -- the link callback re-checks it against the caller's current
 * authenticated principal, so a copied authorization URL can never complete
 * a link as a different signed-in user. `codeVerifier` is stored in
 * plaintext deliberately -- unlike `sessions.refreshTokenHash`, it must be
 * presented back to Google verbatim to complete the token exchange, so it
 * cannot be a one-way hash; the risk is bounded by the short `expiresAt`
 * TTL, single-use `consumedAt`, and the fact it has no value outside
 * completing this one exchange. No RLS, for the same reason as
 * `oauthIdentities`.
 */
export const oauthTransactions = pgTable(
  'oauth_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),
    state: text('state').notNull(),
    codeVerifier: text('code_verifier').notNull(),
    nonce: text('nonce').notNull(),
    flow: oauthTransactionFlowEnum('flow').notNull(),
    linkingUserId: uuid('linking_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    consumedAt: timestamp('consumed_at', {
      mode: 'date',
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('oauth_transactions_state_unique').on(table.state),
    index('oauth_transactions_expires_at_idx').on(table.expiresAt),
    index('oauth_transactions_linking_user_id_idx').on(table.linkingUserId),
    check(
      'oauth_transactions_provider_canonical',
      sql`${table.provider} ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'`,
    ),
    check(
      'oauth_transactions_state_not_blank',
      sql`length(btrim(${table.state})) > 0`,
    ),
    check(
      'oauth_transactions_code_verifier_not_blank',
      sql`length(btrim(${table.codeVerifier})) > 0`,
    ),
    check(
      'oauth_transactions_nonce_not_blank',
      sql`length(btrim(${table.nonce})) > 0`,
    ),
    check(
      'oauth_transactions_flow_linking_user_invariant',
      sql`(${table.flow} = 'login' AND ${table.linkingUserId} IS NULL) OR (${table.flow} = 'link' AND ${table.linkingUserId} IS NOT NULL)`,
    ),
  ],
);

export type PasswordCredential = typeof passwordCredentials.$inferSelect;
export type NewPasswordCredential = typeof passwordCredentials.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type OAuthIdentity = typeof oauthIdentities.$inferSelect;
export type NewOAuthIdentity = typeof oauthIdentities.$inferInsert;
export type OAuthTransaction = typeof oauthTransactions.$inferSelect;
export type NewOAuthTransaction = typeof oauthTransactions.$inferInsert;
