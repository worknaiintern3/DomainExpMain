import { randomUUID } from 'node:crypto';

import {
  RegistrationEmailConflictError,
  RegistrationPersistenceError,
} from './registration.errors';
import type {
  PersistRegistrationInput,
  RegisteredUser,
  RegistrationStore,
} from './registration.types';
import type { DatabaseService } from '../../database/database.service';

const PERSONAL_WORKSPACE_NAME = 'Personal Workspace';

function createPersonalWorkspaceSlug(workspaceId: string): string {
  return `personal-${workspaceId.replaceAll('-', '')}`;
}

export class MongoRegistrationRepository implements RegistrationStore {
  constructor(private readonly database: DatabaseService) {}

  async createRegistration(
    input: PersistRegistrationInput,
  ): Promise<RegisteredUser> {
    const userId = randomUUID();
    const personalWorkspaceId = randomUUID();
    const now = new Date();

    const collections = this.database.collections;
    if (!collections) {
      throw new RegistrationPersistenceError('MongoDB collections not initialized');
    }

    try {
      // Check existing email first for fast failure
      const existing = await collections.users.findOne({
        normalizedEmail: input.normalizedEmail,
      });
      if (existing) {
        throw new RegistrationEmailConflictError();
      }

      const registeredUser: RegisteredUser = {
        createdAt: now,
        displayName: input.displayName ?? null,
        email: input.email,
        id: userId,
        normalizedEmail: input.normalizedEmail,
        updatedAt: now,
      };

      await collections.workspaces.insertOne({
        id: personalWorkspaceId,
        name: PERSONAL_WORKSPACE_NAME,
        slug: createPersonalWorkspaceSlug(personalWorkspaceId),
        createdAt: now,
        updatedAt: now,
      } as any);

      await collections.users.insertOne({
        ...registeredUser,
        personalWorkspaceId,
        platformRole: 'USER',
      } as any);

      await collections.passwordCredentials.insertOne({
        id: randomUUID(),
        passwordHash: input.passwordHash,
        userId,
        createdAt: now,
        updatedAt: now,
      } as any);

      await collections.workspaceMembers.insertOne({
        id: randomUUID(),
        role: 'owner',
        userId,
        workspaceId: personalWorkspaceId,
        createdAt: now,
        updatedAt: now,
      } as any);

      return registeredUser;
    } catch (error: any) {
      if (error instanceof RegistrationEmailConflictError) {
        throw error;
      }
      if (error?.code === 11000) {
        throw new RegistrationEmailConflictError();
      }
      if (error instanceof RegistrationPersistenceError) {
        throw error;
      }
      throw new RegistrationPersistenceError(
        `Registration DB query failed: ${error?.message || String(error)}`,
      );
    }
  }
}
