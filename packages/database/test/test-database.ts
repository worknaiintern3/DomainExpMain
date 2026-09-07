import type { DatabaseConfiguration } from '../src/client/database-types';
import {
  parseDatabaseEnvironment,
  parseDatabaseUrl,
} from '../src/config/database-env.schema';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export const hasDisposableTestDatabase = Boolean(TEST_DATABASE_URL);

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
