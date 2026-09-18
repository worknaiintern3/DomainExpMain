import { randomUUID } from 'node:crypto';

import {
  alertEvents,
  alertRules,
  createDatabaseClient,
  domains,
  monitoringTargets,
  workspaces,
  withWorkspaceContext,
  type Database,
  type DatabaseClient,
  type DatabaseTransactionOperation,
} from '@domainpulse/database';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresAlertRepository } from '../src/alerts/alert-repository';
import {
  getPrivilegedRlsTestConfiguration,
  hasPrivilegedRlsTestDatabase,
  resolveMigrationsFolder,
} from './alert-integration-helpers';

const describeWithPrivilegedPostgreSql = hasPrivilegedRlsTestDatabase
  ? describe
  : describe.skip;

const tableNames = [
  'alert_events',
  'alert_rules',
  'monitoring_targets',
  'domain_rdap_metadata',
  'domain_dns_metadata',
  'domain_tls_metadata',
] as const;

interface Fixture {
  readonly domainId: string;
  readonly eventId: string;
  readonly ruleId: string;
  readonly targetId: string;
  readonly workspaceId: string;
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]+$/u.test(identifier)) {
    throw new Error('Unsafe PostgreSQL test identifier');
  }
  return `"${identifier}"`;
}

function postgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current);
    const record = current as { cause?: unknown; code?: unknown };
    if (typeof record.code === 'string') return record.code;
    current = record.cause;
  }
  return undefined;
}

async function insertFixture(
  admin: DatabaseClient,
  workspaceId: string,
  label: string,
): Promise<Fixture> {
  const domainId = randomUUID();
  const targetId = randomUUID();
  const ruleId = randomUUID();
  const eventId = randomUUID();
  await admin.transaction(async (transaction) => {
    await transaction.insert(workspaces).values({
      id: workspaceId,
      name: `Alert RLS ${label}`,
      slug: `alert-rls-${label}-${workspaceId}`,
    });
    await transaction.insert(domains).values({
      domainName: `${label}-${domainId}.example`,
      id: domainId,
      normalizedDomainName: `${label}-${domainId}.example`,
      provenance: 'USER_ADDED',
      workspaceId,
    });
    await transaction.insert(monitoringTargets).values({
      domainId,
      id: targetId,
      workspaceId,
    });
    await transaction.insert(alertRules).values({
      id: ruleId,
      key: 'DNS_CHANGED',
      severity: 'INFO',
      workspaceId,
    });
    await transaction.insert(alertEvents).values({
      dedupeKey: `dns-changed:${domainId}`,
      detail: 'Normalized DNS metadata changed.',
      domainId,
      id: eventId,
      ruleId,
      severity: 'INFO',
      targetId,
      title: 'DNS metadata changed',
      workspaceId,
    });
  });
  return { domainId, eventId, ruleId, targetId, workspaceId };
}

