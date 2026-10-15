import { randomUUID } from 'node:crypto';

import {
  GoogleAccountAlreadyConnectedError,
  GoogleIdentityAlreadyLinkedError,
  GoogleOAuthPersistenceError,
} from './google-oauth.errors';
import type {
  AttachOAuthIdentityToExistingUserInput,
  CreateOAuthIdentityWithNewUserInput,
  OAuthIdentityForUser,
  OAuthIdentityStore,
  ResolvedOAuthIdentity,
  TouchOAuthIdentityInput,
} from './oauth-identity.types';
import type { DatabaseService } from '../../database/database.service';

const PERSONAL_WORKSPACE_NAME = 'Personal Workspace';

function createPersonalWorkspaceSlug(workspaceId: string): string {
  return `personal-${workspaceId.replaceAll('-', '')}`;
}

export class MongoOAuthIdentityRepository implements OAuthIdentityStore {
  constructor(private readonly database: DatabaseService) {}

  async findUserByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<{ readonly id: string } | undefined> {
    const collections = this.database.collections;
    if (!collections) {
      throw new GoogleOAuthPersistenceError();
    }

    try {
      const user = await collections.users.findOne({ normalizedEmail });
      return user ? { id: user.id } : undefined;
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async findByProviderSubject(
    provider: string,
    providerSubject: string,
  ): Promise<ResolvedOAuthIdentity | undefined> {
    const collections = this.database.collections;
    if (!collections) {
      throw new GoogleOAuthPersistenceError();
    }

    try {
      const identity = await collections.oauthIdentities.findOne({
        provider,
        providerSubject,
      });

      if (!identity) {
        return undefined;
      }

      const user = await collections.users.findOne({ id: identity.userId });
      if (!user) {
        return undefined;
      }

      return {
        user: {
          createdAt: user.createdAt,
          displayName: user.displayName ?? null,
          email: user.email,
          id: user.id,
          normalizedEmail: user.normalizedEmail,
          updatedAt: user.updatedAt,
        },
      };
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async createIdentityWithNewUser(
    input: CreateOAuthIdentityWithNewUserInput,
  ): Promise<ResolvedOAuthIdentity> {
    const collections = this.database.collections;
    if (!collections) {
      throw new GoogleOAuthPersistenceError();
    }

    const userId = randomUUID();
    const personalWorkspaceId = randomUUID();
    const identityId = randomUUID();
    const now = new Date();

    try {
      await collections.workspaces.insertOne({
        id: personalWorkspaceId,
        name: PERSONAL_WORKSPACE_NAME,
        slug: createPersonalWorkspaceSlug(personalWorkspaceId),
        createdAt: now,
        updatedAt: now,
      } as any);

      const userDoc = {
        id: userId,
        email: input.email,
        normalizedEmail: input.normalizedEmail,
        displayName: input.displayName ?? null,
        personalWorkspaceId,
        platformRole: 'USER' as const,
        createdAt: now,
        updatedAt: now,
      };
      await collections.users.insertOne(userDoc as any);

      await collections.workspaceMembers.insertOne({
        id: randomUUID(),
        workspaceId: personalWorkspaceId,
        userId,
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      } as any);

      await collections.oauthIdentities.insertOne({
        id: identityId,
        userId,
        provider: input.provider,
        providerSubject: input.providerSubject,
        providerEmail: input.providerEmail,
        providerEmailVerified: input.providerEmailVerified,
        profileData: null,
        createdAt: now,
        updatedAt: now,
      } as any);

      return {
        user: {
          createdAt: now,
          displayName: input.displayName ?? null,
          email: input.email,
          id: userId,
          normalizedEmail: input.normalizedEmail,
          updatedAt: now,
        },
      };
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async touchProviderEmail(input: TouchOAuthIdentityInput): Promise<void> {
    const collections = this.database.collections;
    if (!collections) {
      throw new GoogleOAuthPersistenceError();
    }

    try {
      await collections.oauthIdentities.updateOne(
        {
          provider: input.provider,
          providerSubject: input.providerSubject,
        },
        {
          $set: {
            providerEmail: input.providerEmail,
            providerEmailVerified: input.providerEmailVerified,
            updatedAt: new Date(),
          } as any,
        },
      );
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async attachIdentityToExistingUser(
    input: AttachOAuthIdentityToExistingUserInput,
  ): Promise<void> {
    const collections = this.database.collections;
    if (!collections) {
      throw new GoogleOAuthPersistenceError();
    }

    const now = new Date();
    try {
      const existingUserProvider = await collections.oauthIdentities.findOne({
        userId: input.userId,
        provider: input.provider,
      });
      if (existingUserProvider) {
        throw new GoogleAccountAlreadyConnectedError();
      }

      const existingSubject = await collections.oauthIdentities.findOne({
        provider: input.provider,
        providerSubject: input.providerSubject,
      });
      if (existingSubject) {
        throw new GoogleIdentityAlreadyLinkedError();
      }

      await collections.oauthIdentities.insertOne({
        id: randomUUID(),
        userId: input.userId,
        provider: input.provider,
        providerSubject: input.providerSubject,
        providerEmail: input.providerEmail,
        providerEmailVerified: input.providerEmailVerified,
        profileData: null,
        createdAt: now,
        updatedAt: now,
      } as any);
    } catch (error: any) {
      if (
        error instanceof GoogleAccountAlreadyConnectedError ||
        error instanceof GoogleIdentityAlreadyLinkedError
      ) {
        throw error;
      }
      if (error?.code === 11000) {
        throw new GoogleIdentityAlreadyLinkedError();
      }
      throw new GoogleOAuthPersistenceError();
    }
  }

  async findIdentityForUser(
    userId: string,
    provider: string,
  ): Promise<OAuthIdentityForUser | undefined> {
    const collections = this.database.collections;
    if (!collections) {
      throw new GoogleOAuthPersistenceError();
    }

    try {
      const doc = await collections.oauthIdentities.findOne({
        userId,
        provider,
      });
      if (!doc) {
        return undefined;
      }
      return { providerEmail: (doc as any).providerEmail ?? null };
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async deleteIdentityForUser(
    userId: string,
    provider: string,
  ): Promise<boolean> {
    const collections = this.database.collections;
    if (!collections) {
      throw new GoogleOAuthPersistenceError();
    }

    try {
      const res = await collections.oauthIdentities.deleteOne({
        userId,
        provider,
      });
      return res.deletedCount > 0;
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }
}
