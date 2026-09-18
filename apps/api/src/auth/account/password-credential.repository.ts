import { passwordCredentials } from '@domainpulse/database';
import { eq } from 'drizzle-orm';

import { AccountPersistenceError, PasswordAlreadySetError } from './account.errors';
import type {
  PasswordCredentialDatabaseHost,
  PasswordCredentialStore,
} from './password-credential.types';

const PASSWORD_CREDENTIALS_PRIMARY_KEY_CONSTRAINT = 'password_credentials_pkey';
const POSTGRESQL_UNIQUE_VIOLATION = '23505';

function violatesPrimaryKey(error: unknown): boolean {
  const visited = new Set<object>();
  let currentError = error;

  while (typeof currentError === 'object' && currentError !== null) {
    if (visited.has(currentError)) {
      return false;
    }
    visited.add(currentError);

    const errorRecord = currentError as {
      cause?: unknown;
      code?: unknown;
      constraint?: unknown;
    };

    if (
      errorRecord.code === POSTGRESQL_UNIQUE_VIOLATION &&
      errorRecord.constraint === PASSWORD_CREDENTIALS_PRIMARY_KEY_CONSTRAINT
    ) {
      return true;
    }

    currentError = errorRecord.cause;
  }

  return false;
}

/** Reuses the SAME `password_credentials` table password registration writes to -- Add Password is not a second credential store. */
export class PostgresPasswordCredentialRepository
implements PasswordCredentialStore {
  constructor(private readonly host: PasswordCredentialDatabaseHost) {}

  async exists(userId: string): Promise<boolean> {
    try {
      const [row] = await this.host.database
        .select({ userId: passwordCredentials.userId })
        .from(passwordCredentials)
        .where(eq(passwordCredentials.userId, userId))
        .limit(1);

      return Boolean(row);
    } catch {
      throw new AccountPersistenceError();
    }
  }

  async create(userId: string, passwordHash: string): Promise<void> {
    try {
      await this.host.database.insert(passwordCredentials).values({
        passwordHash,
        userId,
      });
    } catch (error) {
      if (violatesPrimaryKey(error)) {
        // Raced with another concurrent Add Password call for the same
        // user -- the table's primary key is the true authority.
        throw new PasswordAlreadySetError();
      }

      throw new AccountPersistenceError();
    }
  }
}
