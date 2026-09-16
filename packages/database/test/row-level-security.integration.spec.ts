import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { Database, DatabaseClient } from '../src/client/database-types';
import * as schema from '../src/schema';
import { users, workspaceMembers, workspaces } from '../src/schema';
import {
  withUserContext,
  withWorkspaceContext,
} from '../src/transactions/workspace-context';
import {
  getPrivilegedRlsTestConfiguration,
  hasPrivilegedRlsTestDatabase,
} from './test-database';

const describeWithPrivilegedPostgreSql = hasPrivilegedRlsTestDatabase
  ? describe
  : describe.skip;

interface PostgreSqlErrorShape {
  readonly cause?: unknown;
  readonly code?: unknown;
}

function getPostgreSqlErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const errorShape = error as PostgreSqlErrorShape;
  if (typeof errorShape.code === 'string') {
    return errorShape.code;
  }

  return getPostgreSqlErrorCode(errorShape.cause);
}

async function expectPostgreSqlError(
  operation: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  const error = await operation().catch((operationError: unknown) => operationError);
  expect(getPostgreSqlErrorCode(error)).toBe(expectedCode);
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]+$/u.test(identifier)) {
    throw new Error('Unsafe PostgreSQL test identifier');
  }

  return `"${identifier}"`;
}

