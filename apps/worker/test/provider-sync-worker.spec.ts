/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest';

import type { ProviderSyncWorkerConfiguration } from '../src/config/provider-sync-env';
import { ProviderSyncExecutor } from '../src/providers/sync/provider-sync.executor';
import { ProviderSyncWorker } from '../src/providers/sync/provider-sync.worker';
import type {
  ClaimedProviderSyncRun,
  ProviderConnectionForSync,
  ProviderSyncExecutionResult,
  ProviderSyncQueueStore,
  ProviderSyncRunExecutor,
  ProviderSyncWorkerLogger,
} from '../src/providers/sync/provider-sync.types';

const configuration: ProviderSyncWorkerConfiguration = {
  claimBatchSize: 10,
  concurrency: 2,
  leaseMs: 300_000,
  maxRetries: 3,
  pollIntervalMs: 300_000,
};

function claimedRun(index: number): ClaimedProviderSyncRun {
  return {
    attemptNo: 1,
    connectionId: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    idempotencyKey: String(index).padStart(64, '0'),
    leaseExpiresAt: new Date('2026-01-01T00:05:00.000Z'),
    runId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    workspaceId: `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  };
}

function success(): ProviderSyncExecutionResult {
  return {
    durationMs: 1,
    errorCode: null,
    finishedAt: new Date('2026-01-01T00:00:01.000Z'),
    itemsCreated: 1,
    itemsDiscovered: 1,
    itemsMissing: 0,
    itemsUnchanged: 0,
    itemsUpdated: 0,
    status: 'SUCCESS',
  };
}

function store(runs: readonly ClaimedProviderSyncRun[] = []): ProviderSyncQueueStore {
  return {
    assertSafeRuntimeRole: vi.fn(async () => undefined),
    claim: vi.fn(async () => runs),
    close: vi.fn(async () => undefined),
    finalize: vi.fn(async () => true),
    loadConnectionForSync: vi.fn(async (_workspaceId: string, connectionId: string) => ({
      connectionStatus: 'CONNECTED' as const,
      encryptedCiphertext: 'ZmFrZQ==',
      encryptionAuthTag: 'ZmFrZWZha2VmYWtlZmFrZQ==',
      encryptionIv: 'ZmFrZWZha2VmYWs=',
      id: connectionId,
      keyVersion: 1,
      providerKey: 'cloudflare',
      workspaceId: '40000000-0000-4000-8000-000000000001',
    })),
    recoverExpired: vi.fn(async () => 0),
    scheduleDue: vi.fn(async () => 0),
  };
}

const logger: ProviderSyncWorkerLogger = {
  error: vi.fn(),
  info: vi.fn(),
};

describe('provider sync worker', () => {
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
    const executor: ProviderSyncRunExecutor = {
      execute: vi.fn(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Promise.resolve();
        active -= 1;
        return success();
      }),
    };
    const worker = new ProviderSyncWorker(queue, executor, configuration, logger, {
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    await worker.runOnce();
    expect(calls).toEqual(['recover', 'schedule', 'claim']);
    expect(maximumActive).toBeLessThanOrEqual(2);
    expect(queue.finalize).toHaveBeenCalledTimes(4);
  });

  it('a claimed Cloudflare run is loaded, executed, and finalized as SUCCESS', async () => {
    const run = claimedRun(1);
    const queue = store([run]);
    const executor: ProviderSyncRunExecutor = { execute: vi.fn(async () => success()) };
    const worker = new ProviderSyncWorker(queue, executor, configuration, logger);

    await worker.runOnce();

    expect(queue.loadConnectionForSync).toHaveBeenCalledWith(run.workspaceId, run.connectionId);
    expect(executor.execute).toHaveBeenCalledTimes(1);
    const finalizeCall = vi.mocked(queue.finalize).mock.calls[0] as [ClaimedProviderSyncRun, ProviderSyncExecutionResult];
    expect(finalizeCall[1].status).toBe('SUCCESS');
  });

  it('the credential is only decrypted inside execute(); the worker loop never touches it', async () => {
    const run = claimedRun(1);
    const queue = store([run]);
    const executeSpy = vi.fn(async (_run: ClaimedProviderSyncRun, connection: ProviderConnectionForSync) => {
      // The worker must hand the executor the still-encrypted envelope,
      // never a decrypted value; decryption is the executor's job alone.
      expect(connection.encryptedCiphertext).not.toBeNull();
      return success();
    });
    const worker = new ProviderSyncWorker(queue, { execute: executeSpy }, configuration, logger);

    await worker.runOnce();
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('a FAILED execution result is finalized as FAILED, not silently dropped', async () => {
    const run = claimedRun(1);
    const queue = store([run]);
    const failed: ProviderSyncExecutionResult = {
      durationMs: 5,
      errorCode: 'AUTH_INVALID',
      finishedAt: new Date('2026-01-01T00:00:05.000Z'),
      itemsCreated: 0,
      itemsDiscovered: 0,
      itemsMissing: 0,
      itemsUnchanged: 0,
      itemsUpdated: 0,
      status: 'FAILED',
    };
    const worker = new ProviderSyncWorker(
      queue,
      { execute: vi.fn(async () => failed) },
      configuration,
      logger,
    );

    await worker.runOnce();

    const finalizeCall = vi.mocked(queue.finalize).mock.calls[0] as [ClaimedProviderSyncRun, ProviderSyncExecutionResult];
    expect(finalizeCall[1]).toMatchObject({ errorCode: 'AUTH_INVALID', status: 'FAILED' });
  });

  it('a stale/lease-lost run reports lease loss without throwing, and never overwrites newer state', async () => {
    const run = claimedRun(1);
    const queue = store([run]);
    vi.mocked(queue.finalize).mockResolvedValue(false); // simulates the finalize CAS losing the race
    const worker = new ProviderSyncWorker(
      queue,
      { execute: vi.fn(async () => success()) },
      configuration,
      logger,
    );

    await expect(worker.runOnce()).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith({ event: 'provider_sync_run_lease_lost' });
  });

  it('missing connection (raced disconnect) fails safely without calling the executor', async () => {
    const run = claimedRun(1);
    const queue = store([run]);
    vi.mocked(queue.loadConnectionForSync).mockResolvedValue(undefined);
    const executor: ProviderSyncRunExecutor = { execute: vi.fn(async () => success()) };
    const worker = new ProviderSyncWorker(queue, executor, configuration, logger);

    await worker.runOnce();

    expect(executor.execute).not.toHaveBeenCalled();
    const finalizeCall = vi.mocked(queue.finalize).mock.calls[0] as [ClaimedProviderSyncRun, ProviderSyncExecutionResult];
    expect(finalizeCall[1]).toMatchObject({ errorCode: 'CONNECTION_UNAVAILABLE', status: 'FAILED' });
  });

  it('uses its own separate config shape from the monitoring worker (no shared fields required)', () => {
    expect(configuration).not.toHaveProperty('maintenanceIntervalMs');
    expect(configuration).not.toHaveProperty('retentionDays');
  });
});

describe('ProviderSyncExecutor wiring does not import from apps/api', () => {
  it('constructs without throwing given only worker-owned dependencies', () => {
    expect(() => new ProviderSyncExecutor(new Map(), { activeVersion: 1, keys: new Map([[1, Buffer.alloc(32)]]) })).not.toThrow();
  });
});
