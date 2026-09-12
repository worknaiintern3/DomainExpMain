import type { WorkerConfiguration } from '../config/worker-env';
import type {
  AlertEvaluationHooks,
  ChangeBaseline,
} from '../alerts/alert.types';
import type {
  ClaimedMonitoringRun,
  MonitoringExecutionResult,
  MonitoringQueueStore,
  MonitoringRunExecutor,
  WorkerLogger,
} from './monitoring.types';

export interface MonitoringWorkerClock {
  readonly now: () => Date;
}

const systemClock: MonitoringWorkerClock = { now: () => new Date() };

function unexpectedFailure(finishedAt: Date): MonitoringExecutionResult {
  return {
    durationMs: 0,
    errorCode: 'WORKER_EXECUTION_FAILED',
    finishedAt,
    retryable: true,
    sourcesAttempted: [],
    sourcesSucceeded: [],
    status: 'FAILED',
  };
}

function unavailableDomain(finishedAt: Date): MonitoringExecutionResult {
  return {
    durationMs: 0,
    errorCode: 'MONITORING_DOMAIN_UNAVAILABLE',
    finishedAt,
    retryable: false,
    sourcesAttempted: [],
    sourcesSucceeded: [],
    status: 'FAILED',
  };
}

export class MonitoringWorker {
  private closePromise: Promise<void> | undefined;
  private runPromise: Promise<void> | undefined;
  private stopping = false;
  private wakePoll: (() => void) | undefined;

  constructor(
    private readonly store: MonitoringQueueStore,
    private readonly executor: MonitoringRunExecutor,
    private readonly configuration: WorkerConfiguration,
    private readonly logger: WorkerLogger,
    private readonly clock: MonitoringWorkerClock = systemClock,
    private readonly alertEvaluator?: AlertEvaluationHooks,
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
    if (recovered > 0) this.logger.info({ count: recovered, event: 'monitoring_runs_recovered' });
    if (this.shouldStop()) return;

    const scheduled = await this.store.scheduleDue(
      now,
      this.configuration.claimBatchSize,
    );
    if (scheduled > 0) this.logger.info({ count: scheduled, event: 'monitoring_runs_scheduled' });
    if (this.shouldStop()) return;

    const claimLimit = Math.min(
      this.configuration.claimBatchSize,
      this.configuration.concurrency,
    );
    const runs = await this.store.claim(now, claimLimit, this.configuration.leaseMs);
    if (runs.length > 0) this.logger.info({ count: runs.length, event: 'monitoring_runs_claimed' });
    await this.processBounded(runs);
  }

  private async runLoop(): Promise<void> {
    await this.store.assertSafeRuntimeRole();
    this.logger.info({ event: 'monitoring_worker_started' });
    while (!this.stopping) {
      try {
        await this.runOnce();
      } catch {
        this.logger.error({ event: 'monitoring_worker_cycle_failed' });
      }
      await this.waitForPoll();
    }
    this.logger.info({ event: 'monitoring_worker_stopped' });
  }

  private async processBounded(runs: readonly ClaimedMonitoringRun[]): Promise<void> {
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

  private async processRun(run: ClaimedMonitoringRun): Promise<void> {
    let result: MonitoringExecutionResult;
    let domainAvailable = false;
    let alertBaseline: ChangeBaseline | null = null;
    try {
      const domain = await this.store.findDomain(run);
      if (!domain) {
        result = unavailableDomain(this.clock.now());
      } else {
        domainAvailable = true;
        alertBaseline = await this.captureAlertBaseline(run);
        result = await this.executor.execute(run, domain);
      }
    } catch {
      result = unexpectedFailure(this.clock.now());
    }
    try {
      const finalized = await this.store.finalize(
        run,
        result,
        this.configuration.maxRetries,
      );
      if (!finalized) {
        this.logger.info({ event: 'monitoring_run_lease_lost' });
        return;
      }
    } catch {
      this.logger.error({ event: 'monitoring_run_finalize_failed' });
      return;
    }
    if (domainAvailable) {
      await this.evaluateAlerts(run, result, alertBaseline);
    }
  }

  private async captureAlertBaseline(
    run: ClaimedMonitoringRun,
  ): Promise<ChangeBaseline | null> {
    if (!this.alertEvaluator) return null;
    try {
      return await this.alertEvaluator.captureBaseline(run);
    } catch {
      this.logger.error({ event: 'monitoring_alert_baseline_failed' });
      return null;
    }
  }

  private async evaluateAlerts(
    run: ClaimedMonitoringRun,
    result: MonitoringExecutionResult,
    baseline: ChangeBaseline | null,
  ): Promise<void> {
    if (!this.alertEvaluator) return;
    try {
      await this.alertEvaluator.evaluateAfterRun(run, result, baseline);
    } catch {
      this.logger.error({ event: 'monitoring_alert_evaluation_failed' });
    }
  }

  private async waitForPoll(): Promise<void> {
    if (this.stopping) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, this.configuration.pollIntervalMs);
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
