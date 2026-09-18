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
  alertEvents,
  alertRules,
  domains,
  monitoringRuns,
  monitoringTargets,
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
const tableNames = [
  'alert_events',
  'alert_rules',
  'monitoring_runs',
  'monitoring_targets',
] as const;

interface Fixture {
  readonly domainId: string;
  readonly eventId: string;
  readonly ruleId: string;
  readonly runId: string;
  readonly secondaryDomainId: string;
  readonly targetId: string;
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

async function insertFixture(
  transaction: DatabaseTransaction,
  workspaceId: string,
  label: string,
): Promise<Fixture> {
  const domainId = randomUUID();
  const secondaryDomainId = randomUUID();
  const targetId = randomUUID();
  const runId = randomUUID();
  const ruleId = randomUUID();
  const eventId = randomUUID();
  await transaction.insert(domains).values([
    {
      domainName: `${label}-${domainId}.example`,
      id: domainId,
      normalizedDomainName: `${label}-${domainId}.example`,
      provenance: 'USER_ADDED',
      workspaceId,
    },
    {
      domainName: `${label}-${secondaryDomainId}.example`,
      id: secondaryDomainId,
      normalizedDomainName: `${label}-${secondaryDomainId}.example`,
      provenance: 'USER_ADDED',
      workspaceId,
    },
  ]);
  await transaction.insert(monitoringTargets).values({
    domainId,
    id: targetId,
    workspaceId,
  });
  await transaction.insert(monitoringRuns).values({
    domainId,
    id: runId,
    idempotencyKey: `${label}-queued`,
    targetId,
    trigger: 'SCHEDULED',
    workspaceId,
  });
  await transaction.insert(alertRules).values({
    id: ruleId,
    key: 'DNS_CHANGED',
    severity: 'INFO',
    workspaceId,
  });
  await transaction.insert(alertEvents).values({
    dedupeKey: `dns:${domainId}`,
    detail: 'Normalized DNS data changed.',
    domainId,
    id: eventId,
    ruleId,
    severity: 'INFO',
    targetId,
    title: 'DNS changed',
    workspaceId,
  });
  return {
    domainId,
    eventId,
    ruleId,
    runId,
    secondaryDomainId,
    targetId,
    workspaceId,
  };
}

async function selectIds(
  transaction: Pick<Database, 'select'>,
) {
  return {
    events: await transaction.select({ id: alertEvents.id }).from(alertEvents),
    rules: await transaction.select({ id: alertRules.id }).from(alertRules),
    runs: await transaction.select({ id: monitoringRuns.id }).from(monitoringRuns),
    targets: await transaction
      .select({ id: monitoringTargets.id })
      .from(monitoringTargets),
  };
}

describeWithPrivilegedPostgreSql(
  'monitoring RLS (requires dedicated RLS_TEST_DATABASE_URL)',
  () => {
    const runtimeRoleName = `domainpulse_monitoring_rls_${randomUUID().replaceAll('-', '')}`;
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
      if (!adminClient) throw new Error('Monitoring RLS admin was not initialized');
      return adminClient;
    };
    const getRuntime = (): Database => {
      if (!runtimeDatabase) throw new Error('Monitoring RLS runtime was not initialized');
      return runtimeDatabase;
    };
    const getFixtureA = (): Fixture => {
      if (!fixtureA) throw new Error('Monitoring workspace A fixture is missing');
      return fixtureA;
    };
    const getFixtureB = (): Fixture => {
      if (!fixtureB) throw new Error('Monitoring workspace B fixture is missing');
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
            name: 'Monitoring RLS Workspace A',
            slug: `monitoring-rls-a-${workspaceAId}`,
          },
          {
            id: workspaceBId,
            name: 'Monitoring RLS Workspace B',
            slug: `monitoring-rls-b-${workspaceBId}`,
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
          .delete(alertEvents)
          .where(eq(alertEvents.workspaceId, workspaceId));
        await adminClient.database
          .delete(monitoringRuns)
          .where(eq(monitoringRuns.workspaceId, workspaceId));
        await adminClient.database
          .delete(alertRules)
          .where(eq(alertRules.workspaceId, workspaceId));
        await adminClient.database
          .delete(monitoringTargets)
          .where(eq(monitoringTargets.workspaceId, workspaceId));
        await adminClient.database
          .delete(domains)
          .where(eq(domains.workspaceId, workspaceId));
        await adminClient.database
          .delete(workspaces)
          .where(eq(workspaces.id, workspaceId));
      }
      if (runtimeRoleCreated) {
        await adminClient.pool.query(`drop owned by ${runtimeRoleIdentifier}`);
        await adminClient.pool.query(
          `revoke ${runtimeRoleIdentifier} from current_user`,
        );
        await adminClient.pool.query(`drop role ${runtimeRoleIdentifier}`);
      }
      await adminClient.close();
    });

    it('enables RLS for a non-owner NOBYPASSRLS role on all four tables', async () => {
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
      expect(await selectIds(database)).toEqual({
        events: [],
        rules: [],
        runs: [],
        targets: [],
      });
      const fixture = getFixtureA();
      await expectPostgreSqlError(
        () =>
          database.insert(alertRules).values({
            key: 'CERT_CHANGED',
            severity: 'INFO',
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
        selectIds,
      );
      expect(rows).toEqual({
        events: [{ id: fixture.eventId }],
        rules: [{ id: fixture.ruleId }],
        runs: [{ id: fixture.runId }],
        targets: [{ id: fixture.targetId }],
      });
    });

    it('allows same-workspace inserts on all four protected tables', async () => {
      const fixture = getFixtureA();
      const rollbackProbe = new Error('rollback same-workspace monitoring writes');
      await expect(
        withWorkspaceContext(
          getRuntime(),
          fixture.workspaceId,
          async (transaction) => {
            const targetId = randomUUID();
            await transaction.insert(monitoringTargets).values({
              domainId: fixture.secondaryDomainId,
              id: targetId,
              workspaceId: fixture.workspaceId,
            });
            await transaction.insert(monitoringRuns).values({
              domainId: fixture.secondaryDomainId,
              idempotencyKey: 'same-workspace',
              targetId,
              trigger: 'MANUAL',
              workspaceId: fixture.workspaceId,
            });
            const [rule] = await transaction
              .insert(alertRules)
              .values({
                key: 'CERT_CHANGED',
                severity: 'INFO',
                workspaceId: fixture.workspaceId,
              })
              .returning({ id: alertRules.id });
            if (!rule) throw new Error('Same-workspace rule was not created');
            await transaction.insert(alertEvents).values({
              dedupeKey: `cert:${fixture.secondaryDomainId}`,
              detail: 'Normalized certificate data changed.',
              domainId: fixture.secondaryDomainId,
              ruleId: rule.id,
              severity: 'INFO',
              targetId,
              title: 'Certificate changed',
              workspaceId: fixture.workspaceId,
            });
            throw rollbackProbe;
          },
        ),
      ).rejects.toBe(rollbackProbe);
    });

    it('blocks workspace A writes to workspace B and hides B mutations', async () => {
      const a = getFixtureA();
      const b = getFixtureB();
      const insertOperations = [
        () =>
          withWorkspaceContext(getRuntime(), a.workspaceId, (transaction) =>
            transaction.insert(alertRules).values({
              key: 'CERT_CHANGED',
              severity: 'INFO',
              workspaceId: b.workspaceId,
            }),
          ),
        () =>
          withWorkspaceContext(getRuntime(), a.workspaceId, (transaction) =>
            transaction.insert(monitoringRuns).values({
              domainId: b.domainId,
              idempotencyKey: 'cross-workspace',
              targetId: b.targetId,
              trigger: 'RETRY',
              workspaceId: b.workspaceId,
            }),
          ),
      ];
      for (const insert of insertOperations) {
        await expectPostgreSqlError(insert, '42501');
      }
      const updates = await withWorkspaceContext(
        getRuntime(),
        a.workspaceId,
        async (transaction) => ({
          events: await transaction
            .update(alertEvents)
            .set({ occurrenceCount: 2 })
            .where(eq(alertEvents.id, b.eventId))
            .returning({ id: alertEvents.id }),
          rules: await transaction
            .update(alertRules)
            .set({ enabled: false })
            .where(eq(alertRules.id, b.ruleId))
            .returning({ id: alertRules.id }),
          runs: await transaction
            .delete(monitoringRuns)
            .where(eq(monitoringRuns.id, b.runId))
            .returning({ id: monitoringRuns.id }),
          targets: await transaction
            .update(monitoringTargets)
            .set({ enabled: false })
            .where(eq(monitoringTargets.id, b.targetId))
            .returning({ id: monitoringTargets.id }),
        }),
      );
      for (const rows of Object.values(updates)) expect(rows).toHaveLength(0);
    });
  },
);
