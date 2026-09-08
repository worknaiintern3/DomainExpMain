import type { DatabaseConfiguration } from '../src/client/database-types';
import {
  parseDatabaseEnvironment,
  parseDatabaseUrl,
} from '../src/config/database-env.schema';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const RLS_TEST_DATABASE_URL = process.env.RLS_TEST_DATABASE_URL;

export const hasDisposableTestDatabase = Boolean(TEST_DATABASE_URL);
export const hasPrivilegedRlsTestDatabase = Boolean(RLS_TEST_DATABASE_URL);

function getDatabaseIdentity(databaseUrl: string): string {
  const parsedUrl = new URL(parseDatabaseUrl(databaseUrl));
  const port = parsedUrl.port || '5432';
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//u, ''));

  return `${parsedUrl.hostname.toLowerCase()}:${port}/${databaseName}`;
}

export function getPrivilegedRlsTestConfiguration(): DatabaseConfiguration {
  if (!RLS_TEST_DATABASE_URL) {
    throw new Error(
      'RLS_TEST_DATABASE_URL is required for privileged RLS integration tests',
    );
  }

  const parsedUrl = new URL(parseDatabaseUrl(RLS_TEST_DATABASE_URL));
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//u, ''));
  const productionUrl = process.env.DATABASE_URL;
  const privilegedDatabaseIdentity = getDatabaseIdentity(RLS_TEST_DATABASE_URL);

  if (!/(?:^|[-_])test(?:[-_]|$)/iu.test(databaseName)) {
    throw new Error(
      'RLS integration test safety check failed: database name must identify a disposable test database',
    );
  }

  if (
    (productionUrl &&
      getDatabaseIdentity(productionUrl) === privilegedDatabaseIdentity) ||
    (TEST_DATABASE_URL &&
      getDatabaseIdentity(TEST_DATABASE_URL) === privilegedDatabaseIdentity)
  ) {
    throw new Error(
      'RLS integration test safety check failed: privileged database must be dedicated',
    );
  }

  return parseDatabaseEnvironment({
    DATABASE_URL: RLS_TEST_DATABASE_URL,
    DATABASE_POOL_MAX: '2',
    DATABASE_IDLE_TIMEOUT_MS: '1000',
    DATABASE_CONNECTION_TIMEOUT_MS: '5000',
  });
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
