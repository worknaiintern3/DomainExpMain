import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { DatabaseClient } from '../src/client/database-types';
import { users, workspaceMembers, workspaces } from '../src/schema';
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
  'core tenancy schema (requires a disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Core tenancy integration client was not initialized');
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

    it('creates a user, workspace, and membership with UTC lifecycle timestamps', async () => {
      const activeClient = getClient();
      const rollbackProbe = new Error('rollback core tenancy probe');
      const suffix = randomUUID();

      await expect(
        activeClient.transaction(async (transaction) => {
          const [user] = await transaction
            .insert(users)
            .values({
              email: `Owner-${suffix}@example.test`,
              normalizedEmail: `owner-${suffix}@example.test`,
            })
            .returning();
          const [workspace] = await transaction
            .insert(workspaces)
            .values({ name: 'Core tenancy probe', slug: `core-${suffix}` })
            .returning();

          if (!user || !workspace) {
            throw new Error('Core tenancy inserts did not return their rows');
          }

          const [membership] = await transaction
            .insert(workspaceMembers)
            .values({
              role: 'owner',
              userId: user.id,
              workspaceId: workspace.id,
            })
            .returning();

          if (!membership) {
            throw new Error('Core tenancy membership insert did not return its row');
          }

          expect(user.createdAt).toBeInstanceOf(Date);
          expect(user.updatedAt).toBeInstanceOf(Date);
          expect(workspace.createdAt).toBeInstanceOf(Date);
          expect(membership).toMatchObject({
            role: 'owner',
            userId: user.id,
            workspaceId: workspace.id,
          });

          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('enforces normalized email uniqueness and canonical form', async () => {
      const normalizedEmail = `duplicate-${randomUUID()}@example.test`;

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            await transaction.insert(users).values([
              { email: normalizedEmail, normalizedEmail },
              { email: normalizedEmail.toUpperCase(), normalizedEmail },
            ]);
          }),
        '23505',
      );

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            await transaction.insert(users).values({
              email: normalizedEmail,
              normalizedEmail: normalizedEmail.toUpperCase(),
            });
          }),
        '23514',
      );
    });

    it('enforces unique workspace slugs and canonical slug form', async () => {
      const slug = `unique-${randomUUID()}`;

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            await transaction.insert(workspaces).values([
              { name: 'First workspace', slug },
              { name: 'Second workspace', slug },
            ]);
          }),
        '23505',
      );

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            await transaction
              .insert(workspaces)
              .values({ name: 'Invalid slug workspace', slug: 'Invalid Slug' });
          }),
        '23514',
      );
    });

    it('enforces one membership per user and workspace', async () => {
      const suffix = randomUUID();

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const [user] = await transaction
              .insert(users)
              .values({
                email: `member-${suffix}@example.test`,
                normalizedEmail: `member-${suffix}@example.test`,
              })
              .returning({ id: users.id });
            const [workspace] = await transaction
              .insert(workspaces)
              .values({ name: 'Membership probe', slug: `membership-${suffix}` })
              .returning({ id: workspaces.id });

            if (!user || !workspace) {
              throw new Error('Membership probe inserts did not return their IDs');
            }

            await transaction.insert(workspaceMembers).values({
              role: 'owner',
              userId: user.id,
              workspaceId: workspace.id,
            });
            await transaction.insert(workspaceMembers).values({
              role: 'member',
              userId: user.id,
              workspaceId: workspace.id,
            });
          }),
        '23505',
      );
    });

    it('enforces membership foreign keys and role values', async () => {
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            await transaction.insert(workspaceMembers).values({
              role: 'member',
              userId: randomUUID(),
              workspaceId: randomUUID(),
            });
          }),
        '23503',
      );

      const suffix = randomUUID();
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const [user] = await transaction
              .insert(users)
              .values({
                email: `role-${suffix}@example.test`,
                normalizedEmail: `role-${suffix}@example.test`,
              })
              .returning({ id: users.id });
            const [workspace] = await transaction
              .insert(workspaces)
              .values({ name: 'Role probe', slug: `role-${suffix}` })
              .returning({ id: workspaces.id });

            if (!user || !workspace) {
              throw new Error('Role probe inserts did not return their IDs');
            }

            await transaction.execute(sql`
              insert into workspace_members (id, workspace_id, user_id, role)
              values (${randomUUID()}, ${workspace.id}, ${user.id}, ${'invalid_role'})
            `);
          }),
        '22P02',
      );
    });
  },
);
