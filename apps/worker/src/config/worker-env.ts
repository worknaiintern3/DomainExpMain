import { z } from 'zod';

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_CLAIM_BATCH_SIZE = 25;
const DEFAULT_LEASE_MS = 300_000;
const DEFAULT_MAX_RETRIES = 3;

const boundedInteger = (
  minimum: number,
  maximum: number,
  fallback: number,
) => z.coerce.number().int().min(minimum).max(maximum).default(fallback);

const WorkerEnvironmentSchema = z
  .object({
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
  readonly maxRetries: number;
  readonly pollIntervalMs: number;
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
    maxRetries: result.data.WORKER_MAX_RETRIES,
    pollIntervalMs: result.data.WORKER_POLL_INTERVAL_MS,
  };
}