describeWithPrivilegedPostgreSql(
  'alert repository RLS (requires dedicated RLS_TEST_DATABASE_URL)',
  () => {
    const runtimeRoleName = `domainpulse_alert_rls_${randomUUID().replaceAll('-', '')}`;
    const runtimeRoleIdentifier = quoteIdentifier(runtimeRoleName);
    const workspaceAId = randomUUID();
    const workspaceBId = randomUUID();
    let adminClient: DatabaseClient | undefined;
    let fixtureA: Fixture | undefined;
    let fixtureB: Fixture | undefined;
    let runtimeConnection: PoolClient | undefined;
    let runtimeRoleCreated = false;

    function getAdmin(): DatabaseClient {
      if (!adminClient) throw new Error('Alert RLS admin was not initialized');
      return adminClient;
    }

    function getFixtureA(): Fixture {
      if (!fixtureA) throw new Error('Alert RLS workspace A fixture is missing');
      return fixtureA;
    }

    function getFixtureB(): Fixture {
      if (!fixtureB) throw new Error('Alert RLS workspace B fixture is missing');
      return fixtureB;
    }

    function repository(): PostgresAlertRepository {
      if (!runtimeConnection) {
        throw new Error('Alert RLS runtime connection is missing');
      }
      // The runtime connection acts as a non-owner NOBYPASSRLS role, so the
      // repository under test only ever sees rows permitted by RLS policy.
      // The relational schema object is intentionally omitted: the
      // repository uses explicit table objects and never relies on
      // relational query helpers at runtime.
      const runtimeDatabase = drizzle(runtimeConnection) as Database;
      return new PostgresAlertRepository({
        withWorkspaceContext<T>(
          workspaceId: string,
          operation: DatabaseTransactionOperation<T>,
        ): Promise<T> {
          return withWorkspaceContext(runtimeDatabase, workspaceId, operation);
        },
      });
    }

    beforeAll(async () => {
      adminClient = createDatabaseClient(getPrivilegedRlsTestConfiguration());
      await migrate(adminClient.database, {
        migrationsFolder: resolveMigrationsFolder(),
      });
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
        `grant execute on function domainpulse.current_workspace_id() to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant select, insert, update, delete on table ${tableNames.map(quoteIdentifier).join(', ')} to ${runtimeRoleIdentifier}`,
      );
      fixtureA = await insertFixture(getAdmin(), workspaceAId, 'a');
      fixtureB = await insertFixture(getAdmin(), workspaceBId, 'b');
      runtimeConnection = await adminClient.pool.connect();
      await runtimeConnection.query(`set role ${runtimeRoleIdentifier}`);
    });

    afterAll(async () => {
      if (runtimeConnection) {
        await runtimeConnection.query('reset role');
        runtimeConnection.release();
        runtimeConnection = undefined;
      }
      if (adminClient) {
        for (const workspaceId of [workspaceAId, workspaceBId]) {
          await adminClient.database
            .delete(alertEvents)
            .where(eq(alertEvents.workspaceId, workspaceId));
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
          await adminClient.pool.query(
            `revoke ${runtimeRoleIdentifier} from current_user`,
          );
          await adminClient.pool.query(
            `drop owned by ${runtimeRoleIdentifier}`,
          );
          await adminClient.pool.query(`drop role ${runtimeRoleIdentifier}`);
          runtimeRoleCreated = false;
        }
        await adminClient.close();
        adminClient = undefined;
      }
      fixtureA = undefined;
      fixtureB = undefined;
    });

    it('reads only workspace A rows through the repository', async () => {
      const fixture = getFixtureA();
      const active = await repository().readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      expect(active.map((event) => event.id)).toEqual([fixture.eventId]);
      const state = await repository().loadEvaluationState(
        fixture.workspaceId,
        fixture.domainId,
        fixture.targetId,
      );
      expect(state.rules.map((rule) => rule.id)).toEqual([fixture.ruleId]);
      expect(state.activeEvents.map((event) => event.id)).toEqual([
        fixture.eventId,
      ]);
    });

    it('cannot touch workspace B events from a workspace A operation', async () => {
      const a = getFixtureA();
      const b = getFixtureB();
      await repository().touchEvent(a.workspaceId, b.eventId, { revision: 2 }, new Date());
      await repository().resolveByDedupe(
        a.workspaceId,
        `dns-changed:${b.domainId}`,
        new Date(),
      );
      const rows = await getAdmin()
        .database.select()
        .from(alertEvents)
        .where(eq(alertEvents.id, b.eventId));
      const row = rows[0];
      if (!row) throw new Error('Workspace B fixture event is missing');
      expect(row).toMatchObject({
        evidence: {},
        occurrenceCount: 1,
        resolvedAt: null,
        status: 'OPEN',
      });
    });

    it('rejects cross-workspace inserts at the database boundary', async () => {
      const a = getFixtureA();
      const b = getFixtureB();
      if (!runtimeConnection) {
        throw new Error('Alert RLS runtime connection is missing');
      }
      const runtimeDatabase = drizzle(runtimeConnection) as Database;
      const error = await withWorkspaceContext(
        runtimeDatabase,
        a.workspaceId,
        (transaction) =>
          transaction
            .insert(alertEvents)
            .values({
              dedupeKey: `dns-changed:${b.domainId}-intruder`,
              detail: 'Cross-workspace probe.',
              domainId: b.domainId,
              evidence: {},
              ruleId: b.ruleId,
              severity: 'INFO',
              targetId: b.targetId,
              title: 'Cross-workspace probe',
              workspaceId: b.workspaceId,
            })
            .then(
              () => null,
              (caught: unknown) => caught,
            ),
      ).catch((caught: unknown) => caught);
      expect(postgresErrorCode(error)).toBe('42501');
    });

    it('allows same-workspace writes for the runtime role', async () => {
      const fixture = getFixtureA();
      const dedupeKey = `cert-changed:${fixture.domainId}`;
      const admin = getAdmin();
      const [rule] = await admin.database
        .insert(alertRules)
        .values({
          key: 'CERT_CHANGED',
          severity: 'INFO',
          workspaceId: fixture.workspaceId,
        })
        .returning({ id: alertRules.id });
      if (!rule) throw new Error('Same-workspace rule was not created');
      const repo = repository();
      await repo.insertEvent({
        dedupeKey,
        detail: 'Normalized TLS metadata changed.',
        domainId: fixture.domainId,
        evidence: { ruleKey: 'CERT_CHANGED' },
        now: new Date(),
        ruleId: rule.id,
        severity: 'INFO',
        targetId: fixture.targetId,
        title: 'TLS certificate metadata changed',
        workspaceId: fixture.workspaceId,
      });
      const active = await repo.readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      expect(
        active.some((event) => event.dedupeKey === dedupeKey),
      ).toBe(true);
      await admin.database
        .delete(alertEvents)
        .where(eq(alertEvents.dedupeKey, dedupeKey));
      await admin.database
        .delete(alertRules)
        .where(eq(alertRules.id, rule.id));
    });
  },
);
