import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { DatabaseClient, DatabaseConfiguration } from '../src/client/database-types';
import { parseDatabaseEnvironment, parseDatabaseUrl } from '../src/config/database-env.schema';
import { checkDatabaseAvailability } from '../src/health/database-health';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const TEST_TABLE = 'domainpulse_phase2_transaction_probe';

function getDisposableTestConfiguration(): DatabaseConfiguration {
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

const describeWithPostgreSql = TEST_DATABASE_URL ? describe : describe.skip;

describeWithPostgreSql(
  'PostgreSQL integration (not executed without a disposable TEST_DATABASE_URL)',
  () => {
    let configuration: DatabaseConfiguration;
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('PostgreSQL integration client was not initialized');
      }

      return client;
    };

    beforeAll(async () => {
      configuration = getDisposableTestConfiguration();
      client = createDatabaseClient(configuration);
      await client.pool.query(`drop table if exists ${TEST_TABLE}`);
      await client.pool.query(
        `create table ${TEST_TABLE} (marker text primary key)`,
      );
    });

    afterAll(async () => {
      if (!client) {
        return;
      }

      await client.pool.query(`drop table if exists ${TEST_TABLE}`);
      await client.close();
    });

    it('connects and executes SELECT 1 against real PostgreSQL', async () => {
      const activeClient = getClient();

      await expect(activeClient.ping()).resolves.toBeUndefined();
      const result = await activeClient.pool.query<{ value: number }>(
        'select 1 as value',
      );
      expect(result.rows[0]?.value).toBe(1);
    });

    it('applies the reviewed Drizzle migration journal', async () => {
      await expect(
        migrate(getClient().database, { migrationsFolder: './migrations' }),
      ).resolves.toBeUndefined();
    });

    it('commits a successful transaction', async () => {
      const activeClient = getClient();

      await activeClient.transaction(async (transaction) => {
        await transaction.execute(
          sql`insert into domainpulse_phase2_transaction_probe (marker) values ('commit')`,
        );
      });

      const result = await activeClient.pool.query<{ count: string }>(
        `select count(*)::text as count from ${TEST_TABLE} where marker = $1`,
        ['commit'],
      );
      expect(result.rows[0]?.count).toBe('1');
    });

    it('rolls back when a transaction operation throws', async () => {
      const activeClient = getClient();

      await expect(
        activeClient.transaction(async (transaction) => {
          await transaction.execute(
            sql`insert into domainpulse_phase2_transaction_probe (marker) values ('rollback')`,
          );
          throw new Error('expected rollback probe');
        }),
      ).rejects.toThrow('expected rollback probe');

      const result = await activeClient.pool.query<{ count: string }>(
        `select count(*)::text as count from ${TEST_TABLE} where marker = $1`,
        ['rollback'],
      );
      expect(result.rows[0]?.count).toBe('0');
    });

    it('reports available and supports pool shutdown and reopen', async () => {
      const activeClient = getClient();

      await expect(checkDatabaseAvailability(activeClient)).resolves.toBe('available');
      await activeClient.close();

      client = createDatabaseClient(configuration);
      await expect(client.ping()).resolves.toBeUndefined();
    });
  },
);
