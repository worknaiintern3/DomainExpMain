import { randomUUID } from 'node:crypto';

import {
  alertEvents,
  alertRules,
  createDatabaseClient,
  domainDnsMetadata,
  domainRdapMetadata,
  domainTlsMetadata,
  domains,
  monitoringRuns,
  monitoringTargets,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresMonitoringRepository } from '../src/monitoring/monitoring.repository';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
  resolveMigrationsFolder,
} from './alert-integration-helpers';

const describeWithPostgres = hasDisposableTestDatabase ? describe : describe.skip;
const workspaceAId = randomUUID();
const workspaceBId = randomUUID();
const domainAId = randomUUID();
const domainBId = randomUUID();
const targetAId = randomUUID();
const targetBId = randomUUID();

interface RunFixture {
  readonly domainId: string;
  readonly id: string;
  readonly status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  readonly targetId: string;
  readonly timestamp: Date;
  readonly workspaceId: string;
}

function terminalFields(status: RunFixture['status'], timestamp: Date) {
  if (status === 'QUEUED') return {};
  if (status === 'RUNNING') {
    return {
      claimedAt: timestamp,
      leaseExpiresAt: new Date(timestamp.getTime() + 300_000),
      startedAt: timestamp,
    };
  }
  return {
    durationMs: 10,
    errorCode: status === 'SUCCESS' ? null : 'TEST_ERROR',
    finishedAt: timestamp,
    startedAt: timestamp,
  };
}

function runValues(fixture: RunFixture) {
  return {
    ...terminalFields(fixture.status, fixture.timestamp),
    availableAt: fixture.timestamp,
    createdAt: fixture.timestamp,
    domainId: fixture.domainId,
    id: fixture.id,
    idempotencyKey: `retention-${fixture.id}`,
    status: fixture.status,
    targetId: fixture.targetId,
    trigger: 'MANUAL' as const,
    workspaceId: fixture.workspaceId,
  };
}

