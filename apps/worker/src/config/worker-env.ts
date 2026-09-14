import { z } from 'zod';

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_CLAIM_BATCH_SIZE = 25;
const DEFAULT_LEASE_MS = 300_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MAINTENANCE_INTERVAL_MINUTES = 60;
const DEFAULT_RETENTION_BATCH_SIZE = 100;

const boundedInteger = (
  minimum: number,
  maximum: number,
  fallback: number,
) => z.coerce.number().int().min(minimum).max(maximum).default(fallback);

const WorkerEnvironmentSchema = z
  .object({
    MONITORING_MAINTENANCE_INTERVAL_MINUTES: boundedInteger(
      5,
      1_440,
      DEFAULT_MAINTENANCE_INTERVAL_MINUTES,
    ),
    MONITORING_RETENTION_BATCH_SIZE: boundedInteger(
      10,
      1_000,
      DEFAULT_RETENTION_BATCH_SIZE,
    ),
    MONITORING_RUN_RETENTION_DAYS: boundedInteger(
      7,
      365,
      DEFAULT_RETENTION_DAYS,
    ),
    WORKER_CLAIM_BATCH_SIZE: boundedInteger(
      1,
      1_000,
      DEFAULT_CLAIM_BATCH_SIZE,
    ),
    WORKER_CONCURRENCY: boundedInteger(1, 20, DEFAULT_CONCURRENCY),
    WORKER_LEASE_MS: boundedInteger(30_000, 1_800_000, DEFAULT_LEASE_MS),
    WORKER_MAX_RETRIES: boundedInteger(0, 3, DEFAULT_MAX_RETRIES),
    WORKER_POLL_INTERVAL_MS: boundedInteger(
      1_000,
      300_000,
      DEFAULT_POLL_INTERVAL_MS,
    ),
  })
  .strict();

export interface WorkerConfiguration {
  readonly claimBatchSize: number;
  readonly concurrency: number;
  readonly leaseMs: number;
  readonly maintenanceIntervalMs: number;
  readonly maxRetries: number;
  readonly pollIntervalMs: number;
  readonly retentionBatchSize: number;
  readonly retentionDays: number;
}

export class WorkerConfigurationError extends Error {
  readonly invalidFields: readonly string[];

  constructor(invalidFields: readonly string[]) {
    const fields = [...new Set(invalidFields)].sort();
    super(`Invalid worker configuration (${fields.join(', ')})`);
    this.name = 'WorkerConfigurationError';
    this.invalidFields = fields;
  }
}

export function parseWorkerEnvironment(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
): WorkerConfiguration {
  const result = WorkerEnvironmentSchema.safeParse({
    MONITORING_MAINTENANCE_INTERVAL_MINUTES: environment.MONITORING_MAINTENANCE_INTERVAL_MINUTES,
    MONITORING_RETENTION_BATCH_SIZE: environment.MONITORING_RETENTION_BATCH_SIZE,
    MONITORING_RUN_RETENTION_DAYS: environment.MONITORING_RUN_RETENTION_DAYS,
    WORKER_CLAIM_BATCH_SIZE: environment.WORKER_CLAIM_BATCH_SIZE,
    WORKER_CONCURRENCY: environment.WORKER_CONCURRENCY,
    WORKER_LEASE_MS: environment.WORKER_LEASE_MS,
    WORKER_MAX_RETRIES: environment.WORKER_MAX_RETRIES,
    WORKER_POLL_INTERVAL_MS: environment.WORKER_POLL_INTERVAL_MS,
  });
  if (!result.success) {
    throw new WorkerConfigurationError(
      result.error.issues.map(
        (issue) => issue.path[0]?.toString() ?? 'worker',
      ),
    );
  }
  return {
    claimBatchSize: result.data.WORKER_CLAIM_BATCH_SIZE,
    concurrency: result.data.WORKER_CONCURRENCY,
    leaseMs: result.data.WORKER_LEASE_MS,
    maintenanceIntervalMs: result.data.MONITORING_MAINTENANCE_INTERVAL_MINUTES * 60_000,
    maxRetries: result.data.WORKER_MAX_RETRIES,
    pollIntervalMs: result.data.WORKER_POLL_INTERVAL_MS,
    retentionBatchSize: result.data.MONITORING_RETENTION_BATCH_SIZE,
    retentionDays: result.data.MONITORING_RUN_RETENTION_DAYS,
  };
}
