import { randomUUID } from 'node:crypto';

import { GoogleOAuthPersistenceError } from './google-oauth.errors';
import type {
  ConsumedOAuthTransaction,
  CreateOAuthTransactionInput,
  CreatedOAuthTransaction,
  OAuthTransactionStore,
} from './oauth-transaction.types';
import type { DatabaseService } from '../../database/database.service';

export class MongoOAuthTransactionRepository implements OAuthTransactionStore {
  constructor(private readonly database: DatabaseService) {}

  async createTransaction(
    input: CreateOAuthTransactionInput,
  ): Promise<CreatedOAuthTransaction> {
    const collections = this.database.collections;
    if (!collections) {
      throw new GoogleOAuthPersistenceError();
    }

    const now = new Date();
    try {
      await collections.oauthTransactions.insertOne({
        id: randomUUID(),
        flow: input.flow,
        state: input.state,
        codeVerifier: input.codeVerifier,
        redirectUri: null,
        expiresAt: input.expiresAt,
        createdAt: now,
        // Optional extras for Mongo
        nonce: input.nonce,
        provider: input.provider,
        linkingUserId: input.linkingUserId ?? null,
      } as any);

      return { state: input.state };
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async consumeTransaction(
    _provider: string,
    state: string,
    consumedAt: Date,
  ): Promise<ConsumedOAuthTransaction | undefined> {
    const collections = this.database.collections;
    if (!collections) {
      throw new GoogleOAuthPersistenceError();
    }

    try {
      const doc = await collections.oauthTransactions.findOneAndDelete({
        state,
        expiresAt: { $gt: consumedAt } as any,
      });

      if (!doc) {
        return undefined;
      }

      return {
        codeVerifier: doc.codeVerifier,
        flow: (doc.flow as any) ?? 'login',
        linkingUserId: (doc as any).linkingUserId ?? null,
        nonce: (doc as any).nonce ?? '',
      };
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }
}
