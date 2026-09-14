import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type {
  Database,
  DatabaseClient,
  DatabaseTransaction,
} from '../src/client/database-types';
import * as schema from '../src/schema';
import {
  providerAccounts,
  providerConnections,
  workspaces,
} from '../src/schema';
import { withWorkspaceContext } from '../src/transactions/workspace-context';
import {
  getPrivilegedRlsTestConfiguration,
  hasPrivilegedRlsTestDatabase,
} from './test-database';

const describeWithPrivilegedPostgreSql = hasPrivilegedRlsTestDatabase
  ? describe
  : describe.skip;
const tableNames = ['provider_connections'] as const;

interface Fixture {
  readonly connectionId: string;
  readonly providerAccountId: string;
  readonly secondaryProviderAccountId: string;
  readonly workspaceId: string;
}

interface PostgreSqlErrorShape {
  readonly cause?: unknown;
  readonly code?: unknown;
}

function getPostgreSqlErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const shape = error as PostgreSqlErrorShape;
  return typeof shape.code === 'string'
    ? shape.code
    : getPostgreSqlErrorCode(shape.cause);
}

async function expectPostgreSqlError(
  operation: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  const error = await operation().catch((caught: unknown) => caught);
  expect(getPostgreSqlErrorCode(error)).toBe(expectedCode);
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]+$/u.test(identifier)) {
    throw new Error('Unsafe PostgreSQL test identifier');
  }
  return `"${identifier}"`;
}

function envelope() {
  return {
    authTagBase64: Buffer.alloc(16, 9).toString('base64'),
    ciphertextBase64: Buffer.alloc(32, 1).toString('base64'),
    ivBase64: Buffer.alloc(12, 7).toString('base64'),
  };
}

async function insertFixture(
  transaction: DatabaseTransaction,
  workspaceId: string,
  label: string,
): Promise<Fixture> {
  const providerAccountId = randomUUID();
  const secondaryProviderAccountId = randomUUID();
  const connectionId = randomUUID();
  const material = envelope();
  await transaction.insert(providerAccounts).values([
    {
      id: providerAccountId,
      label: `RLS ${label} provider`,
      provenance: 'USER_ADDED',
      providerKey: 'cloudflare',
      workspaceId,
    },
    {
      id: secondaryProviderAccountId,
      label: `RLS ${label} secondary provider`,
      provenance: 'USER_ADDED',
      providerKey: 'cloudflare',
      workspaceId,
    },
  ]);
  await transaction.insert(providerConnections).values({
    authType: 'CLOUDFLARE_API_TOKEN',
    credentialMask: '••••1234',
    encryptedCiphertext: material.ciphertextBase64,
    encryptionAuthTag: material.authTagBase64,
    encryptionIv: material.ivBase64,
    id: connectionId,
    keyVersion: 1,
    providerAccountId,
    workspaceId,
  });
  return { connectionId, providerAccountId, secondaryProviderAccountId, workspaceId };
}

