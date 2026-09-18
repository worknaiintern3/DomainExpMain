import type { Database } from '@domainpulse/database';

export type OAuthTransactionFlow = 'link' | 'login';

export interface CreateOAuthTransactionInput {
  readonly codeVerifier: string;
  readonly expiresAt: Date;
  readonly flow: OAuthTransactionFlow;
  readonly linkingUserId?: string;
  readonly nonce: string;
  readonly provider: string;
  readonly state: string;
}

export interface CreatedOAuthTransaction {
  readonly state: string;
}

export interface ConsumedOAuthTransaction {
  readonly codeVerifier: string;
  readonly flow: OAuthTransactionFlow;
  readonly linkingUserId: string | null;
  readonly nonce: string;
}

/**
 * A zero-row result deliberately does not distinguish "unknown state" from
 * "expired" from "already consumed (replay)" -- the caller (google-oauth
 * .service.ts) must map every `undefined` here to the same external
 * `GoogleAuthenticationFailedError`, exactly like
 * `RefreshRotationPersistenceResult`'s `'invalid'`/`'replayed'` split is
 * *internally* meaningful but externally collapses to one
 * `InvalidRefreshTokenError`.
 */
export interface OAuthTransactionStore {
  createTransaction(
    input: CreateOAuthTransactionInput,
  ): Promise<CreatedOAuthTransaction>;
  consumeTransaction(
    provider: string,
    state: string,
    consumedAt: Date,
  ): Promise<ConsumedOAuthTransaction | undefined>;
}

export interface OAuthTransactionDatabaseHost {
  readonly database: Database;
}