describeWithPostgres(
  'PostgresMonitoringRepository.cleanupOldTerminalRuns — real PostgreSQL',
  () => {
    let client: DatabaseClient | undefined;
    let repository: PostgresMonitoringRepository | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('Retention test client was not initialized');
      return client;
    };

    const getRepository = (): PostgresMonitoringRepository => {
      if (!repository) throw new Error('Retention repository was not initialized');
      return repository;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, {
        migrationsFolder: resolveMigrationsFolder(),
      });

      const migrationCount = await client.pool.query<{ readonly count: number }>(
        'select count(*)::integer as count from "drizzle"."__drizzle_migrations"',
      );
      expect(migrationCount.rows[0]?.count).toBe(11);

      const index = await client.pool.query<{
        readonly definition: string;
        readonly indexName: string;
      }>(
        `select indexname as "indexName", indexdef as definition
         from pg_catalog.pg_indexes
         where schemaname = 'public'
           and tablename = 'monitoring_runs'
           and indexname = 'monitoring_runs_retention_idx'`,
      );
      expect(index.rows).toHaveLength(1);
      const definition = index.rows[0]?.definition ?? '';
      expect(definition).toContain('monitoring_runs_retention_idx');
      expect(definition).toContain('(status, finished_at)');
      expect(definition).toContain('SUCCESS');
      expect(definition).toContain('PARTIAL');
      expect(definition).toContain('FAILED');
      expect(definition).not.toContain('QUEUED');
      expect(definition).not.toContain('RUNNING');

      await client.database.insert(workspaces).values([
        { id: workspaceAId, name: 'Retention A', slug: `retention-a-${workspaceAId}` },
        { id: workspaceBId, name: 'Retention B', slug: `retention-b-${workspaceBId}` },
      ]);
      await client.database.insert(domains).values([
        {
          domainName: `a-${domainAId}.example`,
          id: domainAId,
          normalizedDomainName: `a-${domainAId}.example`,
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          domainName: `b-${domainBId}.example`,
          id: domainBId,
          normalizedDomainName: `b-${domainBId}.example`,
          provenance: 'USER_ADDED',
          workspaceId: workspaceBId,
        },
      ]);
      await client.database.insert(monitoringTargets).values([
        { domainId: domainAId, id: targetAId, workspaceId: workspaceAId },
        { domainId: domainBId, id: targetBId, workspaceId: workspaceBId },
      ]);
      const ruleId = randomUUID();
      await client.database.insert(alertRules).values({
        id: ruleId,
        key: 'DNS_CHANGED',
        severity: 'INFO',
        workspaceId: workspaceAId,
      });
      await client.database.insert(alertEvents).values({
        dedupeKey: `retention-keep-${randomUUID()}`,
        detail: 'Retention must not delete this alert.',
        domainId: domainAId,
        evidence: {},
        ruleId,
        severity: 'INFO',
        status: 'OPEN',
        title: 'Retention guard',
        workspaceId: workspaceAId,
      });
      const metadataFailure = {
        domainId: domainAId,
        lastAttemptedAt: new Date('2026-01-01T00:00:00.000Z'),
        lastAttemptStatus: 'FAILED' as const,
        lastErrorCode: 'TEST_ERROR',
        workspaceId: workspaceAId,
      };
      await client.database.insert(domainRdapMetadata).values(metadataFailure);
      await client.database.insert(domainDnsMetadata).values(metadataFailure);
      await client.database.insert(domainTlsMetadata).values(metadataFailure);
      repository = new PostgresMonitoringRepository(client);
    });

    afterAll(async () => {
      if (!client) return;
      const workspaceIds = [workspaceAId, workspaceBId];
      await client.database.delete(alertEvents).where(inArray(alertEvents.workspaceId, workspaceIds));
      await client.database.delete(alertRules).where(inArray(alertRules.workspaceId, workspaceIds));
      await client.database.delete(monitoringRuns).where(inArray(monitoringRuns.workspaceId, workspaceIds));
      await client.database.delete(monitoringTargets).where(inArray(monitoringTargets.workspaceId, workspaceIds));
      await client.database.delete(domains).where(inArray(domains.workspaceId, workspaceIds));
      await client.database.delete(workspaces).where(inArray(workspaces.id, workspaceIds));
      await client.close();
    });

    it('deletes bounded old terminal batches and preserves all unrelated state', async () => {
      const now = new Date('2026-06-01T00:00:00.000Z');
      const old = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1_000);
      const recent = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1_000);
      const oldTerminal: RunFixture[] = [
        { id: randomUUID(), status: 'SUCCESS', workspaceId: workspaceAId, domainId: domainAId, targetId: targetAId, timestamp: old },
        { id: randomUUID(), status: 'SUCCESS', workspaceId: workspaceAId, domainId: domainAId, targetId: targetAId, timestamp: old },
        { id: randomUUID(), status: 'PARTIAL', workspaceId: workspaceAId, domainId: domainAId, targetId: targetAId, timestamp: old },
        { id: randomUUID(), status: 'FAILED', workspaceId: workspaceAId, domainId: domainAId, targetId: targetAId, timestamp: old },
        { id: randomUUID(), status: 'SUCCESS', workspaceId: workspaceBId, domainId: domainBId, targetId: targetBId, timestamp: old },
      ];
      const preserved: RunFixture[] = [
        { id: randomUUID(), status: 'SUCCESS', workspaceId: workspaceAId, domainId: domainAId, targetId: targetAId, timestamp: recent },
        { id: randomUUID(), status: 'PARTIAL', workspaceId: workspaceAId, domainId: domainAId, targetId: targetAId, timestamp: recent },
        { id: randomUUID(), status: 'FAILED', workspaceId: workspaceAId, domainId: domainAId, targetId: targetAId, timestamp: recent },
        { id: randomUUID(), status: 'QUEUED', workspaceId: workspaceAId, domainId: domainAId, targetId: targetAId, timestamp: old },
        { id: randomUUID(), status: 'RUNNING', workspaceId: workspaceAId, domainId: domainAId, targetId: targetAId, timestamp: old },
        { id: randomUUID(), status: 'QUEUED', workspaceId: workspaceBId, domainId: domainBId, targetId: targetBId, timestamp: recent },
      ];
      await getClient().database.insert(monitoringRuns).values(
        [...oldTerminal, ...preserved].map(runValues),
      );

      expect(await getRepository().cleanupOldTerminalRuns(now, 30, 2)).toBe(2);
      expect(await getRepository().cleanupOldTerminalRuns(now, 30, 2)).toBe(2);
      expect(await getRepository().cleanupOldTerminalRuns(now, 30, 2)).toBe(1);
      expect(await getRepository().cleanupOldTerminalRuns(now, 30, 2)).toBe(0);

      const fixtureIds = [...oldTerminal, ...preserved].map(({ id }) => id);
      const remaining = await getClient().database
        .select({ id: monitoringRuns.id })
        .from(monitoringRuns)
        .where(inArray(monitoringRuns.id, fixtureIds));
      const remainingIds = new Set(remaining.map(({ id }) => id));
      expect(oldTerminal.every(({ id }) => !remainingIds.has(id))).toBe(true);
      expect(preserved.every(({ id }) => remainingIds.has(id))).toBe(true);

      expect(await getClient().database.select().from(monitoringTargets)).toHaveLength(2);
      expect(await getClient().database.select().from(alertRules).where(eq(alertRules.workspaceId, workspaceAId))).toHaveLength(1);
      expect(await getClient().database.select().from(alertEvents).where(eq(alertEvents.workspaceId, workspaceAId))).toHaveLength(1);
      expect(await getClient().database.select().from(domains).where(inArray(domains.id, [domainAId, domainBId]))).toHaveLength(2);
      expect(await getClient().database.select().from(domainRdapMetadata).where(eq(domainRdapMetadata.domainId, domainAId))).toHaveLength(1);
      expect(await getClient().database.select().from(domainDnsMetadata).where(eq(domainDnsMetadata.domainId, domainAId))).toHaveLength(1);
      expect(await getClient().database.select().from(domainTlsMetadata).where(eq(domainTlsMetadata.domainId, domainAId))).toHaveLength(1);
    });
  },
);
