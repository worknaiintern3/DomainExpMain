import type {
  Database,
  DatabaseTransactionOperation,
} from '../client/database-types';

export function runInTransaction<T>(
  database: Database,
  operation: DatabaseTransactionOperation<T>,
): Promise<T> {
  return database.transaction(operation);
}