describeWithPrivilegedPostgreSql(
  'workspace row-level security (requires RLS_TEST_DATABASE_URL)',
  () => {
    const runtimeRoleName = `domainpulse_rls_test_${randomUUID().replaceAll('-', '')}`;
    const runtimeRoleIdentifier = quoteIdentifier(runtimeRoleName);
    const workspaceAId = randomUUID();
    const workspaceBId = randomUUID();
    const userAId = randomUUID();
    const userBId = randomUUID();
    const membershipAId = randomUUID();
    const membershipBId = randomUUID();
    let adminClient: DatabaseClient | undefined;
    let runtimeRoleCreated = false;
    let runtimeConnection: PoolClient | undefined;
    let runtimeDatabase: Database | undefined;

    const getAdminClient = (): DatabaseClient => {
      if (!adminClient) {
        throw new Error('RLS admin test client was not initialized');
      }

      return adminClient;
    };

    const getRuntimeDatabase = (): Database => {
      if (!runtimeDatabase) {
        throw new Error('RLS runtime test database was not initialized');
      }

      return runtimeDatabase;
    };

    beforeAll(async () => {
      adminClient = createDatabaseClient(getPrivilegedRlsTestConfiguration());
      await migrate(adminClient.database, { migrationsFolder: './migrations' });

      await adminClient.pool.query(
        `create role ${runtimeRoleIdentifier} nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls`,
      );
      runtimeRoleCreated = true;
      await adminClient.pool.query(
        `grant ${runtimeRoleIdentifier} to current_user`,
      );
      await adminClient.pool.query(
        `grant usage on schema public, domainpulse to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant execute on function domainpulse.current_workspace_id(), domainpulse.current_user_id() to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant select, insert on table users, password_credentials to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant select, insert, update on table sessions to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant select, insert, update, delete on table workspaces, workspace_members to ${runtimeRoleIdentifier}`,
      );

      await adminClient.transaction(async (transaction) => {
        await transaction.insert(workspaces).values([
          { id: workspaceAId, name: 'RLS Workspace A', slug: `rls-a-${workspaceAId}` },
          { id: workspaceBId, name: 'RLS Workspace B', slug: `rls-b-${workspaceBId}` },
        ]);
        await transaction.insert(users).values([
          {
            email: `rls-a-${userAId}@example.test`,
            id: userAId,
            normalizedEmail: `rls-a-${userAId}@example.test`,
            personalWorkspaceId: workspaceAId,
          },
          {
            email: `rls-b-${userBId}@example.test`,
            id: userBId,
            normalizedEmail: `rls-b-${userBId}@example.test`,
            personalWorkspaceId: workspaceBId,
          },
        ]);
        await transaction.insert(workspaceMembers).values([
          {
            id: membershipAId,
            role: 'owner',
            userId: userAId,
            workspaceId: workspaceAId,
          },
          {
            id: membershipBId,
            role: 'owner',
            userId: userBId,
            workspaceId: workspaceBId,
          },
        ]);
      });

      runtimeConnection = await adminClient.pool.connect();
      await runtimeConnection.query(`set role ${runtimeRoleIdentifier}`);
      runtimeDatabase = drizzle(runtimeConnection, { schema, logger: false });
    });

    afterAll(async () => {
      if (runtimeConnection) {
        await runtimeConnection.query('reset role');
        runtimeConnection.release();
      }

      if (!adminClient) {
        return;
      }

      await adminClient.database
        .delete(workspaceMembers)
        .where(eq(workspaceMembers.id, membershipAId));
      await adminClient.database
        .delete(workspaceMembers)
        .where(eq(workspaceMembers.id, membershipBId));
      await adminClient.database.delete(users).where(eq(users.id, userAId));
      await adminClient.database.delete(users).where(eq(users.id, userBId));
      await adminClient.database
        .delete(workspaces)
        .where(eq(workspaces.id, workspaceAId));
      await adminClient.database
        .delete(workspaces)
        .where(eq(workspaces.id, workspaceBId));

      if (runtimeRoleCreated) {
        await adminClient.pool.query(`drop owned by ${runtimeRoleIdentifier}`);
        await adminClient.pool.query(
          `revoke ${runtimeRoleIdentifier} from current_user`,
        );
        await adminClient.pool.query(`drop role ${runtimeRoleIdentifier}`);
      }
      await adminClient.close();
    });

    it('uses a non-owner runtime role with RLS enabled and no bypass privileges', async () => {
      const admin = getAdminClient();
      const roleResult = await admin.pool.query<{
        bypassRls: boolean;
        superuser: boolean;
      }>(
        'select rolbypassrls as "bypassRls", rolsuper as "superuser" from pg_roles where rolname = $1',
        [runtimeRoleName],
      );
      const tableResult = await admin.pool.query<{
        forceRls: boolean;
        ownerName: string;
        rlsEnabled: boolean;
        tableName: string;
      }>(
        `select c.relname as "tableName", c.relrowsecurity as "rlsEnabled", c.relforcerowsecurity as "forceRls", pg_get_userbyid(c.relowner) as "ownerName"
         from pg_class c
         where c.oid in ('public.workspaces'::regclass, 'public.workspace_members'::regclass)
         order by c.relname`,
      );

      expect(roleResult.rows[0]).toEqual({
        bypassRls: false,
        superuser: false,
      });
      expect(tableResult.rows.map(({ tableName }) => tableName)).toEqual([
        'workspace_members',
        'workspaces',
      ]);
      for (const table of tableResult.rows) {
        expect(table.rlsEnabled).toBe(true);
        expect(table.forceRls).toBe(false);
        expect(table.ownerName).not.toBe(runtimeRoleName);
      }
    });

    it('isolates workspace and membership reads in both directions', async () => {
      const database = getRuntimeDatabase();

      const rowsForA = await withWorkspaceContext(
        database,
        workspaceAId,
        async (transaction) => ({
          members: await transaction.select().from(workspaceMembers),
          workspaces: await transaction.select().from(workspaces),
        }),
      );
      const rowsForB = await withWorkspaceContext(
        database,
        workspaceBId,
        async (transaction) => ({
          members: await transaction.select().from(workspaceMembers),
          workspaces: await transaction.select().from(workspaces),
        }),
      );

      expect(rowsForA.workspaces.map(({ id }) => id)).toEqual([workspaceAId]);
      expect(rowsForA.members.map(({ id }) => id)).toEqual([membershipAId]);
      expect(rowsForB.workspaces.map(({ id }) => id)).toEqual([workspaceBId]);
      expect(rowsForB.members.map(({ id }) => id)).toEqual([membershipBId]);
    });

    it('allows only the authenticated user membership bootstrap path', async () => {
      const database = getRuntimeDatabase();
      const membershipsForA = await withUserContext(
        database,
        userAId,
        (transaction) => transaction.select().from(workspaceMembers),
      );
      const membershipsForB = await withUserContext(
        database,
        userBId,
        (transaction) => transaction.select().from(workspaceMembers),
      );

      expect(membershipsForA.map(({ id }) => id)).toEqual([membershipAId]);
      expect(membershipsForB.map(({ id }) => id)).toEqual([membershipBId]);
    });

    it('fails closed when workspace context is missing or invalid', async () => {
      const database = getRuntimeDatabase();
      const missingWorkspaces = await database.select().from(workspaces);
      const missingMembers = await database.select().from(workspaceMembers);

      expect(missingWorkspaces).toHaveLength(0);
      expect(missingMembers).toHaveLength(0);

      await database.transaction(async (transaction) => {
        await transaction.execute(
          sql`select set_config('domainpulse.workspace_id', 'invalid', true)`,
        );
        await expect(transaction.select().from(workspaces)).resolves.toHaveLength(0);
        await expect(transaction.select().from(workspaceMembers)).resolves.toHaveLength(0);
      });
      await database.transaction(async (transaction) => {
        await transaction.execute(
          sql`select set_config('domainpulse.user_id', 'invalid', true)`,
        );
        await expect(transaction.select().from(workspaceMembers)).resolves.toHaveLength(0);
      });
    });

    it('blocks cross-tenant insert, update, and delete operations', async () => {
      const database = getRuntimeDatabase();

      await expectPostgreSqlError(
        () =>
          withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction.insert(workspaces).values({
              id: randomUUID(),
              name: 'Cross-tenant insert probe',
              slug: `rls-cross-${randomUUID()}`,
            }),
          ),
        '42501',
      );
      await expectPostgreSqlError(
        () =>
          withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction.insert(workspaceMembers).values({
              role: 'member',
              userId: userAId,
              workspaceId: workspaceBId,
            }),
          ),
        '42501',
      );
      await expectPostgreSqlError(
        () =>
          withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction
              .update(workspaceMembers)
              .set({ workspaceId: workspaceBId })
              .where(eq(workspaceMembers.id, membershipAId)),
          ),
        '42501',
      );

      const updatedWorkspace = await withWorkspaceContext(
        database,
        workspaceAId,
        (transaction) =>
          transaction
            .update(workspaces)
            .set({ name: 'Unauthorized update' })
            .where(eq(workspaces.id, workspaceBId))
            .returning({ id: workspaces.id }),
      );
      const deletedMembership = await withWorkspaceContext(
        database,
        workspaceAId,
        (transaction) =>
          transaction
            .delete(workspaceMembers)
            .where(eq(workspaceMembers.id, membershipBId))
            .returning({ id: workspaceMembers.id }),
      );
      const deletedWorkspace = await withWorkspaceContext(
        database,
        workspaceAId,
        (transaction) =>
          transaction
            .delete(workspaces)
            .where(eq(workspaces.id, workspaceBId))
            .returning({ id: workspaces.id }),
      );
      expect(updatedWorkspace).toHaveLength(0);
      expect(deletedMembership).toHaveLength(0);
      expect(deletedWorkspace).toHaveLength(0);
    });

    it('permits same-tenant membership mutations', async () => {
      const database = getRuntimeDatabase();
      const probeMembershipId = randomUUID();
      const rollbackProbe = new Error('expected same-tenant write rollback');

      await expect(
        withWorkspaceContext(database, workspaceAId, async (transaction) => {
          await transaction.insert(workspaceMembers).values({
            id: probeMembershipId,
            role: 'member',
            userId: userBId,
            workspaceId: workspaceAId,
          });
          const updated = await transaction
            .update(workspaceMembers)
            .set({ role: 'admin' })
            .where(eq(workspaceMembers.id, probeMembershipId))
            .returning({ role: workspaceMembers.role });
          const deleted = await transaction
            .delete(workspaceMembers)
            .where(eq(workspaceMembers.id, probeMembershipId))
            .returning({ id: workspaceMembers.id });

          expect(updated).toEqual([{ role: 'admin' }]);
          expect(deleted).toEqual([{ id: probeMembershipId }]);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('does not leak context after commit, rollback, or pooled-session reuse', async () => {
      const database = getRuntimeDatabase();

      await withWorkspaceContext(database, workspaceAId, (transaction) =>
        transaction.select().from(workspaces),
      );
      await expect(database.select().from(workspaces)).resolves.toHaveLength(0);

      await expect(
        withWorkspaceContext(database, workspaceAId, async (transaction) => {
          await transaction.select().from(workspaces);
          throw new Error('expected RLS rollback probe');
        }),
      ).rejects.toThrow('expected RLS rollback probe');
      await expect(database.select().from(workspaces)).resolves.toHaveLength(0);

      const rowsForB = await withWorkspaceContext(
        database,
        workspaceBId,
        (transaction) => transaction.select().from(workspaces),
      );
      expect(rowsForB.map(({ id }) => id)).toEqual([workspaceBId]);
      await expect(database.select().from(workspaces)).resolves.toHaveLength(0);
    });
  },
);
