import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { DatabaseClient } from '../src/client/database-types';
import { passwordCredentials, sessions, users } from '../src/schema';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

async function expectPostgreSqlError(
  operation: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await operation();
    throw new Error(`Expected PostgreSQL error ${expectedCode}`);
  } catch (error) {
    expect(getPostgreSqlErrorCode(error)).toBe(expectedCode);
  }
}

function getPostgreSqlErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const errorRecord = error as { cause?: unknown; code?: unknown };
  if (typeof errorRecord.code === 'string') {
    return errorRecord.code;
  }

  return getPostgreSqlErrorCode(errorRecord.cause);
}

describeWithPostgreSql(
  'auth and session persistence (requires a disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Auth persistence integration client was not initialized');
      }

      return client;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: './migrations' });
    });

    afterAll(async () => {
      await client?.close();
    });

    it('stores only password and refresh-token hashes with UTC timestamps', async () => {
      const rollbackProbe = new Error('rollback auth persistence probe');
      const suffix = randomUUID();

      await expect(
        getClient().transaction(async (transaction) => {
          const [user] = await transaction
            .insert(users)
            .values({
              email: `auth-${suffix}@example.test`,
              normalizedEmail: `auth-${suffix}@example.test`,
            })
            .returning({ id: users.id });

          if (!user) {
            throw new Error('Auth persistence user insert did not return an ID');
          }

          const [credential] = await transaction
            .insert(passwordCredentials)
            .values({
              passwordHash: `test-password-hash-${suffix}`,
              userId: user.id,
            })
            .returning();
          const [session] = await transaction
            .insert(sessions)
            .values({
              expiresAt: new Date(Date.now() + 60_000),
              lastSeenAt: new Date(),
              refreshTokenHash: `test-refresh-token-hash-${suffix}`,
              userId: user.id,
            })
            .returning();

          expect(credential).toMatchObject({ userId: user.id });
          expect(credential?.passwordUpdatedAt).toBeInstanceOf(Date);
          expect(credential?.createdAt).toBeInstanceOf(Date);
          expect(session).toMatchObject({
            revokedAt: null,
            userId: user.id,
          });
          expect(session?.expiresAt).toBeInstanceOf(Date);
          expect(session?.lastSeenAt).toBeInstanceOf(Date);

          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('enforces one password credential per user and credential ownership', async () => {
      const suffix = randomUUID();

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const [user] = await transaction
              .insert(users)
              .values({
                email: `credential-${suffix}@example.test`,
                normalizedEmail: `credential-${suffix}@example.test`,
              })
              .returning({ id: users.id });

            if (!user) {
              throw new Error('Credential uniqueness user insert failed');
            }

            await transaction.insert(passwordCredentials).values({
              passwordHash: `test-password-hash-a-${suffix}`,
              userId: user.id,
            });
            await transaction.insert(passwordCredentials).values({
              passwordHash: `test-password-hash-b-${suffix}`,
              userId: user.id,
            });
          }),
        '23505',
      );

      await expectPostgreSqlError(
        () =>
          getClient().database.insert(passwordCredentials).values({
            passwordHash: `test-password-hash-orphan-${suffix}`,
            userId: randomUUID(),
          }),
        '23503',
      );
    });

    it('enforces unique refresh-token hashes and session ownership', async () => {
      const suffix = randomUUID();
      const refreshTokenHash = `test-refresh-token-hash-${suffix}`;

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const [user] = await transaction
              .insert(users)
              .values({
                email: `session-${suffix}@example.test`,
                normalizedEmail: `session-${suffix}@example.test`,
              })
              .returning({ id: users.id });

            if (!user) {
              throw new Error('Session uniqueness user insert failed');
            }

            await transaction.insert(sessions).values([
              {
                expiresAt: new Date(Date.now() + 60_000),
                refreshTokenHash,
                userId: user.id,
              },
              {
                expiresAt: new Date(Date.now() + 120_000),
                refreshTokenHash,
                userId: user.id,
              },
            ]);
          }),
        '23505',
      );

      await expectPostgreSqlError(
        () =>
          getClient().database.insert(sessions).values({
            expiresAt: new Date(Date.now() + 60_000),
            refreshTokenHash: `test-refresh-token-hash-orphan-${suffix}`,
            userId: randomUUID(),
          }),
        '23503',
      );
    });

    it('rejects blank hashes and sessions that do not outlive creation', async () => {
      const suffix = randomUUID();

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const [user] = await transaction
              .insert(users)
              .values({
                email: `blank-hash-${suffix}@example.test`,
                normalizedEmail: `blank-hash-${suffix}@example.test`,
              })
              .returning({ id: users.id });

            if (!user) {
              throw new Error('Blank hash user insert failed');
            }

            await transaction.insert(passwordCredentials).values({
              passwordHash: '   ',
              userId: user.id,
            });
          }),
        '23514',
      );

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const [user] = await transaction
              .insert(users)
              .values({
                email: `blank-token-${suffix}@example.test`,
                normalizedEmail: `blank-token-${suffix}@example.test`,
              })
              .returning({ id: users.id });

            if (!user) {
              throw new Error('Blank token user insert failed');
            }

            await transaction.insert(sessions).values({
              expiresAt: new Date(Date.now() + 60_000),
              refreshTokenHash: '   ',
              userId: user.id,
            });
          }),
        '23514',
      );

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const [user] = await transaction
              .insert(users)
              .values({
                email: `expired-${suffix}@example.test`,
                normalizedEmail: `expired-${suffix}@example.test`,
              })
              .returning({ id: users.id });

            if (!user) {
              throw new Error('Expired session user insert failed');
            }

            await transaction.insert(sessions).values({
              expiresAt: new Date(0),
              refreshTokenHash: `test-expired-token-hash-${suffix}`,
              userId: user.id,
            });
          }),
        '23514',
      );
    });

    it('cascades auth-only records when their owning user is deleted', async () => {
      const rollbackProbe = new Error('rollback auth cascade probe');
      const suffix = randomUUID();

      await expect(
        getClient().transaction(async (transaction) => {
          const [user] = await transaction
            .insert(users)
            .values({
              email: `cascade-${suffix}@example.test`,
              normalizedEmail: `cascade-${suffix}@example.test`,
            })
            .returning({ id: users.id });

          if (!user) {
            throw new Error('Auth cascade user insert failed');
          }

          await transaction.insert(passwordCredentials).values({
            passwordHash: `test-password-hash-${suffix}`,
            userId: user.id,
          });
          await transaction.insert(sessions).values({
            expiresAt: new Date(Date.now() + 60_000),
            refreshTokenHash: `test-refresh-token-hash-${suffix}`,
            userId: user.id,
          });
          await transaction.delete(users).where(eq(users.id, user.id));

          const [credentialCount] = await transaction
            .select({ count: sql<number>`count(*)::int` })
            .from(passwordCredentials)
            .where(eq(passwordCredentials.userId, user.id));
          const [sessionCount] = await transaction
            .select({ count: sql<number>`count(*)::int` })
            .from(sessions)
            .where(eq(sessions.userId, user.id));

          expect(credentialCount?.count).toBe(0);
          expect(sessionCount?.count).toBe(0);

          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });
  },
);
