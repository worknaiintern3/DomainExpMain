import { sql } from 'drizzle-orm';
import { z } from 'zod';

import type {
  Database,
  DatabaseTransaction,
  DatabaseTransactionOperation,
} from '../client/database-types';

const DatabaseContextIdSchema = z.uuid();
const WORKSPACE_CONTEXT_SETTING = 'domainpulse.workspace_id';
const USER_CONTEXT_SETTING = 'domainpulse.user_id';

export class InvalidWorkspaceDatabaseContextError extends Error {
  readonly code = 'INVALID_WORKSPACE_DATABASE_CONTEXT';

  constructor() {
    super('Invalid workspace database context');
    this.name = 'InvalidWorkspaceDatabaseContextError';
  }
}

export class InvalidUserDatabaseContextError extends Error {
  readonly code = 'INVALID_USER_DATABASE_CONTEXT';

  constructor() {
    super('Invalid user database context');
    this.name = 'InvalidUserDatabaseContextError';
  }
}

async function setTransactionLocalUuid(
  transaction: DatabaseTransaction,
  setting: string,
  id: string,
): Promise<void> {
  await transaction.execute(sql`select set_config(${setting}, ${id}, true)`);
}

export async function setWorkspaceContext(
  transaction: DatabaseTransaction,
  workspaceId: string,
): Promise<void> {
  const parsedWorkspaceId = DatabaseContextIdSchema.safeParse(workspaceId);
  if (!parsedWorkspaceId.success) {
    throw new InvalidWorkspaceDatabaseContextError();
  }

  await setTransactionLocalUuid(
    transaction,
    WORKSPACE_CONTEXT_SETTING,
    parsedWorkspaceId.data,
  );
}

export async function setUserContext(
  transaction: DatabaseTransaction,
  userId: string,
): Promise<void> {
  const parsedUserId = DatabaseContextIdSchema.safeParse(userId);
  if (!parsedUserId.success) {
    throw new InvalidUserDatabaseContextError();
  }

  await setTransactionLocalUuid(
    transaction,
    USER_CONTEXT_SETTING,
    parsedUserId.data,
  );
}

export function withWorkspaceContext<T>(
  database: Database,
  workspaceId: string,
  operation: DatabaseTransactionOperation<T>,
): Promise<T> {
  const parsedWorkspaceId = DatabaseContextIdSchema.safeParse(workspaceId);
  if (!parsedWorkspaceId.success) {
    return Promise.reject(new InvalidWorkspaceDatabaseContextError());
  }

  return database.transaction(async (transaction) => {
    await setWorkspaceContext(transaction, parsedWorkspaceId.data);
    return operation(transaction);
  });
}

export function withUserContext<T>(
  database: Database,
  userId: string,
  operation: DatabaseTransactionOperation<T>,
): Promise<T> {
  const parsedUserId = DatabaseContextIdSchema.safeParse(userId);
  if (!parsedUserId.success) {
    return Promise.reject(new InvalidUserDatabaseContextError());
  }

  return database.transaction(async (transaction) => {
    await setUserContext(transaction, parsedUserId.data);
    return operation(transaction);
  });
}
