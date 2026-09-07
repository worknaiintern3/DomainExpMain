import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

import type * as schema from '../schema';

export interface DatabasePoolConfiguration {
  readonly max: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
}

export interface DatabaseConfiguration {
  readonly connectionString: string;
  readonly pool: DatabasePoolConfiguration;
}

export interface SanitizedDatabaseConfiguration {
  readonly connectionString: '[REDACTED]';
  readonly pool: DatabasePoolConfiguration;
}

export interface DatabasePoolErrorEvent {
  readonly event: 'database_pool_error';
}

export interface CreateDatabaseClientOptions {
  readonly onPoolError?: (event: DatabasePoolErrorEvent) => void;
}

export type DatabaseSchema = typeof schema;
export type Database = NodePgDatabase<DatabaseSchema>;
export type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export type DatabaseTransactionOperation<T> = (
  transaction: DatabaseTransaction,
) => Promise<T>;

export interface DatabasePingClient {
  ping(): Promise<void>;
}

export interface DatabaseClient extends DatabasePingClient {
  readonly database: Database;
  readonly pool: Pool;
  transaction<T>(operation: DatabaseTransactionOperation<T>): Promise<T>;
  close(): Promise<void>;
}
