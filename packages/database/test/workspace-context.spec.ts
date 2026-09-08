import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type {
  Database,
  DatabaseTransaction,
} from '../src/client/database-types';
import {
  InvalidUserDatabaseContextError,
  InvalidWorkspaceDatabaseContextError,
  withUserContext,
  withWorkspaceContext,
} from '../src/transactions/workspace-context';

describe('withWorkspaceContext', () => {
  it('rejects malformed workspace IDs before beginning a transaction', async () => {
    const transaction = vi.fn();
    const database = { transaction } as unknown as Database;

    await expect(
      withWorkspaceContext(database, 'not-a-uuid', () => Promise.resolve()),
    ).rejects.toBeInstanceOf(InvalidWorkspaceDatabaseContextError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed user IDs before beginning a transaction', async () => {
    const transaction = vi.fn();
    const database = { transaction } as unknown as Database;

    await expect(
      withUserContext(database, 'not-a-uuid', () => Promise.resolve()),
    ).rejects.toBeInstanceOf(InvalidUserDatabaseContextError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('sets context and runs work inside one transaction', async () => {
    const execute = vi.fn(() => Promise.resolve());
    const scopedTransaction = { execute } as unknown as DatabaseTransaction;
    const transaction = vi.fn(
      (operation: (transaction: DatabaseTransaction) => Promise<string>) =>
        operation(scopedTransaction),
    );
    const database = { transaction } as unknown as Database;
    const operation = vi.fn(() => Promise.resolve('completed'));

    await expect(
      withWorkspaceContext(database, randomUUID(), operation),
    ).resolves.toBe('completed');
    expect(transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith(scopedTransaction);
  });
});
