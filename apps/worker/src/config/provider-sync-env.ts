import { z } from 'zod';

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_CLAIM_BATCH_SIZE = 10;
const DEFAULT_LEASE_MS = 300_000;
const DEFAULT_MAX_RETRIES = 3;

const boundedInteger = (
  minimum: number,
  maximum: number,
  fallback: number,
) => z.coerce.number().int().min(minimum).max(maximum).default(fallback);

const ProviderSyncWorkerEnvironmentSchema = z
  .object({
    // Bounds mirror the Phase 10C SQL functions' own argument bounds
    // (schedule/claim/reclaim), so an out-of-range config value fails fast
    // here instead of raising inside the database.
    PROVIDER_SYNC_CLAIM_BATCH_SIZE: boundedInteger(1, 1_000, DEFAULT_CLAIM_BATCH_SIZE),
    PROVIDER_SYNC_CONCURRENCY: boundedInteger(1, 20, DEFAULT_CONCURRENCY),
    PROVIDER_SYNC_LEASE_MS: boundedInteger(30_000, 1_800_000, DEFAULT_LEASE_MS),
    PROVIDER_SYNC_MAX_RETRIES: boundedInteger(0, 3, DEFAULT_MAX_RETRIES),
    PROVIDER_SYNC_POLL_INTERVAL_MS: boundedInteger(1_000, 300_000, DEFAULT_POLL_INTERVAL_MS),
  })
  .strict();

export interface ProviderSyncWorkerConfiguration {
  readonly claimBatchSize: number;
  readonly concurrency: number;
  readonly leaseMs: number;
  readonly maxRetries: number;
  readonly pollIntervalMs: number;
}

export class ProviderSyncWorkerConfigurationError extends Error {
  readonly invalidFields: readonly string[];

  constructor(invalidFields: readonly string[]) {
    const fields = [...new Set(invalidFields)].sort();
    super(`Invalid provider sync worker configuration (${fields.join(', ')})`);
    this.name = 'ProviderSyncWorkerConfigurationError';
    this.invalidFields = fields;
  }
}

export function parseProviderSyncWorkerEnvironment(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ProviderSyncWorkerConfiguration {
  const result = ProviderSyncWorkerEnvironmentSchema.safeParse({
    PROVIDER_SYNC_CLAIM_BATCH_SIZE: environment.PROVIDER_SYNC_CLAIM_BATCH_SIZE,
    PROVIDER_SYNC_CONCURRENCY: environment.PROVIDER_SYNC_CONCURRENCY,
    PROVIDER_SYNC_LEASE_MS: environment.PROVIDER_SYNC_LEASE_MS,
    PROVIDER_SYNC_MAX_RETRIES: environment.PROVIDER_SYNC_MAX_RETRIES,
    PROVIDER_SYNC_POLL_INTERVAL_MS: environment.PROVIDER_SYNC_POLL_INTERVAL_MS,
  });
  if (!result.success) {
    throw new ProviderSyncWorkerConfigurationError(
      result.error.issues.map((issue) => issue.path[0]?.toString() ?? 'provider_sync_worker'),
    );
  }
  return {
    claimBatchSize: result.data.PROVIDER_SYNC_CLAIM_BATCH_SIZE,
    concurrency: result.data.PROVIDER_SYNC_CONCURRENCY,
    leaseMs: result.data.PROVIDER_SYNC_LEASE_MS,
    maxRetries: result.data.PROVIDER_SYNC_MAX_RETRIES,
    pollIntervalMs: result.data.PROVIDER_SYNC_POLL_INTERVAL_MS,
  };
}
