import type { ProviderSyncWorkerConfiguration } from '../../config/provider-sync-env';
import type {
  ClaimedProviderSyncRun,
  ProviderSyncQueueStore,
  ProviderSyncRunExecutor,
  ProviderSyncWorkerLogger,
} from './provider-sync.types';

export interface ProviderSyncWorkerClock {
  readonly now: () => Date;
}

const systemClock: ProviderSyncWorkerClock = { now: () => new Date() };

/**
 * Polls, claims, and executes provider sync runs. Deliberately a standalone
 * loop (not shared with MonitoringWorker): separate config, separate
 * concurrency, separate lease duration, so a slow/misbehaving provider sync
 * never starves or is starved by monitoring polling.
 */
export class ProviderSyncWorker {
  private closePromise: Promise<void> | undefined;
  private runPromise: Promise<void> | undefined;
  private stopping = false;
  private wakePoll: (() => void) | undefined;
  private consecutiveFailures = 0;

  constructor(
    private readonly store: ProviderSyncQueueStore,
    private readonly executor: ProviderSyncRunExecutor,
    private readonly configuration: ProviderSyncWorkerConfiguration,
    private readonly logger: ProviderSyncWorkerLogger,
    private readonly clock: ProviderSyncWorkerClock = systemClock,
  ) {}

  start(): Promise<void> {
    this.runPromise ??= this.runLoop();
    return this.runPromise;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.wakePoll?.();
    try {
      await this.runPromise;
    } finally {
      this.closePromise ??= this.store.close();
      await this.closePromise;
    }
  }

  async runOnce(): Promise<void> {
    if (this.stopping) return;
    const now = this.clock.now();

    const recovered = await this.store.recoverExpired(
      now,
      this.configuration.claimBatchSize,
      this.configuration.maxRetries,
    );
    if (recovered > 0) this.logger.info({ count: recovered, event: 'provider_sync_runs_recovered' });
    if (this.shouldStop()) return;

    const scheduled = await this.store.scheduleDue(now, this.configuration.claimBatchSize);
    if (scheduled > 0) this.logger.info({ count: scheduled, event: 'provider_sync_runs_scheduled' });
    if (this.shouldStop()) return;

    const claimLimit = Math.min(this.configuration.claimBatchSize, this.configuration.concurrency);
    const runs = await this.store.claim(now, claimLimit, this.configuration.leaseMs);
    if (runs.length > 0) this.logger.info({ count: runs.length, event: 'provider_sync_runs_claimed' });
    await this.processBounded(runs);
  }

  private async runLoop(): Promise<void> {
    await this.store.assertSafeRuntimeRole();
    this.logger.info({ event: 'provider_sync_worker_started' });
    while (!this.stopping) {
      try {
        await this.runOnce();
        this.consecutiveFailures = 0;
      } catch {
        this.consecutiveFailures += 1;
        this.logger.error({ event: 'provider_sync_worker_cycle_failed' });
      }
      await this.waitForPollWithBackoff();
    }
    this.logger.info({ event: 'provider_sync_worker_stopped' });
  }

  private async processBounded(runs: readonly ClaimedProviderSyncRun[]): Promise<void> {
    const pending = [...runs];
    const processNext = async (): Promise<void> => {
      for (;;) {
        const run = pending.shift();
        if (!run) return;
        await this.processRun(run);
      }
    };
    const workers = Array.from(
      { length: Math.min(this.configuration.concurrency, runs.length) },
      async () => {
        await processNext();
      },
    );
    await Promise.all(workers);
  }

  private async processRun(run: ClaimedProviderSyncRun): Promise<void> {
    try {
      // Loaded fresh (not from claim-time data, which carries no
      // credential): the credential is decrypted only during execution,
      // and only after re-confirming the connection is still CONNECTED.
      const connection = await this.store.loadConnectionForSync(run.workspaceId, run.connectionId);
      const result = connection
        ? await this.executor.execute(run, connection)
        : {
            durationMs: 0,
            errorCode: 'CONNECTION_UNAVAILABLE',
            finishedAt: this.clock.now(),
            itemsCreated: 0,
            itemsDiscovered: 0,
            itemsMissing: 0,
            itemsUnchanged: 0,
            itemsUpdated: 0,
            status: 'FAILED' as const,
          };

      const finalized = await this.store.finalize(run, result);
      if (!finalized) {
        this.logger.info({ event: 'provider_sync_run_lease_lost' });
        return;
      }
      this.logger.info({ count: 1, event: `provider_sync_run_${result.status.toLowerCase()}` });
    } catch {
      this.logger.error({ event: 'provider_sync_run_processing_failed' });
    }
  }

  private async waitForPollWithBackoff(): Promise<void> {
    if (this.stopping) return;
    const base = this.configuration.pollIntervalMs;
    const backoff = this.consecutiveFailures > 0
      ? Math.min(base * Math.pow(2, Math.min(this.consecutiveFailures, 4)), 300_000)
      : base;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, backoff);
      this.wakePoll = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    this.wakePoll = undefined;
  }

  private shouldStop(): boolean {
    return this.stopping;
  }
}
