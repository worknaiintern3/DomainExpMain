import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type {
  DatabaseClient,
  DatabaseTransaction,
} from '../src/client/database-types';
import {
  alertEvents,
  alertRules,
  domains,
  monitoringRuns,
  monitoringTargets,
  workspaces,
} from '../src/schema';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase
  ? describe
  : describe.skip;

interface PostgreSqlErrorShape {
  readonly cause?: unknown;
  readonly code?: unknown;
}

interface DomainFixture {
  readonly domainId: string;
  readonly workspaceId: string;
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

async function insertDomainFixture(
  transaction: DatabaseTransaction,
  label: string,
): Promise<DomainFixture> {
  const workspaceId = randomUUID();
  const domainId = randomUUID();
  await transaction.insert(workspaces).values({
    id: workspaceId,
    name: `Monitoring ${label}`,
    slug: `monitoring-${label}-${workspaceId}`,
  });
  await transaction.insert(domains).values({
    domainName: `${label}-${domainId}.example`,
    id: domainId,
    normalizedDomainName: `${label}-${domainId}.example`,
    provenance: 'USER_ADDED',
    workspaceId,
  });
  return { domainId, workspaceId };
}

async function insertTarget(
  transaction: DatabaseTransaction,
  fixture: DomainFixture,
): Promise<string> {
  const id = randomUUID();
  await transaction.insert(monitoringTargets).values({
    domainId: fixture.domainId,
    id,
    workspaceId: fixture.workspaceId,
  });
  return id;
}

describeWithPostgreSql(
  'monitoring foundation schema (requires disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('Monitoring test client was not initialized');
      return client;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: './migrations' });
    });

    afterAll(async () => await client?.close());

    it('creates all four tables with truthful defaults and UTC timestamps', async () => {
      const rollbackProbe = new Error('rollback monitoring table probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const fixture = await insertDomainFixture(transaction, 'tables');
          const targetId = await insertTarget(transaction, fixture);
          const [target] = await transaction
            .select()
            .from(monitoringTargets)
            .where(eq(monitoringTargets.workspaceId, fixture.workspaceId));
          expect(target).toMatchObject({
            checkIntervalMinutes: 1_440,
            consecutiveFailures: 0,
            enabled: true,
            lastRunAt: null,
            lastRunStatus: null,
          });
          expect(target?.createdAt).toBeInstanceOf(Date);

          const [run] = await transaction
            .insert(monitoringRuns)
            .values({
              domainId: fixture.domainId,
              idempotencyKey: 'initial-scheduled-run',
              targetId,
              trigger: 'SCHEDULED',
              workspaceId: fixture.workspaceId,
            })
            .returning();
          expect(run).toMatchObject({ attemptNo: 1, status: 'QUEUED' });
          expect(run?.runMetadata).toEqual({});

          const [rule] = await transaction
            .insert(alertRules)
            .values({
              key: 'DNS_CHANGED',
              severity: 'WARNING',
              workspaceId: fixture.workspaceId,
            })
            .returning();
          if (!rule) throw new Error('Monitoring rule fixture was not created');
          const [event] = await transaction
            .insert(alertEvents)
            .values({
              dedupeKey: `dns-changed:${fixture.domainId}`,
              detail: 'Normalized DNS data changed.',
              domainId: fixture.domainId,
              ruleId: rule.id,
              severity: 'WARNING',
              targetId,
              title: 'DNS changed',
              workspaceId: fixture.workspaceId,
            })
            .returning();
          expect(event).toMatchObject({
            evidence: {},
            occurrenceCount: 1,
            status: 'OPEN',
          });
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('rejects duplicate domain targets and out-of-range intervals', async () => {
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const fixture = await insertDomainFixture(transaction, 'duplicate');
            await transaction.insert(monitoringTargets).values([
              { domainId: fixture.domainId, workspaceId: fixture.workspaceId },
              { domainId: fixture.domainId, workspaceId: fixture.workspaceId },
            ]);
          }),
        '23505',
      );
      for (const checkIntervalMinutes of [59, 10_081]) {
        await expectPostgreSqlError(
          () =>
            getClient().transaction(async (transaction) => {
              const fixture = await insertDomainFixture(
                transaction,
                `interval-${String(checkIntervalMinutes)}`,
              );
              await transaction.insert(monitoringTargets).values({
                checkIntervalMinutes,
                domainId: fixture.domainId,
                workspaceId: fixture.workspaceId,
              });
            }),
          '23514',
        );
      }
    });

    it('rejects duplicate per-target run idempotency keys', async () => {
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const fixture = await insertDomainFixture(transaction, 'idempotency');
            const targetId = await insertTarget(transaction, fixture);
            await transaction.insert(monitoringRuns).values([
              {
                domainId: fixture.domainId,
                idempotencyKey: 'scheduled-window-1',
                targetId,
                trigger: 'SCHEDULED',
                workspaceId: fixture.workspaceId,
              },
              {
                domainId: fixture.domainId,
                idempotencyKey: 'scheduled-window-1',
                targetId,
                trigger: 'RETRY',
                workspaceId: fixture.workspaceId,
              },
            ]);
          }),
        '23505',
      );
    });

    it('deduplicates active alerts but permits recurrence after resolution', async () => {
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const fixture = await insertDomainFixture(transaction, 'active-alert');
            const values = {
              dedupeKey: `dns:${fixture.domainId}`,
              detail: 'DNS changed.',
              domainId: fixture.domainId,
              severity: 'INFO' as const,
              title: 'DNS change',
              workspaceId: fixture.workspaceId,
            };
            await transaction.insert(alertEvents).values([values, values]);
          }),
        '23505',
      );

      const rollbackProbe = new Error('rollback recurring alert probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const fixture = await insertDomainFixture(transaction, 'recurring-alert');
          const common = {
            dedupeKey: `cert:${fixture.domainId}`,
            detail: 'Certificate changed.',
            domainId: fixture.domainId,
            severity: 'WARNING' as const,
            title: 'Certificate change',
            workspaceId: fixture.workspaceId,
          };
          await transaction.insert(alertEvents).values({
            ...common,
            resolvedAt: new Date(),
            status: 'RESOLVED',
          });
          await transaction.insert(alertEvents).values(common);
          expect(
            await transaction
              .select()
              .from(alertEvents)
              .where(eq(alertEvents.workspaceId, fixture.workspaceId)),
          ).toHaveLength(2);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('rejects invalid queue, running, terminal, and error states', async () => {
      const now = new Date();
      const invalidRuns = [
        { claimedAt: now, status: 'QUEUED' as const },
        { status: 'RUNNING' as const },
        { status: 'SUCCESS' as const },
        {
          finishedAt: now,
          startedAt: now,
          status: 'PARTIAL' as const,
        },
        {
          errorCode: 'SHOULD_NOT_EXIST',
          finishedAt: now,
          startedAt: now,
          status: 'SUCCESS' as const,
        },
      ];
      for (const [index, invalid] of invalidRuns.entries()) {
        await expectPostgreSqlError(
          () =>
            getClient().transaction(async (transaction) => {
              const fixture = await insertDomainFixture(
                transaction,
                `invalid-run-${String(index)}`,
              );
              const targetId = await insertTarget(transaction, fixture);
              await transaction.insert(monitoringRuns).values({
                domainId: fixture.domainId,
                idempotencyKey: `invalid-${String(index)}`,
                targetId,
                trigger: 'MANUAL',
                workspaceId: fixture.workspaceId,
                ...invalid,
              });
            }),
          '23514',
        );
      }
    });

    it('rejects cross-workspace domain, target, and rule references', async () => {
      const crossWorkspaceCases = [
        async (transaction: DatabaseTransaction) => {
          const a = await insertDomainFixture(transaction, 'cross-target-a');
          const b = await insertDomainFixture(transaction, 'cross-target-b');
          return transaction.insert(monitoringTargets).values({
            domainId: a.domainId,
            workspaceId: b.workspaceId,
          });
        },
        async (transaction: DatabaseTransaction) => {
          const a = await insertDomainFixture(transaction, 'cross-run-a');
          const b = await insertDomainFixture(transaction, 'cross-run-b');
          const targetId = await insertTarget(transaction, a);
          return transaction.insert(monitoringRuns).values({
            domainId: b.domainId,
            idempotencyKey: 'cross-target',
            targetId,
            trigger: 'MANUAL',
            workspaceId: b.workspaceId,
          });
        },
        async (transaction: DatabaseTransaction) => {
          const a = await insertDomainFixture(transaction, 'cross-rule-a');
          const b = await insertDomainFixture(transaction, 'cross-rule-b');
          const [rule] = await transaction
            .insert(alertRules)
            .values({
              key: 'CERT_CHANGED',
              severity: 'INFO',
              workspaceId: a.workspaceId,
            })
            .returning({ id: alertRules.id });
          if (!rule) throw new Error('Cross-workspace rule was not created');
          return transaction.insert(alertEvents).values({
            dedupeKey: `cross-rule:${b.domainId}`,
            detail: 'Cross-workspace rule probe.',
            domainId: b.domainId,
            ruleId: rule.id,
            severity: 'INFO',
            title: 'Cross-workspace rule',
            workspaceId: b.workspaceId,
          });
        },
      ];
      for (const crossWorkspaceInsert of crossWorkspaceCases) {
        await expectPostgreSqlError(
          () => getClient().transaction(crossWorkspaceInsert),
          '23503',
        );
      }
    });
  },
);
