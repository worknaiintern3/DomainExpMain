import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { parsePrivilegedRlsTestConfiguration } from './test-database';

function createSyntheticRlsTestUrl(includePassword: boolean): string {
  const url = new URL('postgresql://127.0.0.1');
  url.username = 'rls_test_user';
  if (includePassword) {
    url.password = randomUUID();
  }
  url.port = '5432';
  url.pathname = '/domainpulse_rls_test';
  return url.toString();
}

describe('privileged RLS test database configuration', () => {
  it('preserves a password-bearing URL as a string configuration value', () => {
    const configuration = parsePrivilegedRlsTestConfiguration({
      RLS_TEST_DATABASE_URL: createSyntheticRlsTestUrl(true),
    });
    const parsedConfiguration = new URL(configuration.connectionString);

    expect(typeof configuration.connectionString).toBe('string');
    expect(typeof parsedConfiguration.password).toBe('string');
    expect(parsedConfiguration.password.length).toBeGreaterThan(0);
  });

  it('rejects a present URL without a password before node-postgres receives it', () => {
    expect(() =>
      parsePrivilegedRlsTestConfiguration({
        RLS_TEST_DATABASE_URL: createSyntheticRlsTestUrl(false),
      }),
    ).toThrow('Invalid database configuration (RLS_TEST_DATABASE_URL)');
  });

  it('preserves the dedicated-database identity check', () => {
    const sharedDatabaseUrl = createSyntheticRlsTestUrl(true);

    expect(() =>
      parsePrivilegedRlsTestConfiguration({
        RLS_TEST_DATABASE_URL: sharedDatabaseUrl,
        TEST_DATABASE_URL: sharedDatabaseUrl,
      }),
    ).toThrow(
      'RLS integration test safety check failed: privileged database must be dedicated',
    );
  });
});
