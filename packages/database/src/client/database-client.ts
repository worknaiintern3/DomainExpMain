import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../schema';
import { runInTransaction } from '../transactions/transaction';
import {
  withUserContext,
  withWorkspaceContext,
} from '../transactions/workspace-context';
import type {
  CreateDatabaseClientOptions,
  DatabaseClient,
  DatabaseConfiguration,
  DatabaseTransactionOperation,
} from './database-types';

export class DatabaseUnavailableError extends Error {
  constructor() {
    super('PostgreSQL is unavailable');
    this.name = 'DatabaseUnavailableError';
  }
}

export function createDatabaseClient(
  configuration: DatabaseConfiguration,
  options: CreateDatabaseClientOptions = {},
): DatabaseClient {
  const pool = new Pool({
    connectionString: configuration.connectionString,
    max: configuration.pool.max,
    idleTimeoutMillis: configuration.pool.idleTimeoutMillis,
    connectionTimeoutMillis: configuration.pool.connectionTimeoutMillis,
  });
  pool.on('error', () => {
    options.onPoolError?.({ event: 'database_pool_error' });
  });
  const database = drizzle(pool, { schema, logger: false });
  let closed = false;

  return {
    database,
    pool,
    async ping(): Promise<void> {
      if (closed) {
        throw new DatabaseUnavailableError();
      }

      try {
        await pool.query('select 1');
      } catch {
        throw new DatabaseUnavailableError();
      }
    },
    transaction<T>(operation: DatabaseTransactionOperation<T>): Promise<T> {
      if (closed) {
        return Promise.reject(new DatabaseUnavailableError());
      }

      return runInTransaction(database, operation);
    },
    withUserContext<T>(
      userId: string,
      operation: DatabaseTransactionOperation<T>,
    ): Promise<T> {
      if (closed) {
        return Promise.reject(new DatabaseUnavailableError());
      }

      return withUserContext(database, userId, operation);
    },
    withWorkspaceContext<T>(
      workspaceId: string,
      operation: DatabaseTransactionOperation<T>,
    ): Promise<T> {
      if (closed) {
        return Promise.reject(new DatabaseUnavailableError());
      }

      return withWorkspaceContext(database, workspaceId, operation);
    },
    async close(): Promise<void> {
      if (closed) {
        return;
      }

      closed = true;
      await pool.end();
    },
  };
}
