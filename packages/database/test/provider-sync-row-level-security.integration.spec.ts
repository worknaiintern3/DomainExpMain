import { createHash, randomUUID } from 'node:crypto';

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
  cloudResources,
  domains,
  projects,
  providerAccounts,
  providerConnections,
  providerResourceLinks,
  providerSyncRuns,
  servers,
  websiteApplications,
  workspaces,
} from '../src/schema';
import { withWorkspaceContext } from '../src/transactions/workspace-context';
import { createInventoryGraphFixture } from './inventory-graph-test-data';
import { expectPostgresErrorCode } from './postgres-error';
import {
  getPrivilegedRlsTestConfiguration,
  hasPrivilegedRlsTestDatabase,
} from './test-database';

const describeWithPrivilegedPostgreSql = hasPrivilegedRlsTestDatabase
  ? describe
  : describe.skip;
const tableNames = ['provider_sync_runs', 'provider_resource_links'] as const;

interface Fixture {
  readonly connectionId: string;
  readonly domainNodeId: string;
  readonly runId: string;
  readonly workspaceId: string;
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

function internalIdempotencyKey(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function insertFixture(
  transaction: DatabaseTransaction,
  workspaceId: string,
  label: string,
): Promise<Fixture> {
  const graph = await createInventoryGraphFixture(transaction, workspaceId, label);
  const connectionId = randomUUID();
  const material = envelope();
  await transaction.insert(providerConnections).values({
    authType: 'CLOUDFLARE_API_TOKEN',
    credentialMask: '••••1234',
    encryptedCiphertext: material.ciphertextBase64,
    encryptionAuthTag: material.authTagBase64,
    encryptionIv: material.ivBase64,
    id: connectionId,
    keyVersion: 1,
    providerAccountId: graph.providerAccountId,
    workspaceId,
  });
  const now = new Date();
  const [run] = await transaction
    .insert(providerSyncRuns)
    .values({
      connectionId,
      idempotencyKey: internalIdempotencyKey(`rls:${label}`),
      trigger: 'INITIAL',
      workspaceId,
    })
    .returning({ id: providerSyncRuns.id });
  if (!run) throw new Error('RLS fixture sync run was not created');
  await transaction.insert(providerResourceLinks).values({
    connectionId,
    entityKind: 'DOMAIN',
    externalResourceId: `zone-${label}`,
    externalResourceType: 'zone',
    lastSeenAt: now,
    lastSyncedAt: now,
    nodeId: graph.domainNodeId,
    workspaceId,
  });
  return {
    connectionId,
    domainNodeId: graph.domainNodeId,
    runId: run.id,
    workspaceId,
  };
}

describeWithPrivilegedPostgreSql(
  'provider sync runtime RLS (requires dedicated RLS_TEST_DATABASE_URL)',
  () => {
    const runtimeRoleName = `domainpulse_sync_rls_${randomUUID().replaceAll('-', '')}`;
    const runtimeRoleIdentifier = quoteIdentifier(runtimeRoleName);
    const workerRoleName = `domainpulse_sync_worker_rls_${randomUUID().replaceAll('-', '')}`;
    const workerRoleIdentifier = quoteIdentifier(workerRoleName);
    const workspaceAId = randomUUID();
    const workspaceBId = randomUUID();
    let adminClient: DatabaseClient | undefined;
    let fixtureA: Fixture | undefined;
    let fixtureB: Fixture | undefined;
    let runtimeConnection: PoolClient | undefined;
    let runtimeDatabase: Database | undefined;
    let runtimeRoleCreated = false;
    let workerRoleCreated = false;

    const getAdmin = (): DatabaseClient => {
      if (!adminClient) throw new Error('Sync RLS admin was not initialized');
      return adminClient;
    };
    const getRuntime = (): Database => {
      if (!runtimeDatabase) throw new Error('Sync RLS runtime was not initialized');
      return runtimeDatabase;
    };
    const getFixtureA = (): Fixture => {
      if (!fixtureA) throw new Error('Sync RLS workspace A fixture is missing');
      return fixtureA;
    };
    const getFixtureB = (): Fixture => {
      if (!fixtureB) throw new Error('Sync RLS workspace B fixture is missing');
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

      await adminClient.pool.query(
        `create role ${workerRoleIdentifier} nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls`,
      );
      workerRoleCreated = true;
      await adminClient.pool.query(`grant ${workerRoleIdentifier} to current_user`);
      await adminClient.pool.query(
        `grant usage on schema public, domainpulse to ${workerRoleIdentifier}`,
      );
      for (const signature of [
        'domainpulse.schedule_due_provider_sync_runs(timestamp with time zone, integer)',
        'domainpulse.claim_provider_sync_runs(timestamp with time zone, integer, integer)',
        'domainpulse.reclaim_expired_provider_sync_runs(timestamp with time zone, integer, integer)',
      ]) {
        await adminClient.pool.query(
          `grant execute on function ${signature} to ${workerRoleIdentifier}`,
        );
      }
      await adminClient.pool.query(
        `grant select on table provider_sync_runs to ${workerRoleIdentifier}`,
      );

      await adminClient.transaction(async (transaction) => {
        await transaction.insert(workspaces).values([
          {
            id: workspaceAId,
            name: 'Sync RLS Workspace A',
            slug: `sync-rls-a-${workspaceAId}`,
          },
          {
            id: workspaceBId,
            name: 'Sync RLS Workspace B',
            slug: `sync-rls-b-${workspaceBId}`,
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
        await adminClient.database.delete(providerResourceLinks).where(eq(providerResourceLinks.workspaceId, workspaceId));
        await adminClient.database.delete(providerSyncRuns).where(eq(providerSyncRuns.workspaceId, workspaceId));
        await adminClient.database.delete(providerConnections).where(eq(providerConnections.workspaceId, workspaceId));
        // Canonical inventory dependency order: graph children reference
        // providerAccounts through RESTRICT foreign keys, so they go first.
        await adminClient.database.delete(websiteApplications).where(eq(websiteApplications.workspaceId, workspaceId));
        await adminClient.database.delete(cloudResources).where(eq(cloudResources.workspaceId, workspaceId));
        await adminClient.database.delete(servers).where(eq(servers.workspaceId, workspaceId));
        await adminClient.database.delete(domains).where(eq(domains.workspaceId, workspaceId));
        await adminClient.database.delete(projects).where(eq(projects.workspaceId, workspaceId));
        await adminClient.database.delete(providerAccounts).where(eq(providerAccounts.workspaceId, workspaceId));
        await adminClient.database.delete(workspaces).where(eq(workspaces.id, workspaceId));
      }
      if (runtimeRoleCreated) {
        await adminClient.pool.query(`revoke ${runtimeRoleIdentifier} from current_user`);
        await adminClient.pool.query(`drop owned by ${runtimeRoleIdentifier}`);
        await adminClient.pool.query(`drop role ${runtimeRoleIdentifier}`);
      }
      if (workerRoleCreated) {
        await adminClient.pool.query(`revoke ${workerRoleIdentifier} from current_user`);
        await adminClient.pool.query(`drop owned by ${workerRoleIdentifier}`);
        await adminClient.pool.query(`drop role ${workerRoleIdentifier}`);
      }
      await adminClient.close();
    });

    it('enables RLS on both tables for a non-owner NOBYPASSRLS runtime role', async () => {
      const admin = getAdmin();
      const roleResult = await admin.pool.query<{ bypassRls: boolean; superuser: boolean }>(
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
      expect(tableResult.rows).toHaveLength(2);
      for (const table of tableResult.rows) {
        expect(table.rlsEnabled).toBe(true);
        expect(table.ownerName).not.toBe(runtimeRoleName);
      }
    });

    it('fails closed without workspace context on both tables', async () => {
      const database = getRuntime();
      expect(await database.select({ id: providerSyncRuns.id }).from(providerSyncRuns)).toEqual([]);
      expect(
        await database.select({ id: providerResourceLinks.id }).from(providerResourceLinks),
      ).toEqual([]);
    });

    it('allows workspace A rows and hides workspace B rows for both tables', async () => {
      const fixture = getFixtureA();
      const rows = await withWorkspaceContext(getRuntime(), fixture.workspaceId, async (transaction) => ({
        links: await transaction
          .select({ id: providerResourceLinks.id })
          .from(providerResourceLinks),
        runs: await transaction.select({ id: providerSyncRuns.id }).from(providerSyncRuns),
      }));
      expect(rows.runs).toEqual([{ id: fixture.runId }]);
      expect(rows.links).toHaveLength(1);
    });

    it('blocks cross-workspace writes on provider_sync_runs and provider_resource_links', async () => {
      const a = getFixtureA();
      const b = getFixtureB();
      await expectPostgresErrorCode(
        () =>
          withWorkspaceContext(getRuntime(), a.workspaceId, (transaction) =>
            transaction.insert(providerSyncRuns).values({
              connectionId: b.connectionId,
              idempotencyKey: internalIdempotencyKey('cross-workspace-attempt'),
              trigger: 'MANUAL',
              workspaceId: b.workspaceId,
            }),
          ),
        '42501',
      );
      const updated = await withWorkspaceContext(getRuntime(), a.workspaceId, (transaction) =>
        transaction
          .update(providerResourceLinks)
          .set({ status: 'MISSING_FROM_PROVIDER', missingSince: new Date() })
          .where(eq(providerResourceLinks.connectionId, b.connectionId))
          .returning({ id: providerResourceLinks.id }),
      );
      expect(updated).toHaveLength(0);
    });

    it('lets the dedicated worker role use only its granted definer functions, never direct global reads', async () => {
      const now = new Date();
      // The fixture INITIAL run is QUEUED, which blocks scheduling for its own
      // connection, and the fixture connection is PENDING, which the scheduler
      // also skips: schedule_due requires validation_status = 'VALID',
      // next_sync_at <= now, and no QUEUED/RUNNING run. Establish all three
      // preconditions explicitly so the connection is genuinely due. The admin
      // pool has a free slot here because only the runtime connection is held.
      await getAdmin().database
        .delete(providerSyncRuns)
        .where(eq(providerSyncRuns.id, getFixtureA().runId));
      await getAdmin().database
        .update(providerConnections)
        .set({
          lastValidatedAt: now,
          nextSyncAt: new Date(now.getTime() - 1_000),
          validationStatus: 'VALID',
        })
        .where(eq(providerConnections.id, getFixtureA().connectionId));

      // Checked out lazily: holding this for the whole file would starve the
      // single remaining admin-pool slot and time out admin queries.
      const workerConnection = await getAdmin().pool.connect();
      try {
        await workerConnection.query(`set role ${workerRoleIdentifier}`);
        const scheduled = await workerConnection.query<Record<string, unknown>>(
          'select * from domainpulse.schedule_due_provider_sync_runs($1, $2)',
          [now, 10],
        );
        expect(scheduled.rows.length).toBeGreaterThanOrEqual(1);
        expect(Object.keys(scheduled.rows[0] ?? {}).sort()).toEqual([
          'connection_id',
          'run_id',
          'workspace_id',
        ]);

        await expectPostgresErrorCode(
          () => workerConnection.query('select id from provider_sync_runs'),
          '42501',
        );
      } finally {
        await workerConnection.query('reset role');
        workerConnection.release();
      }
    });
  },
);
