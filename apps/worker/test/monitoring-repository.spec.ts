/* eslint-disable @typescript-eslint/require-await */
import {
  monitoringRuns,
  monitoringTargets,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@domainpulse/database';
import { SQL } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { PostgresMonitoringRepository } from '../src/monitoring/monitoring.repository';
import type {
  ClaimedMonitoringRun,
  MonitoringExecutionResult,
} from '../src/monitoring/monitoring.types';

const run: ClaimedMonitoringRun = {
  attemptNo: 1,
  domainId: '10000000-0000-4000-8000-000000000001',
  idempotencyKey: 'scheduled:100',
  leaseExpiresAt: new Date('2026-01-01T00:05:00.000Z'),
  runId: '20000000-0000-4000-8000-000000000001',
  targetId: '30000000-0000-4000-8000-000000000001',
  workspaceId: '40000000-0000-4000-8000-000000000001',
};

function result(
  status: MonitoringExecutionResult['status'],
  retryable = false,
): MonitoringExecutionResult {
  return {
    durationMs: 10,
    errorCode: status === 'SUCCESS' ? null : 'MONITORING_PARTIAL_FAILURE',
    finishedAt: new Date('2026-01-01T00:00:00.000Z'),
    retryable,
    sourcesAttempted: ['rdap', 'dns', 'tls'],
    sourcesSucceeded: status === 'FAILED' ? [] : ['rdap'],
    status,
  };
}

function harness(runUpdated = true) {
  const runSet = vi.fn();
  const targetSet = vi.fn();
  const insertValues: Record<string, unknown>[] = [];
  const onConflictDoNothing = vi.fn(async () => undefined);
  const transaction = {
    insert: vi.fn(() => ({
      values: (value: Record<string, unknown>) => {
        insertValues.push(value);
        return { onConflictDoNothing };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (value: Record<string, unknown>) => {
        if (table === monitoringRuns) {
          runSet(value);
          return {
            where: () => ({
              returning: vi.fn(async () => runUpdated ? [{ id: run.runId }] : []),
            }),
          };
        }
        if (table !== monitoringTargets) throw new Error('Unexpected update table');
        targetSet(value);
        return { where: vi.fn(async () => undefined) };
      },
    })),
  } as unknown as DatabaseTransaction;
  const withWorkspaceContext = vi.fn(
    async <T>(
      _workspaceId: string,
      operation: (database: DatabaseTransaction) => Promise<T>,
    ) => await operation(transaction),
  );
  const client = {
    close: vi.fn(async () => undefined),
    withWorkspaceContext,
  } as unknown as DatabaseClient;
  return {
    insertValues,
    onConflictDoNothing,
    repository: new PostgresMonitoringRepository(client),
    runSet,
    targetSet,
    withWorkspaceContext,
  };
}

describe('monitoring repository finalization', () => {
  it('resets the target failure streak after success', async () => {
    const test = harness();
    expect(await test.repository.finalize(run, result('SUCCESS'), 3)).toBe(true);
    expect(test.targetSet).toHaveBeenCalledWith(expect.objectContaining({
      consecutiveFailures: 0,
      lastRunStatus: 'SUCCESS',
    }));
    expect(test.insertValues).toEqual([]);
    expect(test.withWorkspaceContext).toHaveBeenCalledWith(
      run.workspaceId,
      expect.any(Function),
    );
  });

  it('increments PARTIAL as a non-success streak and creates a deduped transient retry', async () => {
    const test = harness();
    expect(await test.repository.finalize(run, result('PARTIAL', true), 3)).toBe(true);
    const targetUpdate = test.targetSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(targetUpdate.lastRunStatus).toBe('PARTIAL');
    expect(targetUpdate.consecutiveFailures).toBeInstanceOf(SQL);
    expect(test.insertValues).toEqual([
      expect.objectContaining({
        attemptNo: 2,
        availableAt: new Date('2026-01-01T00:05:00.000Z'),
        idempotencyKey: 'scheduled:100:retry:2',
        trigger: 'RETRY',
      }),
    ]);
    expect(test.onConflictDoNothing).toHaveBeenCalledWith({
      target: [
        monitoringRuns.workspaceId,
        monitoringRuns.targetId,
        monitoringRuns.idempotencyKey,
      ],
    });
  });

  it('increments FAILED without retrying a permanent error', async () => {
    const test = harness();
    expect(await test.repository.finalize(run, result('FAILED'), 3)).toBe(true);
    const targetUpdate = test.targetSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(targetUpdate.lastRunStatus).toBe('FAILED');
    expect(targetUpdate.consecutiveFailures).toBeInstanceOf(SQL);
    expect(test.insertValues).toEqual([]);
  });

  it('does not update a target or retry after the run lease is lost', async () => {
    const test = harness(false);
    expect(await test.repository.finalize(run, result('FAILED', true), 3)).toBe(false);
    expect(test.targetSet).not.toHaveBeenCalled();
    expect(test.insertValues).toEqual([]);
  });
});
