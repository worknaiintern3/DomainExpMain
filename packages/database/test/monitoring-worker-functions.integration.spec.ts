import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { DatabaseClient } from '../src/client/database-types';
import {
  domains,
  monitoringRuns,
  monitoringTargets,
  workspaces,
} from '../src/schema';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

interface Fixture {
  readonly domainId: string;
  readonly targetId: string;
  readonly workspaceId: string;
}

interface ClaimedRow {
  readonly attemptNo: number;
  readonly leaseExpiresAt: Date;
  readonly runId: string;
}

interface RecoveredRow {
  readonly retryRunId: string | null;
  readonly runId: string;
}

describeWithPostgreSql(
  'monitoring worker functions (requires disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;
    const workspaceIds: string[] = [];

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('Monitoring worker test client was not initialized');
      return client;
    };

    async function createFixture(options: {
      readonly enabled?: boolean;
      readonly inventoryState?: 'ARCHIVED' | 'TRACKED';
      readonly nextRunAt?: Date | null;
    } = {}): Promise<Fixture> {
      const workspaceId = randomUUID();
      const domainId = randomUUID();
      const targetId = randomUUID();
      workspaceIds.push(workspaceId);
      await getClient().transaction(async (transaction) => {
        await transaction.insert(workspaces).values({
          id: workspaceId,
          name: 'Worker function integration',
          slug: `worker-function-${workspaceId}`,
        });
        await transaction.insert(domains).values({
          domainName: `${domainId}.example`,
          id: domainId,
          inventoryState: options.inventoryState ?? 'TRACKED',
          normalizedDomainName: `${domainId}.example`,
          provenance: 'USER_ADDED',
          workspaceId,
        });
        await transaction.insert(monitoringTargets).values({
          checkIntervalMinutes: 60,
          domainId,
          enabled: options.enabled ?? true,
          id: targetId,
          nextRunAt: options.nextRunAt ?? null,
          workspaceId,
        });
      });
      return { domainId, targetId, workspaceId };
    }

    async function insertQueuedRun(
      fixture: Fixture,
      availableAt: Date,
      key = `manual:${randomUUID()}`,
    ): Promise<string> {
      const [run] = await getClient().database
        .insert(monitoringRuns)
        .values({
          availableAt,
          domainId: fixture.domainId,
          idempotencyKey: key,
          targetId: fixture.targetId,
          trigger: 'MANUAL',
          workspaceId: fixture.workspaceId,
        })
        .returning({ id: monitoringRuns.id });
      if (!run) throw new Error('Queued run fixture was not created');
      return run.id;
    }

    async function insertRunningRun(
      fixture: Fixture,
      attemptNo: number,
      leaseExpiresAt: Date,
    ): Promise<string> {
      const startedAt = new Date(leaseExpiresAt.getTime() - 60_000);
      const root = `lease:${fixture.targetId}`;
      const [run] = await getClient().database
        .insert(monitoringRuns)
        .values({
          attemptNo,
          claimedAt: startedAt,
          domainId: fixture.domainId,
          idempotencyKey: attemptNo === 1 ? root : `${root}:retry:${String(attemptNo)}`,
          leaseExpiresAt,
          startedAt,
          status: 'RUNNING',
          targetId: fixture.targetId,
          trigger: attemptNo === 1 ? 'SCHEDULED' : 'RETRY',
          workspaceId: fixture.workspaceId,
        })
        .returning({ id: monitoringRuns.id });
      if (!run) throw new Error('Running run fixture was not created');
      return run.id;
    }

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: './migrations' });
    });

    afterEach(async () => {
      if (workspaceIds.length === 0) return;
      await getClient().database.delete(monitoringRuns).where(
        inArray(monitoringRuns.workspaceId, workspaceIds),
      );
      await getClient().database.delete(monitoringTargets).where(
        inArray(monitoringTargets.workspaceId, workspaceIds),
      );
      await getClient().database.delete(domains).where(
        inArray(domains.workspaceId, workspaceIds),
      );
      await getClient().database.delete(workspaces).where(
        inArray(workspaces.id, workspaceIds),
      );
      workspaceIds.length = 0;
    });

    afterAll(async () => await client?.close());

    it('schedules only enabled tracked due targets and advances their next run', async () => {
      const now = new Date('2026-01-02T00:00:00.000Z');
      const due = await createFixture({ nextRunAt: new Date(now.getTime() - 1_000) });
      await createFixture({ enabled: false, nextRunAt: new Date(now.getTime() - 1_000) });
      await createFixture({ inventoryState: 'ARCHIVED', nextRunAt: new Date(now.getTime() - 1_000) });
      await createFixture({ nextRunAt: new Date(now.getTime() + 1_000) });

      const result = await getClient().pool.query<{ readonly runId: string }>(
        'select "run_id" as "runId" from domainpulse.schedule_due_monitoring_runs($1, $2)',
        [now, 20],
      );
      expect(result.rows).toHaveLength(1);
      const scheduledResult = result.rows[0];
      if (!scheduledResult) throw new Error('Scheduled run result was not returned');
      const [scheduled] = await getClient().database
        .select()
        .from(monitoringRuns)
        .where(eq(monitoringRuns.id, scheduledResult.runId));
      expect(scheduled).toMatchObject({
        domainId: due.domainId,
        status: 'QUEUED',
        targetId: due.targetId,
        trigger: 'SCHEDULED',
      });
      const [advanced] = await getClient().database
        .select({ nextRunAt: monitoringTargets.nextRunAt })
        .from(monitoringTargets)
        .where(eq(monitoringTargets.id, due.targetId));
      expect(advanced?.nextRunAt?.getTime()).toBeGreaterThanOrEqual(
        now.getTime() + 60 * 60_000,
      );
    });

    it('deduplicates repeated scheduling of the same due window', async () => {
      const now = new Date('2026-02-02T00:00:00.000Z');
      await createFixture({ nextRunAt: new Date(now.getTime() - 1_000) });
      const first = await getClient().pool.query(
        'select * from domainpulse.schedule_due_monitoring_runs($1, $2)',
        [now, 1],
      );
      const second = await getClient().pool.query(
        'select * from domainpulse.schedule_due_monitoring_runs($1, $2)',
        [now, 1],
      );
      expect(first.rows).toHaveLength(1);
      expect(second.rows).toHaveLength(0);
    });

    it('claims only available queued work and assigns one bounded lease', async () => {
      const now = new Date('2026-03-02T00:00:00.000Z');
      const dueFixture = await createFixture();
      const futureFixture = await createFixture();
      const dueRunId = await insertQueuedRun(dueFixture, new Date(now.getTime() - 1));
      await insertQueuedRun(futureFixture, new Date(now.getTime() + 1));
      const result = await getClient().pool.query<ClaimedRow>(
        `select
           "run_id" as "runId",
           "attempt_no" as "attemptNo",
           "lease_expires_at" as "leaseExpiresAt"
         from domainpulse.claim_monitoring_runs($1, $2, $3)`,
        [now, 10, 300_000],
      );
      expect(result.rows).toEqual([{
        attemptNo: 1,
        leaseExpiresAt: new Date(now.getTime() + 300_000),
        runId: dueRunId,
      }]);
    });

    it('skips a concurrently locked queued run instead of double claiming it', async () => {
      const now = new Date('2026-04-02T00:00:00.000Z');
      const lockedFixture = await createFixture();
      const availableFixture = await createFixture();
      const lockedRunId = await insertQueuedRun(lockedFixture, now);
      const availableRunId = await insertQueuedRun(availableFixture, now);
      const connection = await getClient().pool.connect();
      try {
        await connection.query('begin');
        await connection.query('select id from monitoring_runs where id = $1 for update', [lockedRunId]);
        const result = await getClient().pool.query<ClaimedRow>(
          `select "run_id" as "runId" from domainpulse.claim_monitoring_runs($1, $2, $3)`,
          [now, 1, 300_000],
        );
        expect(result.rows.map((row) => row.runId)).toEqual([availableRunId]);
      } finally {
        await connection.query('rollback');
        connection.release();
      }
    });

    it('recovers only expired leases and creates exact capped retry delays', async () => {
      const now = new Date('2026-05-02T00:00:00.000Z');
      const expired: { attemptNo: number; fixture: Fixture; runId: string }[] = [];
      for (const attemptNo of [1, 2, 3, 4]) {
        const fixture = await createFixture();
        expired.push({
          attemptNo,
          fixture,
          runId: await insertRunningRun(fixture, attemptNo, new Date(now.getTime() - 1)),
        });
      }
      const activeFixture = await createFixture();
      const activeRunId = await insertRunningRun(
        activeFixture,
        1,
        new Date(now.getTime() + 1),
      );
      const result = await getClient().pool.query<RecoveredRow>(
        `select "run_id" as "runId", "retry_run_id" as "retryRunId"
         from domainpulse.reclaim_expired_monitoring_runs($1, $2, $3)`,
        [now, 20, 3],
      );
      expect(result.rows).toHaveLength(4);
      const recoveredIds = result.rows.map((row) => row.runId).sort();
      expect(recoveredIds).toEqual(expired.map((item) => item.runId).sort());

      const retryRows = await getClient().database
        .select()
        .from(monitoringRuns)
        .where(inArray(monitoringRuns.workspaceId, expired.map((item) => item.fixture.workspaceId)));
      const expectedDelay = new Map([[2, 5], [3, 20], [4, 60]]);
      for (const attemptNo of [2, 3, 4]) {
        const retry = retryRows.find((row) => row.attemptNo === attemptNo && row.status === 'QUEUED');
        const delayMinutes = expectedDelay.get(attemptNo);
        if (delayMinutes === undefined) throw new Error('Expected retry delay is missing');
        expect(retry?.availableAt).toEqual(
          new Date(now.getTime() + delayMinutes * 60_000),
        );
      }
      expect(retryRows.some((row) => row.attemptNo === 5)).toBe(false);
      const [active] = await getClient().database
        .select({ status: monitoringRuns.status })
        .from(monitoringRuns)
        .where(eq(monitoringRuns.id, activeRunId));
      expect(active?.status).toBe('RUNNING');
      const targets = await getClient().database
        .select({ consecutiveFailures: monitoringTargets.consecutiveFailures })
        .from(monitoringTargets)
        .where(inArray(monitoringTargets.workspaceId, expired.map((item) => item.fixture.workspaceId)));
      expect(targets.every((target) => target.consecutiveFailures === 1)).toBe(true);
    });

    it('skips a concurrently locked expired run during recovery', async () => {
      const now = new Date('2026-06-02T00:00:00.000Z');
      const lockedFixture = await createFixture();
      const availableFixture = await createFixture();
      const lockedRunId = await insertRunningRun(lockedFixture, 1, new Date(now.getTime() - 1));
      const availableRunId = await insertRunningRun(availableFixture, 1, new Date(now.getTime() - 1));
      const connection = await getClient().pool.connect();
      try {
        await connection.query('begin');
        await connection.query('select id from monitoring_runs where id = $1 for update', [lockedRunId]);
        const result = await getClient().pool.query<RecoveredRow>(
          `select "run_id" as "runId"
           from domainpulse.reclaim_expired_monitoring_runs($1, $2, $3)`,
          [now, 1, 3],
        );
        expect(result.rows.map((row) => row.runId)).toEqual([availableRunId]);
      } finally {
        await connection.query('rollback');
        connection.release();
      }
      const [locked] = await getClient().database
        .select({ status: monitoringRuns.status })
        .from(monitoringRuns)
        .where(
          and(
            eq(monitoringRuns.workspaceId, lockedFixture.workspaceId),
            eq(monitoringRuns.id, lockedRunId),
          ),
        );
      expect(locked?.status).toBe('RUNNING');
    });
  },
);
