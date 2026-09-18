import { createHash, randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { DatabaseClient } from '../src/client/database-types';
import {
  providerAccounts,
  providerConnections,
  providerSyncRuns,
  workspaces,
} from '../src/schema';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';
import { expectPostgresErrorCode } from './postgres-error';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

interface Fixture {
  readonly connectionId: string;
  readonly workspaceId: string;
}

interface ScheduledRow {
  readonly runId: string;
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

describeWithPostgreSql(
  'provider sync worker functions (requires disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;
    const workspaceIds: string[] = [];

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('Provider sync worker test client was not initialized');
      return client;
    };

    async function createFixture(options: {
      readonly validationStatus?: 'INVALID' | 'PENDING' | 'VALID';
      readonly nextSyncAt?: Date | null;
      readonly syncIntervalMinutes?: number;
    } = {}): Promise<Fixture> {
      const workspaceId = randomUUID();
      const providerAccountId = randomUUID();
      const connectionId = randomUUID();
      workspaceIds.push(workspaceId);
      const material = envelope();
      const validationStatus = options.validationStatus ?? 'VALID';
      await getClient().transaction(async (transaction) => {
        await transaction.insert(workspaces).values({
          id: workspaceId,
          name: 'Provider sync worker function integration',
          slug: `provider-sync-worker-function-${workspaceId}`,
        });
        await transaction.insert(providerAccounts).values({
          id: providerAccountId,
          label: 'Worker function fixture account',
          provenance: 'USER_ADDED',
          providerKey: 'cloudflare',
          workspaceId,
        });
        await transaction.insert(providerConnections).values({
          authType: 'CLOUDFLARE_API_TOKEN',
          credentialMask: '••••1234',
          encryptedCiphertext: material.ciphertextBase64,
          encryptionAuthTag: material.authTagBase64,
          encryptionIv: material.ivBase64,
          id: connectionId,
          keyVersion: 1,
          lastValidatedAt: validationStatus === 'PENDING' ? null : new Date(),
          nextSyncAt: options.nextSyncAt ?? null,
          providerAccountId,
          syncIntervalMinutes: options.syncIntervalMinutes ?? 60,
          validationErrorCode: validationStatus === 'INVALID' ? 'AUTH_INVALID' : null,
          validationStatus,
          workspaceId,
        });
      });
      return { connectionId, workspaceId };
    }

    async function insertQueuedRun(
      fixture: Fixture,
      availableAt: Date,
      key = internalIdempotencyKey(`manual:${randomUUID()}`),
    ): Promise<string> {
      const [run] = await getClient().database
        .insert(providerSyncRuns)
        .values({
          availableAt,
          connectionId: fixture.connectionId,
          idempotencyKey: key,
          trigger: 'MANUAL',
          workspaceId: fixture.workspaceId,
        })
        .returning({ id: providerSyncRuns.id });
      if (!run) throw new Error('Queued provider sync run fixture was not created');
      return run.id;
    }

    async function insertRunningRun(
      fixture: Fixture,
      attemptNo: number,
      leaseExpiresAt: Date,
    ): Promise<string> {
      const startedAt = new Date(leaseExpiresAt.getTime() - 60_000);
      const root = internalIdempotencyKey(`lease:${fixture.connectionId}`);
      const [run] = await getClient().database
        .insert(providerSyncRuns)
        .values({
          attemptNo,
          claimedAt: startedAt,
          connectionId: fixture.connectionId,
          idempotencyKey: attemptNo === 1
            ? root
            : internalIdempotencyKey(`${root}:retry:${String(attemptNo)}`),
          leaseExpiresAt,
          startedAt,
          status: 'RUNNING',
          trigger: attemptNo === 1 ? 'SCHEDULED' : 'RETRY',
          workspaceId: fixture.workspaceId,
        })
        .returning({ id: providerSyncRuns.id });
      if (!run) throw new Error('Running provider sync run fixture was not created');
      return run.id;
    }

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: './migrations' });
    });

    afterEach(async () => {
      if (workspaceIds.length === 0) return;
      await getClient().database.delete(providerSyncRuns).where(
        inArray(providerSyncRuns.workspaceId, workspaceIds),
      );
      await getClient().database.delete(providerConnections).where(
        inArray(providerConnections.workspaceId, workspaceIds),
      );
      await getClient().database.delete(providerAccounts).where(
        inArray(providerAccounts.workspaceId, workspaceIds),
      );
      await getClient().database.delete(workspaces).where(
        inArray(workspaces.id, workspaceIds),
      );
      workspaceIds.length = 0;
    });

    afterAll(async () => await client?.close());

    it('schedules only validated due connections and advances their next sync', async () => {
      const now = new Date('2026-01-02T00:00:00.000Z');
      const due = await createFixture({ nextSyncAt: new Date(now.getTime() - 1_000) });
      await createFixture({
        nextSyncAt: new Date(now.getTime() - 1_000),
        validationStatus: 'INVALID',
      });
      await createFixture({
        nextSyncAt: new Date(now.getTime() - 1_000),
        validationStatus: 'PENDING',
      });
      await createFixture({ nextSyncAt: new Date(now.getTime() + 1_000) });

      const result = await getClient().pool.query<ScheduledRow>(
        'select "run_id" as "runId" from domainpulse.schedule_due_provider_sync_runs($1, $2)',
        [now, 20],
      );
      expect(result.rows).toHaveLength(1);
      const scheduledResult = result.rows[0];
      if (!scheduledResult) throw new Error('Scheduled run result was not returned');
      const [scheduled] = await getClient().database
        .select()
        .from(providerSyncRuns)
        .where(eq(providerSyncRuns.id, scheduledResult.runId));
      expect(scheduled).toMatchObject({
        connectionId: due.connectionId,
        status: 'QUEUED',
        trigger: 'SCHEDULED',
      });
      expect(scheduled?.idempotencyKey).toMatch(/^[0-9a-f]{64}$/u);
      const [advanced] = await getClient().database
        .select({ nextSyncAt: providerConnections.nextSyncAt })
        .from(providerConnections)
        .where(eq(providerConnections.id, due.connectionId));
      expect(advanced?.nextSyncAt?.getTime()).toBeGreaterThanOrEqual(
        now.getTime() + 60 * 60_000,
      );
    });

    it('deduplicates repeated scheduling of the same due window', async () => {
      const now = new Date('2026-02-02T00:00:00.000Z');
      await createFixture({ nextSyncAt: new Date(now.getTime() - 1_000) });
      const first = await getClient().pool.query(
        'select * from domainpulse.schedule_due_provider_sync_runs($1, $2)',
        [now, 1],
      );
      const second = await getClient().pool.query(
        'select * from domainpulse.schedule_due_provider_sync_runs($1, $2)',
        [now, 1],
      );
      expect(first.rows).toHaveLength(1);
      expect(second.rows).toHaveLength(0);
    });

    it('does not schedule a connection with an in-flight QUEUED or RUNNING run', async () => {
      const now = new Date('2026-02-03T00:00:00.000Z');
      const fixture = await createFixture({ nextSyncAt: new Date(now.getTime() - 1_000) });
      await insertQueuedRun(fixture, now);
      const result = await getClient().pool.query(
        'select * from domainpulse.schedule_due_provider_sync_runs($1, $2)',
        [now, 10],
      );
      expect(result.rows).toHaveLength(0);
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
         from domainpulse.claim_provider_sync_runs($1, $2, $3)`,
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
        await connection.query('select id from provider_sync_runs where id = $1 for update', [lockedRunId]);
        const result = await getClient().pool.query<ClaimedRow>(
          `select "run_id" as "runId" from domainpulse.claim_provider_sync_runs($1, $2, $3)`,
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
         from domainpulse.reclaim_expired_provider_sync_runs($1, $2, $3)`,
        [now, 20, 3],
      );
      expect(result.rows).toHaveLength(4);
      const recoveredIds = result.rows.map((row) => row.runId).sort();
      expect(recoveredIds).toEqual(expired.map((item) => item.runId).sort());

      const retryRows = await getClient().database
        .select()
        .from(providerSyncRuns)
        .where(inArray(providerSyncRuns.workspaceId, expired.map((item) => item.fixture.workspaceId)));
      const expectedDelay = new Map([[2, 5], [3, 20], [4, 60]]);
      for (const attemptNo of [2, 3, 4]) {
        const retry = retryRows.find((row) => row.attemptNo === attemptNo && row.status === 'QUEUED');
        const delayMinutes = expectedDelay.get(attemptNo);
        if (delayMinutes === undefined) throw new Error('Expected retry delay is missing');
        expect(retry?.availableAt).toEqual(
          new Date(now.getTime() + delayMinutes * 60_000),
        );
        expect(retry?.idempotencyKey).toMatch(/^[0-9a-f]{64}$/u);
      }
      expect(retryRows.some((row) => row.attemptNo === 5)).toBe(false);
      const failedRows = retryRows.filter((row) => row.status === 'FAILED');
      expect(failedRows).toHaveLength(4);
      for (const failed of failedRows) {
        expect(failed.errorCode).toBe('WORKER_LEASE_EXPIRED');
        expect(failed.errorDetail).toBeTruthy();
      }
      const [active] = await getClient().database
        .select({ status: providerSyncRuns.status })
        .from(providerSyncRuns)
        .where(eq(providerSyncRuns.id, activeRunId));
      expect(active?.status).toBe('RUNNING');
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
        await connection.query('select id from provider_sync_runs where id = $1 for update', [lockedRunId]);
        const result = await getClient().pool.query<RecoveredRow>(
          `select "run_id" as "runId"
           from domainpulse.reclaim_expired_provider_sync_runs($1, $2, $3)`,
          [now, 1, 3],
        );
        expect(result.rows.map((row) => row.runId)).toEqual([availableRunId]);
      } finally {
        await connection.query('rollback');
        connection.release();
      }
      const [locked] = await getClient().database
        .select({ status: providerSyncRuns.status })
        .from(providerSyncRuns)
        .where(
          and(
            eq(providerSyncRuns.workspaceId, lockedFixture.workspaceId),
            eq(providerSyncRuns.id, lockedRunId),
          ),
        );
      expect(locked?.status).toBe('RUNNING');
    });

    it('rejects a manual insert that reuses an idempotency key for the same connection', async () => {
      const now = new Date('2026-07-02T00:00:00.000Z');
      const fixture = await createFixture();
      const key = internalIdempotencyKey(`manual:${randomUUID()}`);
      await insertQueuedRun(fixture, now, key);
      await expectPostgresErrorCode(
        () => insertQueuedRun(fixture, now, key),
        '23505',
      );
    });

    it('rejects raw idempotency keys and oversized summary metadata', async () => {
      const fixture = await createFixture();
      await expectPostgresErrorCode(
        () => insertQueuedRun(fixture, new Date(), `manual:${randomUUID()}`),
        '23514',
      );
      await expectPostgresErrorCode(
        () =>
          getClient().database.insert(providerSyncRuns).values({
            connectionId: fixture.connectionId,
            idempotencyKey: internalIdempotencyKey(`manual:${randomUUID()}`),
            summaryMetadata: { raw: 'x'.repeat(17_000) },
            trigger: 'MANUAL',
            workspaceId: fixture.workspaceId,
          }),
        '23514',
      );
    });

    it('rejects invalid arguments for every queue function', async () => {
      const now = new Date('2026-08-02T00:00:00.000Z');
      await expectPostgresErrorCode(
        () => getClient().pool.query('select * from domainpulse.schedule_due_provider_sync_runs($1, $2)', [now, 0]),
        '22023',
      );
      await expectPostgresErrorCode(
        () => getClient().pool.query('select * from domainpulse.claim_provider_sync_runs($1, $2, $3)', [now, 1, 1_000]),
        '22023',
      );
      await expectPostgresErrorCode(
        () => getClient().pool.query('select * from domainpulse.reclaim_expired_provider_sync_runs($1, $2, $3)', [now, 1, 99]),
        '22023',
      );
    });
  },
);
