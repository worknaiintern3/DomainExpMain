import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  oauthTransactions,
  type DatabaseClient,
} from '@domainpulse/database';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresOAuthTransactionRepository } from '../src/auth/oauth';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

describeWithPostgreSql(
  'OAuth transaction persistence (requires a disposable TEST_DATABASE_URL)',
  () => {
    const provider = 'google';
    let client: DatabaseClient | undefined;
    const createdStates: string[] = [];

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('OAuth transaction integration client was not initialized');
      }
      return client;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, {
        migrationsFolder: '../../packages/database/migrations',
      });
    });

    afterAll(async () => {
      if (!client) return;
      for (const state of createdStates) {
        await client.database.delete(oauthTransactions).where(eq(oauthTransactions.state, state));
      }
      await client.close();
    });

    function trackedState(): string {
      const state = `test-state-${randomUUID()}`;
      createdStates.push(state);
      return state;
    }

    it('creates a transaction and returns its state', async () => {
      const repository = new PostgresOAuthTransactionRepository(getClient());
      const state = trackedState();

      const created = await repository.createTransaction({
        codeVerifier: 'verifier-value',
        expiresAt: new Date(Date.now() + 600_000),
        flow: 'login',
        nonce: 'nonce-value',
        provider,
        state,
      });

      expect(created.state).toBe(state);
    });

    it('consumes a valid, unexpired transaction exactly once and returns its PKCE material', async () => {
      const repository = new PostgresOAuthTransactionRepository(getClient());
      const state = trackedState();
      await repository.createTransaction({
        codeVerifier: 'the-verifier',
        expiresAt: new Date(Date.now() + 600_000),
        flow: 'login',
        nonce: 'the-nonce',
        provider,
        state,
      });

      const consumed = await repository.consumeTransaction(provider, state, new Date());
      expect(consumed).toEqual({
        codeVerifier: 'the-verifier',
        flow: 'login',
        linkingUserId: null,
        nonce: 'the-nonce',
      });

      // Single-use: a second consume attempt (replay) must fail.
      const replay = await repository.consumeTransaction(provider, state, new Date());
      expect(replay).toBeUndefined();
    });

    it('returns undefined for an unknown state', async () => {
      const repository = new PostgresOAuthTransactionRepository(getClient());
      const result = await repository.consumeTransaction(provider, 'never-created-state', new Date());
      expect(result).toBeUndefined();
    });

    it('returns undefined (not the material) for an expired transaction', async () => {
      const repository = new PostgresOAuthTransactionRepository(getClient());
      const state = trackedState();
      await repository.createTransaction({
        codeVerifier: 'expired-verifier',
        expiresAt: new Date(Date.now() - 1_000), // already expired at creation
        flow: 'login',
        nonce: 'expired-nonce',
        provider,
        state,
      });

      const result = await repository.consumeTransaction(provider, state, new Date());
      expect(result).toBeUndefined();
    });

    it('never consumes a different provider\'s transaction with a colliding lookup', async () => {
      const repository = new PostgresOAuthTransactionRepository(getClient());
      const state = trackedState();
      await repository.createTransaction({
        codeVerifier: 'google-verifier',
        expiresAt: new Date(Date.now() + 600_000),
        flow: 'login',
        nonce: 'google-nonce',
        provider,
        state,
      });

      const result = await repository.consumeTransaction('not-google', state, new Date());
      expect(result).toBeUndefined();

      // The real provider's transaction must still be consumable afterwards.
      const stillValid = await repository.consumeTransaction(provider, state, new Date());
      expect(stillValid).toEqual({
        codeVerifier: 'google-verifier',
        flow: 'login',
        linkingUserId: null,
        nonce: 'google-nonce',
      });
    });

    it('concurrent consume attempts for the same state: exactly one succeeds', async () => {
      const repository = new PostgresOAuthTransactionRepository(getClient());
      const state = trackedState();
      await repository.createTransaction({
        codeVerifier: 'race-verifier',
        expiresAt: new Date(Date.now() + 600_000),
        flow: 'login',
        nonce: 'race-nonce',
        provider,
        state,
      });

      const [first, second] = await Promise.all([
        repository.consumeTransaction(provider, state, new Date()),
        repository.consumeTransaction(provider, state, new Date()),
      ]);

      const successes = [first, second].filter((result) => result !== undefined);
      expect(successes).toHaveLength(1);
    });
  },
);
