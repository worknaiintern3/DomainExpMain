import { describe, expect, it } from 'vitest';

import {
  parseWorkerEnvironment,
  WorkerConfigurationError,
} from '../src/config/worker-env';

describe('worker environment', () => {
  it('uses conservative bounded defaults', () => {
    expect(parseWorkerEnvironment({})).toEqual({
      claimBatchSize: 25,
      concurrency: 5,
      leaseMs: 300_000,
      maintenanceIntervalMs: 3_600_000,
      maxRetries: 3,
      pollIntervalMs: 60_000,
      retentionBatchSize: 100,
      retentionDays: 30,
    });
  });

  it.each([
    ['WORKER_CONCURRENCY', '0'],
    ['WORKER_CLAIM_BATCH_SIZE', '1001'],
    ['WORKER_LEASE_MS', '29999'],
    ['WORKER_MAX_RETRIES', '4'],
    ['WORKER_POLL_INTERVAL_MS', '999'],
    ['MONITORING_RUN_RETENTION_DAYS', '6'],
    ['MONITORING_RUN_RETENTION_DAYS', '366'],
    ['MONITORING_MAINTENANCE_INTERVAL_MINUTES', '4'],
    ['MONITORING_MAINTENANCE_INTERVAL_MINUTES', '1441'],
    ['MONITORING_RETENTION_BATCH_SIZE', '9'],
    ['MONITORING_RETENTION_BATCH_SIZE', '1001'],
  ])('rejects an unsafe %s value', (field, value) => {
    expect(() => parseWorkerEnvironment({ [field]: value })).toThrow(
      WorkerConfigurationError,
    );
  });
});
