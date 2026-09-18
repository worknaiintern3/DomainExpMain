import { oauthTransactions } from '@domainpulse/database';
import { and, eq, gt, isNull } from 'drizzle-orm';

import { GoogleOAuthPersistenceError } from './google-oauth.errors';
import type {
  ConsumedOAuthTransaction,
  CreateOAuthTransactionInput,
  CreatedOAuthTransaction,
  OAuthTransactionDatabaseHost,
  OAuthTransactionStore,
} from './oauth-transaction.types';

export class PostgresOAuthTransactionRepository
implements OAuthTransactionStore {
  constructor(private readonly host: OAuthTransactionDatabaseHost) {}

  async createTransaction(
    input: CreateOAuthTransactionInput,
  ): Promise<CreatedOAuthTransaction> {
    try {
      const [created] = await this.host.database
        .insert(oauthTransactions)
        .values({
          codeVerifier: input.codeVerifier,
          expiresAt: input.expiresAt,
          flow: input.flow,
          linkingUserId: input.linkingUserId ?? null,
          nonce: input.nonce,
          provider: input.provider,
          state: input.state,
        })
        .returning({ state: oauthTransactions.state });

      if (!created) {
        throw new GoogleOAuthPersistenceError();
      }

      return created;
    } catch (error) {
      if (error instanceof GoogleOAuthPersistenceError) {
        throw error;
      }

      throw new GoogleOAuthPersistenceError();
    }
  }

  /**
   * Single-statement compare-and-swap, mirroring
   * `PostgresSessionRepository.rotateRefreshCredential`'s claim pattern
   * exactly: only a row that is unconsumed and unexpired at the instant of
   * the UPDATE is claimed, so two concurrent callback requests for the same
   * `state` can never both succeed.
   */
  async consumeTransaction(
    provider: string,
    state: string,
    consumedAt: Date,
  ): Promise<ConsumedOAuthTransaction | undefined> {
    try {
      const [claimed] = await this.host.database
        .update(oauthTransactions)
        .set({ consumedAt })
        .where(
          and(
            eq(oauthTransactions.provider, provider),
            eq(oauthTransactions.state, state),
            isNull(oauthTransactions.consumedAt),
            gt(oauthTransactions.expiresAt, consumedAt),
          ),
        )
        .returning({
          codeVerifier: oauthTransactions.codeVerifier,
          flow: oauthTransactions.flow,
          linkingUserId: oauthTransactions.linkingUserId,
          nonce: oauthTransactions.nonce,
        });

      return claimed
        ? { ...claimed, linkingUserId: claimed.linkingUserId ?? null }
        : undefined;
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }
}
