/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest';

import { AlertEvaluator } from '../src/alerts/alert-evaluator';
import type {
  AlertEvaluationHooks,
  AlertEvaluationSummary,
  AlertRuleState,
  AlertSnapshotState,
  ChangeBaseline,
} from '../src/alerts/alert.types';
import type { WorkerConfiguration } from '../src/config/worker-env';
import { MonitoringWorker } from '../src/monitoring/monitoring.worker';
import type {
  ClaimedMonitoringRun,
  MonitoringExecutionResult,
  MonitoringQueueStore,
  MonitoringRunExecutor,
  WorkerLogger,
} from '../src/monitoring/monitoring.types';
import { InMemoryAlertStore } from './alert-test-store';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const WORKSPACE_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const DOMAIN_A = '11111111-0000-4000-8000-000000000001';
const TARGET_A = '22222222-0000-4000-8000-000000000001';
const RUN_A = '33333333-0000-4000-8000-000000000001';

const configuration: WorkerConfiguration = {
  claimBatchSize: 10,
  concurrency: 1,
  leaseMs: 300_000,
  maxRetries: 3,
  pollIntervalMs: 300_000,
};

function claimedRun(): ClaimedMonitoringRun {
  return {
    attemptNo: 1,
    domainId: DOMAIN_A,
    idempotencyKey: 'scheduled:1',
    leaseExpiresAt: new Date('2026-03-01T00:05:00.000Z'),
    runId: RUN_A,
    targetId: TARGET_A,
    workspaceId: WORKSPACE_A,
  };
}

function successResult(): MonitoringExecutionResult {
  return {
    durationMs: 5,
    errorCode: null,
    finishedAt: NOW,
    retryable: false,
    sourcesAttempted: ['rdap', 'dns', 'tls'],
    sourcesSucceeded: ['rdap', 'dns', 'tls'],
    status: 'SUCCESS',
  };
}

function logger(): WorkerLogger {
  return { error: vi.fn(), info: vi.fn() };
}

function queue(
  overrides: Partial<MonitoringQueueStore> = {},
): MonitoringQueueStore {
  return {
    assertSafeRuntimeRole: vi.fn(async () => undefined),
    claim: vi.fn(async () => [claimedRun()]),
    close: vi.fn(async () => undefined),
    finalize: vi.fn(async () => true),
    findDomain: vi.fn(async () => ({ normalizedDomainName: 'example.com' })),
    recoverExpired: vi.fn(async () => 0),
    scheduleDue: vi.fn(async () => 0),
    ...overrides,
  };
}

function executor(): MonitoringRunExecutor {
  return { execute: vi.fn(async () => successResult()) };
}

function warningRule(): AlertRuleState {
  return {
    enabled: true,
    id: 'rule-warning',
    key: 'DOMAIN_EXPIRY_WARNING',
    severity: 'WARNING',
    thresholdCount: null,
    thresholdDays: 14,
  };
}

function warningSnapshots(): AlertSnapshotState {
  return {
    dns: null,
    rdap: {
      expiresAt: new Date(NOW.getTime() + 10 * 86_400_000),
      retrievedAt: NOW,
    },
    tls: null,
  };
}

