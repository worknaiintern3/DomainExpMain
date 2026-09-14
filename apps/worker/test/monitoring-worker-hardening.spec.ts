import { describe, expect, it, vi } from 'vitest';

import type { WorkerConfiguration } from '../src/config/worker-env';
import { MonitoringWorker } from '../src/monitoring/monitoring.worker';
import type { MonitoringQueueStore, MonitoringRunExecutor } from '../src/monitoring/monitoring.types';

function createMockStore(overrides: Partial<MonitoringQueueStore> = {}): MonitoringQueueStore {
  return {
    assertSafeRuntimeRole: vi.fn().mockResolvedValue(undefined),
    claim: vi.fn().mockResolvedValue([]),
    cleanupOldTerminalRuns: vi.fn().mockResolvedValue(0),
    close: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(true),
    findDomain: vi.fn().mockResolvedValue({ normalizedDomainName: 'example.test' }),
    recoverExpired: vi.fn().mockResolvedValue(0),
    scheduleDue: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function createMockExecutor(): MonitoringRunExecutor {
  return {
    execute: vi.fn().mockResolvedValue({
      durationMs: 10,
      errorCode: null,
      finishedAt: new Date(),
      retryable: false,
      sourcesAttempted: [],
      sourcesSucceeded: [],
      status: 'SUCCESS',
    }),
  };
}

function createConfig(overrides: Partial<WorkerConfiguration> = {}): WorkerConfiguration {
  return {
    claimBatchSize: 5,
    concurrency: 2,
    leaseMs: 300000,
    maintenanceIntervalMs: 60 * 60 * 1000,
    maxRetries: 3,
    pollIntervalMs: 1000,
    retentionBatchSize: 100,
    retentionDays: 30,
    ...overrides,
  };
}

describe('monitoring worker hardening', () => {
  it('shutdown stops new claims', async () => {
    const store = createMockStore();
    const worker = new MonitoringWorker(store, createMockExecutor(), createConfig({ pollIntervalMs: 50 }), { error: vi.fn(), info: vi.fn() }, { now: () => new Date() });
    const running = worker.start();
    // allow one poll
    await new Promise((r) => setTimeout(r, 20));
    await worker.stop();
    await running;
    const claimCallsBefore = (store.claim as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    await new Promise((r) => setTimeout(r, 60));
    const claimCallsAfter = (store.claim as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(claimCallsAfter).toBe(claimCallsBefore);
  });

  it('shutdown does not start maintenance after in-flight work finishes', async () => {
    let finishExecution: (() => void) | undefined;
    const executionFinished = new Promise<void>((resolve) => {
      finishExecution = resolve;
    });
    const cleanupOldTerminalRuns = vi.fn().mockResolvedValue(0);
    const store = createMockStore({
      claim: vi.fn().mockResolvedValue([
        {
          attemptNo: 1,
          domainId: 'domain-1',
          idempotencyKey: 'key-1',
          leaseExpiresAt: new Date(Date.now() + 60_000),
          runId: 'run-1',
          targetId: 'target-1',
          workspaceId: 'workspace-1',
        },
      ]),
      cleanupOldTerminalRuns,
    });
    const execute = vi.fn().mockImplementation(async () => {
      await executionFinished;
      return {
        durationMs: 10,
        errorCode: null,
        finishedAt: new Date(),
        retryable: false,
        sourcesAttempted: [],
        sourcesSucceeded: [],
        status: 'SUCCESS' as const,
      };
    });
    const executor: MonitoringRunExecutor = {
      execute,
    };
    const worker = new MonitoringWorker(store, executor, createConfig(), { error: vi.fn(), info: vi.fn() }, { now: () => new Date() });
    const running = worker.start();
    await vi.waitFor(() => {
      expect(execute).toHaveBeenCalledOnce();
    });
    const stopping = worker.stop();
    finishExecution?.();
    await stopping;
    await running;
    expect(cleanupOldTerminalRuns).not.toHaveBeenCalled();
  });

  it('poll loops do not overlap uncontrollably', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const store = createMockStore({
      claim: vi.fn().mockImplementation(async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 20));
        concurrent -= 1;
        return [];
      }),
      recoverExpired: vi.fn().mockResolvedValue(0),
      scheduleDue: vi.fn().mockResolvedValue(0),
    });
    const worker = new MonitoringWorker(store, createMockExecutor(), createConfig({ pollIntervalMs: 30 }), { error: vi.fn(), info: vi.fn() }, { now: () => new Date() });
    const running = worker.start();
    await new Promise((r) => setTimeout(r, 80));
    await worker.stop();
    await running;
    expect(maxConcurrent).toBeLessThanOrEqual(1);
  });

  it('DB failure backs off and does not tight loop', async () => {
    const store = createMockStore({
      recoverExpired: vi.fn().mockRejectedValue(new Error('DB down')),
    });
    const logger = { error: vi.fn(), info: vi.fn() };
    const worker = new MonitoringWorker(store, createMockExecutor(), createConfig({ pollIntervalMs: 30 }), logger, { now: () => new Date() });
    const running = worker.start();
    await new Promise((r) => setTimeout(r, 80));
    await worker.stop();
    await running;
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: 'monitoring_worker_cycle_failed' }));
    // Should have backed off, not called recoverExpired more than 3 times in 80ms with 30ms poll + backoff
    const calls = (store.recoverExpired as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(calls).toBeLessThan(5);
  });

  it('concurrency stays bounded', async () => {
    const store = createMockStore({
      claim: vi.fn().mockResolvedValue([
        { attemptNo: 1, domainId: 'd1', idempotencyKey: 'k1', leaseExpiresAt: new Date(Date.now() + 10000), runId: 'r1', targetId: 't1', workspaceId: 'w1' },
        { attemptNo: 1, domainId: 'd2', idempotencyKey: 'k2', leaseExpiresAt: new Date(Date.now() + 10000), runId: 'r2', targetId: 't2', workspaceId: 'w1' },
        { attemptNo: 1, domainId: 'd3', idempotencyKey: 'k3', leaseExpiresAt: new Date(Date.now() + 10000), runId: 'r3', targetId: 't3', workspaceId: 'w1' },
      ]),
      findDomain: vi.fn().mockResolvedValue({ normalizedDomainName: 'example.test' }),
    });
    let concurrentExecutions = 0;
    let maxExecutions = 0;
    const executor: MonitoringRunExecutor = {
      execute: vi.fn().mockImplementation(async () => {
        concurrentExecutions += 1;
        maxExecutions = Math.max(maxExecutions, concurrentExecutions);
        await new Promise((r) => setTimeout(r, 20));
        concurrentExecutions -= 1;
        return { durationMs: 10, errorCode: null, finishedAt: new Date(), retryable: false, sourcesAttempted: [], sourcesSucceeded: [], status: 'SUCCESS' };
      }),
    };
    const worker = new MonitoringWorker(store, executor, createConfig({ concurrency: 2, pollIntervalMs: 1000 }), { error: vi.fn(), info: vi.fn() }, { now: () => new Date() });
    await worker.runOnce();
    expect(maxExecutions).toBeLessThanOrEqual(2);
  });

  it('does not overlap maintenance work', async () => {
    let finishMaintenance: (() => void) | undefined;
    const maintenanceFinished = new Promise<void>((resolve) => {
      finishMaintenance = resolve;
    });
    const cleanupOldTerminalRuns = vi.fn().mockImplementation(async () => {
      await maintenanceFinished;
      return 0;
    });
    const store = createMockStore({ cleanupOldTerminalRuns });
    const worker = new MonitoringWorker(store, createMockExecutor(), createConfig(), { error: vi.fn(), info: vi.fn() }, { now: () => new Date() });

    const first = worker.runOnce();
    await vi.waitFor(() => {
      expect(cleanupOldTerminalRuns).toHaveBeenCalledOnce();
    });
    const second = worker.runOnce();
    await second;
    expect(cleanupOldTerminalRuns).toHaveBeenCalledOnce();
    finishMaintenance?.();
    await first;
  });

  it('paces maintenance retries after a cleanup failure', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const cleanupOldTerminalRuns = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const logger = { error: vi.fn(), info: vi.fn() };
    const store = createMockStore({ cleanupOldTerminalRuns });
    const worker = new MonitoringWorker(store, createMockExecutor(), createConfig(), logger, { now: () => now });

    await worker.runOnce();
    await worker.runOnce();

    expect(cleanupOldTerminalRuns).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith({ event: 'monitoring_maintenance_failed' });
  });

  it('logs contain no secrets', async () => {
    const store = createMockStore();
    const logger = { error: vi.fn(), info: vi.fn() };
    const worker = new MonitoringWorker(store, createMockExecutor(), createConfig(), logger, { now: () => new Date() });
    await worker.runOnce();
    const allLogs = [...logger.info.mock.calls, ...logger.error.mock.calls].map((call) => JSON.stringify(call[0]));
    const serialized = allLogs.join(' ');
    for (const secret of ['DATABASE_URL', 'password', 'BEGIN PRIVATE KEY', 'BEGIN CERTIFICATE', 'Idempotency-Key']) {
      expect(serialized).not.toContain(secret);
    }
  });
});