describeWithPrivilegedPostgreSql(
  'provider connections RLS (requires dedicated RLS_TEST_DATABASE_URL)',
  () => {
    const runtimeRoleName = `domainpulse_connections_rls_${randomUUID().replaceAll('-', '')}`;
    const runtimeRoleIdentifier = quoteIdentifier(runtimeRoleName);
    const workspaceAId = randomUUID();
    const workspaceBId = randomUUID();
    let adminClient: DatabaseClient | undefined;
    let fixtureA: Fixture | undefined;
    let fixtureB: Fixture | undefined;
    let runtimeConnection: PoolClient | undefined;
    let runtimeDatabase: Database | undefined;
    let runtimeRoleCreated = false;

    const getAdmin = (): DatabaseClient => {
      if (!adminClient) throw new Error('Connections RLS admin was not initialized');
      return adminClient;
    };
    const getRuntime = (): Database => {
      if (!runtimeDatabase) throw new Error('Connections RLS runtime was not initialized');
      return runtimeDatabase;
    };
    const getFixtureA = (): Fixture => {
      if (!fixtureA) throw new Error('Connections workspace A fixture is missing');
      return fixtureA;
    };
    const getFixtureB = (): Fixture => {
      if (!fixtureB) throw new Error('Connections workspace B fixture is missing');
      return fixtureB;
    };

    beforeAll(async () => {
      adminClient = createDatabaseClient(getPrivilegedRlsTestConfiguration());
      await migrate(adminClient.database, { migrationsFolder: './migrations' });
      await adminClient.pool.query(
        `create role ${runtimeRoleIdentifier} nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls`,
      );
      runtimeRoleCreated = true;
      await adminClient.pool.query(`grant ${runtimeRoleIdentifier} to current_user`);
      await adminClient.pool.query(
        `grant usage on schema public, domainpulse to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant execute on function domainpulse.current_workspace_id() to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant select, insert, update, delete on table ${tableNames.map(quoteIdentifier).join(', ')} to ${runtimeRoleIdentifier}`,
      );
      await adminClient.transaction(async (transaction) => {
        await transaction.insert(workspaces).values([
          {
            id: workspaceAId,
            name: 'Connections RLS Workspace A',
            slug: `connections-rls-a-${workspaceAId}`,
          },
          {
            id: workspaceBId,
            name: 'Connections RLS Workspace B',
            slug: `connections-rls-b-${workspaceBId}`,
          },
        ]);
        fixtureA = await insertFixture(transaction, workspaceAId, 'a');
        fixtureB = await insertFixture(transaction, workspaceBId, 'b');
      });
      runtimeConnection = await adminClient.pool.connect();
      await runtimeConnection.query(`set role ${runtimeRoleIdentifier}`);
      runtimeDatabase = drizzle(runtimeConnection, { logger: false, schema });
    });

    afterAll(async () => {
      if (runtimeConnection) {
        await runtimeConnection.query('reset role');
        runtimeConnection.release();
      }
      if (!adminClient) return;
      for (const workspaceId of [workspaceAId, workspaceBId]) {
        await adminClient.database
          .delete(providerConnections)
          .where(eq(providerConnections.workspaceId, workspaceId));
        await adminClient.database
          .delete(providerAccounts)
          .where(eq(providerAccounts.workspaceId, workspaceId));
        await adminClient.database
          .delete(workspaces)
          .where(eq(workspaces.id, workspaceId));
      }
      if (runtimeRoleCreated) {
        await adminClient.pool.query(
          `revoke ${runtimeRoleIdentifier} from current_user`,
        );
        await adminClient.pool.query(`drop owned by ${runtimeRoleIdentifier}`);
        await adminClient.pool.query(`drop role ${runtimeRoleIdentifier}`);
      }
      await adminClient.close();
    });

    it('enables RLS for a non-owner NOBYPASSRLS role', async () => {
      const admin = getAdmin();
      const roleResult = await admin.pool.query<{
        bypassRls: boolean;
        superuser: boolean;
      }>(
        'select rolbypassrls as "bypassRls", rolsuper as "superuser" from pg_roles where rolname = $1',
        [runtimeRoleName],
      );
      const tableResult = await admin.pool.query<{
        ownerName: string;
        rlsEnabled: boolean;
        tableName: string;
      }>(
        `select c.relname as "tableName", c.relrowsecurity as "rlsEnabled", pg_get_userbyid(c.relowner) as "ownerName"
         from pg_class c
         where c.oid in (${tableNames.map((name) => `'public.${name}'::regclass`).join(', ')})
         order by c.relname`,
      );
      expect(roleResult.rows[0]).toEqual({ bypassRls: false, superuser: false });
      expect(tableResult.rows.map(({ tableName }) => tableName)).toEqual(
        tableNames,
      );
      for (const table of tableResult.rows) {
        expect(table.rlsEnabled).toBe(true);
        expect(table.ownerName).not.toBe(runtimeRoleName);
      }
    });

    it('fails closed without workspace context', async () => {
      const database = getRuntime();
      const rows = await database
        .select({ id: providerConnections.id })
        .from(providerConnections);
      expect(rows).toEqual([]);
      const fixture = getFixtureA();
      const material = envelope();
      await expectPostgreSqlError(
        () =>
          database.insert(providerConnections).values({
            authType: 'CLOUDFLARE_API_TOKEN',
            credentialMask: '••••9999',
            encryptedCiphertext: material.ciphertextBase64,
            encryptionAuthTag: material.authTagBase64,
            encryptionIv: material.ivBase64,
            keyVersion: 1,
            providerAccountId: fixture.secondaryProviderAccountId,
            workspaceId: fixture.workspaceId,
          }),
        '42501',
      );
    });

    it('allows workspace A records and hides workspace B records', async () => {
      const fixture = getFixtureA();
      const rows = await withWorkspaceContext(
        getRuntime(),
        fixture.workspaceId,
        async (transaction) =>
          transaction
            .select({ id: providerConnections.id })
            .from(providerConnections),
      );
      expect(rows).toEqual([{ id: fixture.connectionId }]);
    });

    it('allows same-workspace inserts on the protected table', async () => {
      const fixture = getFixtureA();
      const rollbackProbe = new Error('rollback same-workspace connection write');
      const material = envelope();
      await expect(
        withWorkspaceContext(getRuntime(), fixture.workspaceId, async (transaction) => {
          await transaction.insert(providerConnections).values({
            authType: 'CLOUDFLARE_API_TOKEN',
            credentialMask: '••••4321',
            encryptedCiphertext: material.ciphertextBase64,
            encryptionAuthTag: material.authTagBase64,
            encryptionIv: material.ivBase64,
            keyVersion: 1,
            providerAccountId: fixture.secondaryProviderAccountId,
            workspaceId: fixture.workspaceId,
          });
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('blocks workspace A writes to workspace B rows', async () => {
      const a = getFixtureA();
      const b = getFixtureB();
      const material = envelope();
      await expectPostgreSqlError(
        () =>
          withWorkspaceContext(getRuntime(), a.workspaceId, (transaction) =>
            transaction.insert(providerConnections).values({
              authType: 'CLOUDFLARE_API_TOKEN',
              credentialMask: '••••0000',
              encryptedCiphertext: material.ciphertextBase64,
              encryptionAuthTag: material.authTagBase64,
              encryptionIv: material.ivBase64,
              keyVersion: 1,
              providerAccountId: b.secondaryProviderAccountId,
              workspaceId: b.workspaceId,
            }),
          ),
        '42501',
      );
      const updates = await withWorkspaceContext(
        getRuntime(),
        a.workspaceId,
        async (transaction) => ({
          updated: await transaction
            .update(providerConnections)
            .set({ credentialMask: '••••0000' })
            .where(eq(providerConnections.id, b.connectionId))
            .returning({ id: providerConnections.id }),
          deleted: await transaction
            .delete(providerConnections)
            .where(eq(providerConnections.id, b.connectionId))
            .returning({ id: providerConnections.id }),
        }),
      );
      expect(updates.updated).toHaveLength(0);
      expect(updates.deleted).toHaveLength(0);
    });
  },
);
