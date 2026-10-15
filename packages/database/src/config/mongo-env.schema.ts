import { z } from 'zod';

export interface MongoPoolConfiguration {
  readonly maxPoolSize: number;
  readonly minPoolSize: number;
  readonly connectTimeoutMS: number;
  readonly serverSelectionTimeoutMS: number;
}

export interface MongoConfiguration {
  readonly uri: string;
  readonly databaseName: string;
  readonly pool: MongoPoolConfiguration;
}

export interface SanitizedMongoConfiguration {
  readonly uri: string;
  readonly databaseName: string;
  readonly pool: MongoPoolConfiguration;
}

const DEFAULT_MAX_POOL_SIZE = 20;
const DEFAULT_MIN_POOL_SIZE = 2;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 10_000;
const DEFAULT_DATABASE_NAME = 'domainpulse';

export const MongoUriSchema = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, context) => {
    try {
      if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
        context.addIssue({
          code: 'custom',
          message: 'must use the mongodb:// or mongodb+srv:// protocol',
        });
      }
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'must be a valid MongoDB connection URI',
      });
    }
  });

const IntegerSettingSchema = (minimum: number, maximum: number, fallback: number) =>
  z.coerce.number().int().min(minimum).max(maximum).default(fallback);

export const MongoEnvironmentSchema = z.object({
  MONGODB_URI: MongoUriSchema,
  MONGODB_DATABASE_NAME: z.string().trim().min(1).optional(),
  MONGODB_MAX_POOL_SIZE: IntegerSettingSchema(1, 200, DEFAULT_MAX_POOL_SIZE),
  MONGODB_MIN_POOL_SIZE: IntegerSettingSchema(0, 50, DEFAULT_MIN_POOL_SIZE),
  MONGODB_CONNECT_TIMEOUT_MS: IntegerSettingSchema(
    1_000,
    60_000,
    DEFAULT_CONNECT_TIMEOUT_MS,
  ),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: IntegerSettingSchema(
    1_000,
    60_000,
    DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
  ),
});

export class MongoConfigurationError extends Error {
  readonly invalidFields: readonly string[];

  constructor(invalidFields: readonly string[]) {
    const fields = [...new Set(invalidFields)].sort();
    super(`Invalid MongoDB configuration (${fields.join(', ')})`);
    this.name = 'MongoConfigurationError';
    this.invalidFields = fields;
  }
}

/**
 * Sanitizes a MongoDB connection URI by redacting username and password.
 * Safe for logging and diagnostic output.
 */
export function sanitizeMongoUri(uri: string): string {
  try {
    return uri.replace(/\/\/(.*?)@/, '//***:***@');
  } catch {
    return '[REDACTED_MONGODB_URI]';
  }
}

/**
 * Extracts the database name from the MongoDB URI path or query,
 * falling back to the optional explicit override or DEFAULT_DATABASE_NAME.
 */
export function extractDatabaseNameFromUri(
  uri: string,
  explicitDatabase?: string,
): string {
  if (explicitDatabase && explicitDatabase.trim().length > 0) {
    return explicitDatabase.trim();
  }

  try {
    // Normal URL parsing works for mongodb:// and mongodb+srv://
    // Replace custom protocol with http to parse cleanly with standard URL API
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://'));
    const pathname = parsed.pathname.replace(/^\//, '').split('?')[0]?.trim();
    if (pathname && pathname.length > 0) {
      return pathname;
    }
  } catch {
    // ignore parse error and fallback
  }

  return DEFAULT_DATABASE_NAME;
}

export function parseMongoEnvironment(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
): MongoConfiguration {
  const result = MongoEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const invalidFields = result.error.issues.map(
      (issue) => issue.path[0]?.toString() ?? 'MONGODB_URI',
    );
    throw new MongoConfigurationError(invalidFields);
  }

  const uri = result.data.MONGODB_URI;
  const databaseName = extractDatabaseNameFromUri(
    uri,
    result.data.MONGODB_DATABASE_NAME,
  );

  return {
    uri,
    databaseName,
    pool: {
      maxPoolSize: result.data.MONGODB_MAX_POOL_SIZE,
      minPoolSize: result.data.MONGODB_MIN_POOL_SIZE,
      connectTimeoutMS: result.data.MONGODB_CONNECT_TIMEOUT_MS,
      serverSelectionTimeoutMS: result.data.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    },
  };
}

export function sanitizeMongoConfiguration(
  configuration: MongoConfiguration,
): SanitizedMongoConfiguration {
  return {
    uri: sanitizeMongoUri(configuration.uri),
    databaseName: configuration.databaseName,
    pool: { ...configuration.pool },
  };
}
