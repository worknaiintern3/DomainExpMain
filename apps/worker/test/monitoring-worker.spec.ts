/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest';

import type { WorkerConfiguration } from '../src/config/worker-env';
import type {
  ClaimedMonitoringRun,
  MonitoringExecutionResult,
  MonitoringQueueStore,
  MonitoringRunExecutor,
  WorkerLogger,
} from '../src/monitoring/monitoring.types';
import { MonitoringWorker } from '../src/monitoring/monitoring.worker';

const configuration: WorkerConfiguration = {
  claimBatchSize: 10,
  concurrency: 2,
  leaseMs: 300_000,
  maxRetries: 3,
  pollIntervalMs: 300_000,
};

function claimedRun(index: number): ClaimedMonitoringRun {
  return {
    attemptNo: 1,
    domainId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    idempotencyKey: `scheduled:${String(index)}`,
    leaseExpiresAt: new Date('2026-01-01T00:05:00.000Z'),
    runId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    targetId: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    workspaceId: `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  };
}

function success(): MonitoringExecutionResult {
  return {
    durationMs: 1,
    errorCode: null,
    finishedAt: new Date('2026-01-01T00:00:01.000Z'),
    retryable: false,
    sourcesAttempted: ['rdap', 'dns', 'tls'],
    sourcesSucceeded: ['rdap', 'dns', 'tls'],
    status: 'SUCCESS',
  };
}

function store(runs: readonly ClaimedMonitoringRun[] = []): MonitoringQueueStore {
  return {
    assertSafeRuntimeRole: vi.fn(async () => undefined),
    claim: vi.fn(async () => runs),
    close: vi.fn(async () => undefined),
    finalize: vi.fn(async () => true),
    findDomain: vi.fn(async () => ({ normalizedDomainName: 'example.com' })),
    recoverExpired: vi.fn(async () => 0),
    scheduleDue: vi.fn(async () => 0),
  };
}

const logger: WorkerLogger = {
  error: vi.fn(),
  info: vi.fn(),
};

describe('monitoring worker', () => {
  it('orders recovery, scheduling, claiming, then processes with bounded concurrency', async () => {
    const calls: string[] = [];
    const runs = [claimedRun(1), claimedRun(2), claimedRun(3), claimedRun(4)];
    const queue = store(runs);
    vi.mocked(queue.recoverExpired).mockImplementation(async () => {
      calls.push('recover');
      return 0;
    });
    vi.mocked(queue.scheduleDue).mockImplementation(async () => {
      calls.push('schedule');
      return 0;
    });
    vi.mocked(queue.claim).mockImplementation(async () => {
      calls.push('claim');
      return runs;
    });
    let active = 0;
    let maximumActive = 0;
    const executor: MonitoringRunExecutor = {
      execute: vi.fn(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Promise.resolve();
        active -= 1;
        return success();
      }),
    };
    const worker = new MonitoringWorker(queue, executor, configuration, logger, {
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    await worker.runOnce();
    expect(calls).toEqual(['recover', 'schedule', 'claim']);
    expect(maximumActive).toBeLessThanOrEqual(2);
    expect(queue.finalize).toHaveBeenCalledTimes(4);
    expect(queue.claim).toHaveBeenCalledWith(expect.any(Date), 2, 300_000);
  });

  it('finalizes an RLS-hidden or removed domain safely without running retrievals', async () => {
    const run = claimedRun(1);
    const queue = store([run]);
    vi.mocked(queue.findDomain).mockResolvedValueOnce(undefined);
    const executor: MonitoringRunExecutor = { execute: vi.fn() };
    await new MonitoringWorker(queue, executor, configuration, logger).runOnce();
    expect(executor.execute).not.toHaveBeenCalled();
    expect(queue.finalize).toHaveBeenCalledWith(
      run,
      expect.objectContaining({
        errorCode: 'MONITORING_DOMAIN_UNAVAILABLE',
        retryable: false,
        status: 'FAILED',
      }),
      3,
    );
  });

  it('converts unexpected execution errors into sanitized retryable failure', async () => {
    const run = claimedRun(1);
    const queue = store([run]);
    const executor: MonitoringRunExecutor = {
      execute: vi.fn(async () => { throw new Error('sensitive failure'); }),
    };
    await new MonitoringWorker(queue, executor, configuration, logger).runOnce();
    expect(queue.finalize).toHaveBeenCalledWith(
      run,
      expect.objectContaining({
        errorCode: 'WORKER_EXECUTION_FAILED',
        retryable: true,
        status: 'FAILED',
      }),
      3,
    );
  });

  it('stops a sleeping loop and closes the pool exactly once', async () => {
    const queue = store();
    const worker = new MonitoringWorker(
      queue,
      { execute: vi.fn() },
      configuration,
      logger,
    );
    const running = worker.start();
    await vi.waitFor(() => {
      expect(queue.claim).toHaveBeenCalledOnce();
    });
    await worker.stop();
    await running;
    await worker.stop();
    expect(queue.assertSafeRuntimeRole).toHaveBeenCalledOnce();
    expect(queue.close).toHaveBeenCalledOnce();
  });

  it('does not schedule or claim after shutdown begins during recovery', async () => {
    const queue = store();
    let releaseRecovery: (() => void) | undefined;
    vi.mocked(queue.recoverExpired).mockImplementationOnce(
      async () => await new Promise<number>((resolve) => {
        releaseRecovery = () => { resolve(0); };
      }),
    );
    const worker = new MonitoringWorker(
      queue,
      { execute: vi.fn() },
      configuration,
      logger,
    );
    const running = worker.start();
    await vi.waitFor(() => {
      expect(queue.recoverExpired).toHaveBeenCalledOnce();
    });
    const stopped = worker.stop();
    if (!releaseRecovery) throw new Error('Recovery release was not initialized');
    releaseRecovery();
    await stopped;
    await running;
    expect(queue.scheduleDue).not.toHaveBeenCalled();
    expect(queue.claim).not.toHaveBeenCalled();
    expect(queue.close).toHaveBeenCalledOnce();
  });
});