describe('worker alert integration', () => {
  it('triggers alert evaluation after a terminal run finalizes', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [warningRule()]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, warningSnapshots());
    const hooks = new AlertEvaluator(store, { now: () => NOW });
    const evaluate = vi.spyOn(hooks, 'evaluateAfterRun');
    const capture = vi.spyOn(hooks, 'captureBaseline');
    const worker = new MonitoringWorker(queue(), executor(), configuration, logger(), {
      now: () => NOW,
    }, hooks);
    await worker.runOnce();
    expect(capture).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledOnce();
    const [evaluatedRun, evaluatedResult, baseline] = evaluate.mock.calls[0] ?? [];
    expect(evaluatedRun).toMatchObject({ runId: RUN_A, workspaceId: WORKSPACE_A });
    expect(evaluatedResult).toMatchObject({ status: 'SUCCESS' });
    expect(baseline).toEqual({ dnsFingerprint: null, tlsFingerprint: null });
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);
  });

  it('does not revert a completed run when evaluation fails', async () => {
    const failing: AlertEvaluationHooks = {
      captureBaseline: vi.fn(async () => null),
      evaluateAfterRun: vi.fn(async (): Promise<AlertEvaluationSummary> => {
        throw new Error('alert storage unavailable');
      }),
    };
    const queueStore = queue();
    const messages = logger();
    const worker = new MonitoringWorker(queueStore, executor(), configuration, messages, {
      now: () => NOW,
    }, failing);
    await worker.runOnce();
    expect(vi.mocked(queueStore.finalize)).toHaveBeenCalledOnce();
    expect(vi.mocked(messages.error)).toHaveBeenCalledWith({
      event: 'monitoring_alert_evaluation_failed',
    });
  });

  it('skips evaluation when the run lease is lost', async () => {
    const hooks: AlertEvaluationHooks = {
      captureBaseline: vi.fn(async () => null),
      evaluateAfterRun: vi.fn(async () => ({ opened: [], resolved: [], touched: [] })),
    };
    const messages = logger();
    const worker = new MonitoringWorker(
      queue({ finalize: vi.fn(async () => false) }),
      executor(),
      configuration,
      messages,
      { now: () => NOW },
      hooks,
    );
    await worker.runOnce();
    expect(hooks.evaluateAfterRun).not.toHaveBeenCalled();
    expect(vi.mocked(messages.info)).toHaveBeenCalledWith({ event: 'monitoring_run_lease_lost' });
  });

  it('skips evaluation when the domain is unavailable', async () => {
    const hooks: AlertEvaluationHooks = {
      captureBaseline: vi.fn(async () => null),
      evaluateAfterRun: vi.fn(async () => ({ opened: [], resolved: [], touched: [] })),
    };
    const queueStore = queue({ findDomain: vi.fn(async () => undefined) });
    const worker = new MonitoringWorker(queueStore, executor(), configuration, logger(), {
      now: () => NOW,
    }, hooks);
    await worker.runOnce();
    expect(vi.mocked(queueStore.finalize)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorCode: 'MONITORING_DOMAIN_UNAVAILABLE' }),
      3,
    );
    expect(hooks.captureBaseline).not.toHaveBeenCalled();
    expect(hooks.evaluateAfterRun).not.toHaveBeenCalled();
  });

  it('continues the run when baseline capture fails', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [warningRule()]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, warningSnapshots());
    const engine = new AlertEvaluator(store, { now: () => NOW });
    const hooks: AlertEvaluationHooks = {
      captureBaseline: vi.fn(async (): Promise<ChangeBaseline | null> => {
        throw new Error('baseline unavailable');
      }),
      evaluateAfterRun: vi.fn(
        async (
          evalRun: ClaimedMonitoringRun,
          evalResult: MonitoringExecutionResult,
          evalBaseline: ChangeBaseline | null,
        ) => await engine.evaluateAfterRun(evalRun, evalResult, evalBaseline),
      ),
    };
    const messages = logger();
    const queueStore = queue();
    const worker = new MonitoringWorker(queueStore, executor(), configuration, messages, {
      now: () => NOW,
    }, hooks);
    await worker.runOnce();
    expect(vi.mocked(queueStore.finalize)).toHaveBeenCalledOnce();
    expect(vi.mocked(messages.error)).toHaveBeenCalledWith({
      event: 'monitoring_alert_baseline_failed',
    });
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);
  });

  it('performs no evaluation without a configured evaluator', async () => {
    const messages = logger();
    const queueStore = queue();
    const worker = new MonitoringWorker(queueStore, executor(), configuration, messages, {
      now: () => NOW,
    });
    await worker.runOnce();
    expect(vi.mocked(queueStore.finalize)).toHaveBeenCalledOnce();
    expect(vi.mocked(messages.error)).not.toHaveBeenCalled();
  });
});
