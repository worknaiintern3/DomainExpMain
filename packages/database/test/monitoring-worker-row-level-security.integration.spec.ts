import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { DatabaseClient } from '../src/client/database-types';
import { domains, monitoringRuns, monitoringTargets, workspaces } from '../src/schema';
import {
  getPrivilegedRlsTestConfiguration,
  hasPrivilegedRlsTestDatabase,
} from './test-database';

const describeWithPrivilegedPostgreSql = hasPrivilegedRlsTestDatabase
  ? describe
  : describe.skip;

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]+$/u.test(identifier)) {
    throw new Error('Unsafe PostgreSQL test identifier');
  }
  return `"${identifier}"`;
}

describeWithPrivilegedPostgreSql(
  'monitoring worker RLS boundary (requires dedicated RLS_TEST_DATABASE_URL)',
  () => {
    const workerRoleName = `domainpulse_worker_rls_${randomUUID().replaceAll('-', '')}`;
    const workerRoleIdentifier = quoteIdentifier(workerRoleName);
    const workspaceIds = [randomUUID(), randomUUID()];
    let adminClient: DatabaseClient | undefined;
    let runtimeConnection: PoolClient | undefined;
    let workerRoleCreated = false;

    const getAdmin = (): DatabaseClient => {
      if (!adminClient) throw new Error('Worker RLS admin was not initialized');
      return adminClient;
    };

    beforeAll(async () => {
      adminClient = createDatabaseClient(getPrivilegedRlsTestConfiguration());
      await migrate(adminClient.database, { migrationsFolder: './migrations' });
      await adminClient.pool.query(
        `create role ${workerRoleIdentifier} nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls`,
      );
      workerRoleCreated = true;
      await adminClient.pool.query(`grant ${workerRoleIdentifier} to current_user`);
      await adminClient.pool.query(
        `grant usage on schema public, domainpulse to ${workerRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant execute on function domainpulse.current_workspace_id() to ${workerRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant select on table monitoring_targets, monitoring_runs to ${workerRoleIdentifier}`,
      );
      for (const signature of [
        'domainpulse.schedule_due_monitoring_runs(timestamp with time zone, integer)',
        'domainpulse.claim_monitoring_runs(timestamp with time zone, integer, integer)',
        'domainpulse.reclaim_expired_monitoring_runs(timestamp with time zone, integer, integer)',
      ]) {
        await adminClient.pool.query(
          `grant execute on function ${signature} to ${workerRoleIdentifier}`,
        );
      }
      const now = new Date('2026-07-02T00:00:00.000Z');
      await adminClient.transaction(async (transaction) => {
        for (const [index, workspaceId] of workspaceIds.entries()) {
          const domainId = randomUUID();
          await transaction.insert(workspaces).values({
            id: workspaceId,
            name: `Worker RLS ${String(index)}`,
            slug: `worker-rls-${workspaceId}`,
          });
          await transaction.insert(domains).values({
            domainName: `${domainId}.example`,
            id: domainId,
            normalizedDomainName: `${domainId}.example`,
            provenance: 'USER_ADDED',
            workspaceId,
          });
          await transaction.insert(monitoringTargets).values({
            checkIntervalMinutes: 60,
            domainId,
            nextRunAt: new Date(now.getTime() - 1),
            workspaceId,
          });
        }
      });
      runtimeConnection = await adminClient.pool.connect();
      await runtimeConnection.query(`set role ${workerRoleIdentifier}`);
    });

    afterAll(async () => {
      if (runtimeConnection) {
        await runtimeConnection.query('reset role');
        runtimeConnection.release();
      }
      if (!adminClient) return;
      for (const workspaceId of workspaceIds) {
        await adminClient.database.delete(monitoringRuns).where(eq(monitoringRuns.workspaceId, workspaceId));
        await adminClient.database.delete(monitoringTargets).where(eq(monitoringTargets.workspaceId, workspaceId));
        await adminClient.database.delete(domains).where(eq(domains.workspaceId, workspaceId));
        await adminClient.database.delete(workspaces).where(eq(workspaces.id, workspaceId));
      }
      if (workerRoleCreated) {
        await adminClient.pool.query(`revoke ${workerRoleIdentifier} from current_user`);
        await adminClient.pool.query(`drop owned by ${workerRoleIdentifier}`);
        await adminClient.pool.query(`drop role ${workerRoleIdentifier}`);
      }
      await adminClient.close();
    });

    it('uses a non-owner NOBYPASSRLS worker identity', async () => {
      const role = await getAdmin().pool.query<{
        readonly bypassRls: boolean;
        readonly superuser: boolean;
      }>(
        'select rolbypassrls as "bypassRls", rolsuper as "superuser" from pg_roles where rolname = $1',
        [workerRoleName],
      );
      const ownership = await getAdmin().pool.query<{ readonly owner: string }>(
        `select pg_get_userbyid(relowner) as owner
         from pg_class
         where oid in ('public.monitoring_targets'::regclass, 'public.monitoring_runs'::regclass)`,
      );
      expect(role.rows[0]).toEqual({ bypassRls: false, superuser: false });
      expect(ownership.rows.every((row) => row.owner !== workerRoleName)).toBe(true);
    });

    it('cannot read tenant tables globally without workspace context', async () => {
      if (!runtimeConnection) throw new Error('Worker RLS connection is missing');
      const targets = await runtimeConnection.query('select id from monitoring_targets');
      const runs = await runtimeConnection.query('select id from monitoring_runs');
      expect(targets.rows).toEqual([]);
      expect(runs.rows).toEqual([]);
    });

    it('uses only explicitly granted definer functions for global schedule and claim', async () => {
      if (!runtimeConnection) throw new Error('Worker RLS connection is missing');
      const now = new Date('2026-07-02T00:00:00.000Z');
      const scheduled = await runtimeConnection.query<Record<string, unknown>>(
        'select * from domainpulse.schedule_due_monitoring_runs($1, $2)',
        [now, 10],
      );
      expect(scheduled.rows).toHaveLength(2);
      expect(Object.keys(scheduled.rows[0] ?? {}).sort()).toEqual([
        'domain_id',
        'run_id',
        'target_id',
        'workspace_id',
      ]);
      const claimed = await runtimeConnection.query<Record<string, unknown>>(
        'select * from domainpulse.claim_monitoring_runs($1, $2, $3)',
        [now, 10, 300_000],
      );
      expect(claimed.rows).toHaveLength(2);
      expect(Object.keys(claimed.rows[0] ?? {}).sort()).toEqual([
        'attempt_no',
        'domain_id',
        'idempotency_key',
        'lease_expires_at',
        'run_id',
        'target_id',
        'workspace_id',
      ]);
      const directRead = await runtimeConnection.query('select id from monitoring_runs');
      expect(directRead.rows).toEqual([]);
    });
  },
);
