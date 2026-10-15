import { randomUUID } from 'node:crypto';

import { LoginPersistenceError } from './login.errors';
import type {
  LoginSession,
  LoginStore,
  PersistLoginSessionInput,
  StoredLoginCredential,
} from './login.types';
import type { DatabaseService } from '../../database/database.service';

export class MongoLoginRepository implements LoginStore {
  constructor(private readonly database: DatabaseService) {}

  async findCredentialByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<StoredLoginCredential | undefined> {
    const collections = this.database.collections;
    if (!collections) {
      throw new LoginPersistenceError('MongoDB collections not initialized');
    }

    try {
      const user = await collections.users.findOne({
        normalizedEmail,
      });

      if (!user) {
        return undefined;
      }

      const credential = await collections.passwordCredentials.findOne({
        userId: user.id,
      });

      if (!credential) {
        return undefined;
      }

      return {
        passwordHash: credential.passwordHash,
        user: {
          createdAt: user.createdAt,
          displayName: user.displayName ?? null,
          email: user.email,
          id: user.id,
          normalizedEmail: user.normalizedEmail,
          updatedAt: user.updatedAt,
        },
      };
    } catch (error: any) {
      throw new LoginPersistenceError(
        `Login DB query failed: ${error?.message || String(error)}`,
      );
    }
  }

  async createSession(
    input: PersistLoginSessionInput,
  ): Promise<LoginSession> {
    const collections = this.database.collections;
    if (!collections) {
      throw new LoginPersistenceError('MongoDB collections not initialized');
    }

    const sessionId = randomUUID();
    const now = new Date();

    try {
      const sessionDoc = {
        id: sessionId,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await collections.sessions.insertOne(sessionDoc as any);

      return {
        id: sessionId,
        expiresAt: input.expiresAt,
      };
    } catch (error: any) {
      throw new LoginPersistenceError(
        `Create session DB query failed: ${error?.message || String(error)}`,
      );
    }
  }
}
