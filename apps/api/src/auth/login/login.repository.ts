import {
  passwordCredentials,
  sessions,
  users,
  type Database,
} from '@domainpulse/database';
import { eq } from 'drizzle-orm';

import { LoginPersistenceError } from './login.errors';
import type {
  LoginSession,
  LoginStore,
  PersistLoginSessionInput,
  StoredLoginCredential,
} from './login.types';

export interface LoginDatabaseHost {
  readonly database: Database;
}

export class PostgresLoginRepository implements LoginStore {
  constructor(private readonly host: LoginDatabaseHost) {}

  async findCredentialByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<StoredLoginCredential | undefined> {
    try {
      const rows = await this.host.database
        .select({
          createdAt: users.createdAt,
          displayName: users.displayName,
          email: users.email,
          id: users.id,
          normalizedEmail: users.normalizedEmail,
          passwordHash: passwordCredentials.passwordHash,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .innerJoin(
          passwordCredentials,
          eq(passwordCredentials.userId, users.id),
        )
        .where(eq(users.normalizedEmail, normalizedEmail))
        .limit(1);

      const row = rows[0];
      if (!row) {
        return undefined;
      }

      return {
        passwordHash: row.passwordHash,
        user: {
          createdAt: row.createdAt,
          displayName: row.displayName,
          email: row.email,
          id: row.id,
          normalizedEmail: row.normalizedEmail,
          updatedAt: row.updatedAt,
        },
      };
    } catch (error) {
      const causeMsg = (error as any)?.cause?.message || (error as any)?.cause || '';
      const msg = `${error instanceof Error ? error.message : String(error)} | CAUSE: ${causeMsg}`;
      console.error('findCredentialByNormalizedEmail DB ERROR:', error);
      throw new LoginPersistenceError(`Login DB query failed: ${msg}`);
    }
  }

  async createSession(
    input: PersistLoginSessionInput,
  ): Promise<LoginSession> {
    try {
      const rows = await this.host.database
        .insert(sessions)
        .values({
          expiresAt: input.expiresAt,
          refreshTokenHash: input.refreshTokenHash,
          userId: input.userId,
        })
        .returning({
          expiresAt: sessions.expiresAt,
          id: sessions.id,
        });

      const session = rows[0];
      if (!session) {
        throw new LoginPersistenceError();
      }

      return session;
    } catch (error) {
      if (error instanceof LoginPersistenceError) {
        throw error;
      }

      throw new LoginPersistenceError();
    }
  }
}
