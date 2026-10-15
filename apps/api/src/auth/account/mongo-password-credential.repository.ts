import { randomUUID } from 'node:crypto';

import { AccountPersistenceError, PasswordAlreadySetError } from './account.errors';
import type { PasswordCredentialStore } from './password-credential.types';
import type { DatabaseService } from '../../database/database.service';

export class MongoPasswordCredentialRepository implements PasswordCredentialStore {
  constructor(private readonly database: DatabaseService) {}

  async exists(userId: string): Promise<boolean> {
    const collections = this.database.collections;
    if (!collections) {
      throw new AccountPersistenceError();
    }

    try {
      const doc = await collections.passwordCredentials.findOne({ userId });
      return Boolean(doc);
    } catch {
      throw new AccountPersistenceError();
    }
  }

  async create(userId: string, passwordHash: string): Promise<void> {
    const collections = this.database.collections;
    if (!collections) {
      throw new AccountPersistenceError();
    }

    const now = new Date();
    try {
      await collections.passwordCredentials.insertOne({
        id: randomUUID(),
        userId,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      } as any);
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new PasswordAlreadySetError();
      }
      throw new AccountPersistenceError();
    }
  }
}
