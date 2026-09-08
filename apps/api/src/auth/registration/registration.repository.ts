import { randomUUID } from 'node:crypto';

import {
  passwordCredentials,
  users,
  workspaceMembers,
  workspaces,
} from '@domainpulse/database';

import {
  RegistrationEmailConflictError,
  RegistrationPersistenceError,
} from './registration.errors';
import type {
  PersistRegistrationInput,
  RegisteredUser,
  RegistrationStore,
  RegistrationTransactionHost,
} from './registration.types';

const NORMALIZED_EMAIL_UNIQUE_CONSTRAINT = 'users_normalized_email_unique';
const POSTGRESQL_UNIQUE_VIOLATION = '23505';
const PERSONAL_WORKSPACE_NAME = 'Personal Workspace';

function createPersonalWorkspaceSlug(workspaceId: string): string {
  return `personal-${workspaceId.replaceAll('-', '')}`;
}

function isNormalizedEmailConflict(error: unknown): boolean {
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
      errorRecord.constraint === NORMALIZED_EMAIL_UNIQUE_CONSTRAINT
    ) {
      return true;
    }

    currentError = errorRecord.cause;
  }

  return false;
}

export class PostgresRegistrationRepository implements RegistrationStore {
  constructor(private readonly database: RegistrationTransactionHost) {}

  async createRegistration(
    input: PersistRegistrationInput,
  ): Promise<RegisteredUser> {
    const userId = randomUUID();
    const personalWorkspaceId = randomUUID();

    try {
      return await this.database.withWorkspaceContext(
        personalWorkspaceId,
        async (transaction) => {
          await transaction.insert(workspaces).values({
            id: personalWorkspaceId,
            name: PERSONAL_WORKSPACE_NAME,
            slug: createPersonalWorkspaceSlug(personalWorkspaceId),
          });

          const [registeredUser] = await transaction
            .insert(users)
            .values({
              ...(input.displayName === undefined
                ? {}
                : { displayName: input.displayName }),
              email: input.email,
              id: userId,
              normalizedEmail: input.normalizedEmail,
              personalWorkspaceId,
            })
            .returning({
              createdAt: users.createdAt,
              displayName: users.displayName,
              email: users.email,
              id: users.id,
              normalizedEmail: users.normalizedEmail,
              updatedAt: users.updatedAt,
            });

          if (!registeredUser) {
            throw new RegistrationPersistenceError();
          }

          await transaction.insert(passwordCredentials).values({
            passwordHash: input.passwordHash,
            userId: registeredUser.id,
          });

          await transaction.insert(workspaceMembers).values({
            role: 'owner',
            userId: registeredUser.id,
            workspaceId: personalWorkspaceId,
          });

          return registeredUser;
        },
      );
    } catch (error) {
      if (isNormalizedEmailConflict(error)) {
        throw new RegistrationEmailConflictError();
      }

      if (error instanceof RegistrationPersistenceError) {
        throw error;
      }

      throw new RegistrationPersistenceError();
    }
  }
}
