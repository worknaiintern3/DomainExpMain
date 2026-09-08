import { z } from 'zod';

import type {
  DatabaseConfiguration,
  SanitizedDatabaseConfiguration,
} from '../client/database-types';

const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;

const PostgreSqlUrlSchema = z.string().trim().min(1).superRefine((value, context) => {
  try {
    const url = new URL(value);

    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      context.addIssue({
        code: 'custom',
        message: 'must use the postgresql:// or postgres:// protocol',
      });
    }
  } catch {
    context.addIssue({
      code: 'custom',
      message: 'must be a valid PostgreSQL connection URL',
    });
  }
});

const IntegerSettingSchema = (minimum: number, maximum: number, fallback: number) =>
  z.coerce.number().int().min(minimum).max(maximum).default(fallback);

const DatabaseEnvironmentSchema = z.object({
  DATABASE_URL: PostgreSqlUrlSchema,
  DATABASE_POOL_MAX: IntegerSettingSchema(1, 100, DEFAULT_POOL_MAX),
  DATABASE_IDLE_TIMEOUT_MS: IntegerSettingSchema(
    1_000,
    300_000,
    DEFAULT_IDLE_TIMEOUT_MS,
  ),
  DATABASE_CONNECTION_TIMEOUT_MS: IntegerSettingSchema(
    100,
    60_000,
    DEFAULT_CONNECTION_TIMEOUT_MS,
  ),
});

export class DatabaseConfigurationError extends Error {
  readonly invalidFields: readonly string[];

  constructor(invalidFields: readonly string[]) {
    const fields = [...new Set(invalidFields)].sort();
    super(`Invalid database configuration (${fields.join(', ')})`);
    this.name = 'DatabaseConfigurationError';
    this.invalidFields = fields;
  }
}

export function parseDatabaseUrl(
  value: string,
  fieldName = 'DATABASE_URL',
): string {
  const result = PostgreSqlUrlSchema.safeParse(value);

  if (!result.success) {
    throw new DatabaseConfigurationError([fieldName]);
  }

  return result.data;
}

export function parseDatabaseEnvironment(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
): DatabaseConfiguration {
  const result = DatabaseEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const invalidFields = result.error.issues.map(
      (issue) => issue.path[0]?.toString() ?? 'database',
    );
    throw new DatabaseConfigurationError(invalidFields);
  }

  return {
    connectionString: result.data.DATABASE_URL,
    pool: {
      max: result.data.DATABASE_POOL_MAX,
      idleTimeoutMillis: result.data.DATABASE_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: result.data.DATABASE_CONNECTION_TIMEOUT_MS,
    },
  };
}

export function sanitizeDatabaseConfiguration(
  configuration: DatabaseConfiguration,
): SanitizedDatabaseConfiguration {
  return {
    connectionString: '[REDACTED]',
    pool: { ...configuration.pool },
  };
}
