import type { DatabaseConfiguration } from '../src/client/database-types';
import {
  DatabaseConfigurationError,
  parseDatabaseEnvironment,
  parseDatabaseUrl,
} from '../src/config/database-env.schema';

interface TestDatabaseEnvironment {
  readonly DATABASE_URL?: string;
  readonly RLS_TEST_DATABASE_URL?: string;
  readonly TEST_DATABASE_URL?: string;
}

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const RLS_TEST_DATABASE_URL = process.env.RLS_TEST_DATABASE_URL;

function isPresentString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const hasDisposableTestDatabase = isPresentString(TEST_DATABASE_URL);
export const hasPrivilegedRlsTestDatabase = isPresentString(
  RLS_TEST_DATABASE_URL,
);

function getDatabaseIdentity(databaseUrl: string): string {
  const parsedUrl = new URL(parseDatabaseUrl(databaseUrl));
  const port = parsedUrl.port || '5432';
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//u, ''));

  return `${parsedUrl.hostname.toLowerCase()}:${port}/${databaseName}`;
}

export function parsePrivilegedRlsTestConfiguration(
  environment: TestDatabaseEnvironment,
): DatabaseConfiguration {
  const privilegedDatabaseUrl = environment.RLS_TEST_DATABASE_URL;
  if (!isPresentString(privilegedDatabaseUrl)) {
    throw new Error(
      'RLS_TEST_DATABASE_URL is required for privileged RLS integration tests',
    );
  }

  const validatedDatabaseUrl = parseDatabaseUrl(
    privilegedDatabaseUrl,
    'RLS_TEST_DATABASE_URL',
  );
  const parsedUrl = new URL(validatedDatabaseUrl);
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//u, ''));
  const queryPassword = parsedUrl.searchParams.get('password');
  const hasStringPassword =
    parsedUrl.password.length > 0 ||
    (typeof queryPassword === 'string' && queryPassword.length > 0);

  if (!hasStringPassword) {
    throw new DatabaseConfigurationError(['RLS_TEST_DATABASE_URL']);
  }

  const productionUrl = environment.DATABASE_URL;
  const ordinaryTestUrl = environment.TEST_DATABASE_URL;
  const privilegedDatabaseIdentity = getDatabaseIdentity(validatedDatabaseUrl);

  if (!/(?:^|[-_])test(?:[-_]|$)/iu.test(databaseName)) {
    throw new Error(
      'RLS integration test safety check failed: database name must identify a disposable test database',
    );
  }

  if (
    (isPresentString(productionUrl) &&
      getDatabaseIdentity(productionUrl) === privilegedDatabaseIdentity) ||
    (isPresentString(ordinaryTestUrl) &&
      getDatabaseIdentity(ordinaryTestUrl) === privilegedDatabaseIdentity)
  ) {
    throw new Error(
      'RLS integration test safety check failed: privileged database must be dedicated',
    );
  }

  return parseDatabaseEnvironment({
    DATABASE_URL: validatedDatabaseUrl,
    DATABASE_POOL_MAX: '2',
    DATABASE_IDLE_TIMEOUT_MS: '1000',
    DATABASE_CONNECTION_TIMEOUT_MS: '5000',
  });
}

export function getPrivilegedRlsTestConfiguration(): DatabaseConfiguration {
  return parsePrivilegedRlsTestConfiguration(process.env);
}

export function getDisposableTestConfiguration(): DatabaseConfiguration {
  if (!TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests');
  }

  const parsedUrl = new URL(parseDatabaseUrl(TEST_DATABASE_URL));
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//u, ''));
  const productionUrl = process.env.DATABASE_URL;

  if (!/(?:^|[-_])test(?:[-_]|$)/iu.test(databaseName)) {
    throw new Error(
      'Integration test safety check failed: database name must identify a disposable test database',
    );
  }

  if (productionUrl && parseDatabaseUrl(productionUrl) === TEST_DATABASE_URL) {
    throw new Error(
      'Integration test safety check failed: TEST_DATABASE_URL must differ from DATABASE_URL',
    );
  }

  return parseDatabaseEnvironment({
    DATABASE_URL: TEST_DATABASE_URL,
    DATABASE_POOL_MAX: '2',
    DATABASE_IDLE_TIMEOUT_MS: '1000',
    DATABASE_CONNECTION_TIMEOUT_MS: '5000',
  });
}
