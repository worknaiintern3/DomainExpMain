import fs from 'node:fs';
import path from 'node:path';

import {
  parseDatabaseEnvironment,
  parseDatabaseUrl,
  type DatabaseConfiguration,
} from '@domainpulse/database';

/**
 * Worker-local mirror of the canonical gating helpers in
 * packages/database/test/test-database.ts (same safety semantics).
 * A relative source import is not possible here because the worker
 * tsconfig rootDir (apps/) does not contain packages/, so this file
 * reuses only the exported database config parsers. Only variable
 * presence is inspected; values are never logged or exposed.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const RLS_TEST_DATABASE_URL = process.env.RLS_TEST_DATABASE_URL;

function isPresentString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const hasDisposableTestDatabase = isPresentString(TEST_DATABASE_URL);
export const hasPrivilegedRlsTestDatabase = isPresentString(
  RLS_TEST_DATABASE_URL,
);

function databaseIdentity(databaseUrl: string): string {
  const parsedUrl = new URL(parseDatabaseUrl(databaseUrl));
  const port = parsedUrl.port || '5432';
  const databaseName = decodeURIComponent(
    parsedUrl.pathname.replace(/^\//u, ''),
  );
  return `${parsedUrl.hostname.toLowerCase()}:${port}/${databaseName}`;
}

function requireDisposableTestName(databaseUrl: string): void {
  const databaseName = decodeURIComponent(
    new URL(parseDatabaseUrl(databaseUrl)).pathname.replace(/^\//u, ''),
  );
  if (!/(?:^|[-_])test(?:[-_]|$)/iu.test(databaseName)) {
    throw new Error(
      'Integration test safety check failed: database name must identify a disposable test database',
    );
  }
}

export function getDisposableTestConfiguration(): DatabaseConfiguration {
  if (!isPresentString(TEST_DATABASE_URL)) {
    throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests');
  }
  requireDisposableTestName(TEST_DATABASE_URL);
  const productionUrl = process.env.DATABASE_URL;
  if (productionUrl && parseDatabaseUrl(productionUrl) === TEST_DATABASE_URL) {
    throw new Error(
      'Integration test safety check failed: TEST_DATABASE_URL must differ from DATABASE_URL',
    );
  }
  return parseDatabaseEnvironment({
    DATABASE_CONNECTION_TIMEOUT_MS: '5000',
    DATABASE_IDLE_TIMEOUT_MS: '1000',
    DATABASE_POOL_MAX: '2',
    DATABASE_URL: TEST_DATABASE_URL,
  });
}

export function getPrivilegedRlsTestConfiguration(): DatabaseConfiguration {
  if (!isPresentString(RLS_TEST_DATABASE_URL)) {
    throw new Error(
      'RLS_TEST_DATABASE_URL is required for privileged RLS integration tests',
    );
  }
  requireDisposableTestName(RLS_TEST_DATABASE_URL);
  const privilegedIdentity = databaseIdentity(RLS_TEST_DATABASE_URL);
  const productionUrl = process.env.DATABASE_URL;
  if (
    isPresentString(productionUrl) &&
    databaseIdentity(productionUrl) === privilegedIdentity
  ) {
    throw new Error(
      'RLS integration test safety check failed: privileged database must be dedicated',
    );
  }
  if (
    isPresentString(TEST_DATABASE_URL) &&
    databaseIdentity(TEST_DATABASE_URL) === privilegedIdentity
  ) {
    throw new Error(
      'RLS integration test safety check failed: privileged database must be dedicated',
    );
  }
  return parseDatabaseEnvironment({
    DATABASE_CONNECTION_TIMEOUT_MS: '5000',
    DATABASE_IDLE_TIMEOUT_MS: '1000',
    DATABASE_POOL_MAX: '2',
    DATABASE_URL: RLS_TEST_DATABASE_URL,
  });
}

/**
 * drizzle's migrator resolves relative to process.cwd(). The canonical
 * worker test invocation (npm run test --workspace=@domainpulse/worker)
 * uses apps/worker as cwd; a repo-root vitest invocation uses the root.
 * Probe both instead of relying on import.meta (CommonJS module setting).
 */
export function resolveMigrationsFolder(): string {
  const candidates = [
    path.resolve(process.cwd(), 'packages/database/migrations'),
    path.resolve(process.cwd(), '../../packages/database/migrations'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'meta', '_journal.json'))) {
      return candidate;
    }
  }
  throw new Error('Database migrations folder was not found');
}
