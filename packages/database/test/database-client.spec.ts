import { describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import {
  parseDatabaseEnvironment,
  parseDatabaseUrl,
  sanitizeDatabaseConfiguration,
} from '../src/config/database-env.schema';
import { checkDatabaseAvailability } from '../src/health/database-health';

const DATABASE_URL =
  'postgresql://domainpulse_user:super-secret@127.0.0.1:5432/domainpulse_test';

describe('database environment configuration', () => {
  it.each(['postgresql://localhost/domainpulse', 'postgres://localhost/domainpulse'])(
    'accepts a PostgreSQL URL using %s',
    (databaseUrl) => {
      expect(parseDatabaseEnvironment({ DATABASE_URL: databaseUrl }).connectionString).toBe(
        databaseUrl,
      );
    },
  );

  it('rejects non-PostgreSQL protocols without echoing credentials', () => {
    const invalidUrl = 'mysql://private-user:private-password@localhost/domainpulse';

    expect(() => parseDatabaseEnvironment({ DATABASE_URL: invalidUrl })).toThrow(
      'Invalid database configuration (DATABASE_URL)',
    );

    try {
      parseDatabaseEnvironment({ DATABASE_URL: invalidUrl });
    } catch (error) {
      const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
      expect(serialized).not.toContain('private-user');
      expect(serialized).not.toContain('private-password');
      expect(serialized).not.toContain(invalidUrl);
    }
  });

  it('identifies an invalid migration URL without echoing its value', () => {
    expect(() =>
      parseDatabaseUrl(
        'invalid-migration-url',
        'MIGRATION_DATABASE_URL',
      ),
    ).toThrow('Invalid database configuration (MIGRATION_DATABASE_URL)');
  });

  it('validates and normalizes controlled pool settings', () => {
    const configuration = parseDatabaseEnvironment({
      DATABASE_URL,
      DATABASE_POOL_MAX: '20',
      DATABASE_IDLE_TIMEOUT_MS: '45000',
      DATABASE_CONNECTION_TIMEOUT_MS: '2500',
    });

    expect(configuration.pool).toEqual({
      max: 20,
      idleTimeoutMillis: 45_000,
      connectionTimeoutMillis: 2_500,
    });
    expect(() =>
      parseDatabaseEnvironment({ DATABASE_URL, DATABASE_POOL_MAX: '0' }),
    ).toThrow('Invalid database configuration (DATABASE_POOL_MAX)');
    expect(() =>
      parseDatabaseEnvironment({
        DATABASE_URL,
        DATABASE_CONNECTION_TIMEOUT_MS: '99',
      }),
    ).toThrow('Invalid database configuration (DATABASE_CONNECTION_TIMEOUT_MS)');
  });

  it('redacts the URL from sanitized configuration', () => {
    const configuration = parseDatabaseEnvironment({ DATABASE_URL });
    const sanitized = sanitizeDatabaseConfiguration(configuration);
    const serialized = JSON.stringify(sanitized);

    expect(sanitized.connectionString).toBe('[REDACTED]');
    expect(serialized).not.toContain('domainpulse_user');
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain(DATABASE_URL);
  });
});

describe('database client foundation', () => {
  it('creates one controlled pool and closes it idempotently without connecting', async () => {
    const configuration = parseDatabaseEnvironment({ DATABASE_URL });
    const client = createDatabaseClient(configuration);

    expect(client.pool.options.max).toBe(10);
    expect(client.pool.options.idleTimeoutMillis).toBe(30_000);
    expect(client.database).toBeDefined();

    await client.close();
    await client.close();

    expect(client.pool.ended).toBe(true);
    await expect(client.ping()).rejects.toThrow('PostgreSQL is unavailable');
  });

  it('reduces idle pool errors to a credential-free operational event', async () => {
    const events: unknown[] = [];
    const client = createDatabaseClient(parseDatabaseEnvironment({ DATABASE_URL }), {
      onPoolError: (event) => events.push(event),
    });

    client.pool.emit('error', new Error(`connection failed for ${DATABASE_URL}`));

    expect(events).toEqual([{ event: 'database_pool_error' }]);
    expect(JSON.stringify(events)).not.toContain('super-secret');
    await client.close();
  });

  it('sanitizes readiness failures regardless of the low-level error', async () => {
    const secretError = new Error(`connection failed for ${DATABASE_URL}`);
    const result = await checkDatabaseAvailability({
      ping: () => Promise.reject(secretError),
    });
    const serialized = JSON.stringify(result);

    expect(result).toBe('unavailable');
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('127.0.0.1');
  });
});
