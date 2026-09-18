import { randomUUID } from 'node:crypto';

import {
  oauthIdentities,
  users,
  workspaceMembers,
  workspaces,
} from '@domainpulse/database';
import { and, eq } from 'drizzle-orm';

import {
  GoogleAccountAlreadyConnectedError,
  GoogleAccountEmailConflictError,
  GoogleAuthenticationFailedError,
  GoogleIdentityAlreadyLinkedError,
  GoogleOAuthPersistenceError,
} from './google-oauth.errors';
import type {
  AttachOAuthIdentityToExistingUserInput,
  CreateOAuthIdentityWithNewUserInput,
  OAuthIdentityDatabaseHost,
  OAuthIdentityForUser,
  OAuthIdentityStore,
  OAuthIdentityTransactionHost,
  ResolvedOAuthIdentity,
  TouchOAuthIdentityInput,
} from './oauth-identity.types';

const USERS_NORMALIZED_EMAIL_UNIQUE_CONSTRAINT = 'users_normalized_email_unique';
const OAUTH_PROVIDER_SUBJECT_UNIQUE_CONSTRAINT =
  'oauth_identities_provider_subject_unique';
const OAUTH_USER_PROVIDER_UNIQUE_CONSTRAINT =
  'oauth_identities_user_provider_unique';
const POSTGRESQL_UNIQUE_VIOLATION = '23505';
const PERSONAL_WORKSPACE_NAME = 'Personal Workspace';

function createPersonalWorkspaceSlug(workspaceId: string): string {
  return `personal-${workspaceId.replaceAll('-', '')}`;
}

/**
 * Mirrors `registration.repository.ts`'s `isNormalizedEmailConflict` cause-
 * chain walk, generalized to any single constraint name -- this repository
 * must distinguish three distinct unique constraints (Case B's email
 * conflict vs. Case D's two possible provider-subject races) without ever
 * conflating them in the response.
 */
function violatesConstraint(error: unknown, constraintName: string): boolean {
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
      errorRecord.constraint === constraintName
    ) {
      return true;
    }

    currentError = errorRecord.cause;
  }

  return false;
}

export class PostgresOAuthIdentityRepository implements OAuthIdentityStore {
  constructor(
    private readonly host: OAuthIdentityDatabaseHost & OAuthIdentityTransactionHost,
  ) {}

  async findUserByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<{ readonly id: string } | undefined> {
    try {
      const [row] = await this.host.database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.normalizedEmail, normalizedEmail))
        .limit(1);

      return row;
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async findByProviderSubject(
    provider: string,
    providerSubject: string,
  ): Promise<ResolvedOAuthIdentity | undefined> {
    try {
      const [row] = await this.host.database
        .select({
          createdAt: users.createdAt,
          displayName: users.displayName,
          email: users.email,
          id: users.id,
          normalizedEmail: users.normalizedEmail,
          updatedAt: users.updatedAt,
        })
        .from(oauthIdentities)
        .innerJoin(users, eq(users.id, oauthIdentities.userId))
        .where(
          and(
            eq(oauthIdentities.provider, provider),
            eq(oauthIdentities.providerSubject, providerSubject),
          ),
        )
        .limit(1);

      return row ? { user: row } : undefined;
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async createIdentityWithNewUser(
    input: CreateOAuthIdentityWithNewUserInput,
  ): Promise<ResolvedOAuthIdentity> {
    const userId = randomUUID();
    const personalWorkspaceId = randomUUID();

    try {
      return await this.host.withWorkspaceContext(
        personalWorkspaceId,
        async (transaction) => {
          await transaction.insert(workspaces).values({
            id: personalWorkspaceId,
            name: PERSONAL_WORKSPACE_NAME,
            slug: createPersonalWorkspaceSlug(personalWorkspaceId),
          });

          const [createdUser] = await transaction
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

          if (!createdUser) {
            throw new GoogleOAuthPersistenceError();
          }

          await transaction.insert(oauthIdentities).values({
            provider: input.provider,
            providerEmail: input.providerEmail,
            providerEmailVerified: input.providerEmailVerified,
            providerSubject: input.providerSubject,
            userId: createdUser.id,
          });

          await transaction.insert(workspaceMembers).values({
            role: 'owner',
            userId: createdUser.id,
            workspaceId: personalWorkspaceId,
          });

          return { user: createdUser };
        },
      );
    } catch (error) {
      if (violatesConstraint(error, USERS_NORMALIZED_EMAIL_UNIQUE_CONSTRAINT)) {
        // Raced with either a password registration or a concurrent Google
        // sign-in for the same email between the service's Case-B check and
        // this insert -- the same safe, non-linking outcome as Case B.
        throw new GoogleAccountEmailConflictError();
      }
      if (
        violatesConstraint(error, OAUTH_PROVIDER_SUBJECT_UNIQUE_CONSTRAINT) ||
        violatesConstraint(error, OAUTH_USER_PROVIDER_UNIQUE_CONSTRAINT)
      ) {
        // Case D: never distinguishable from any other generic failure.
        throw new GoogleAuthenticationFailedError();
      }
      if (
        error instanceof GoogleOAuthPersistenceError ||
        error instanceof GoogleAccountEmailConflictError ||
        error instanceof GoogleAuthenticationFailedError
      ) {
        throw error;
      }

      throw new GoogleOAuthPersistenceError();
    }
  }

  async touchProviderEmail(input: TouchOAuthIdentityInput): Promise<void> {
    try {
      await this.host.database
        .update(oauthIdentities)
        .set({
          providerEmail: input.providerEmail,
          providerEmailVerified: input.providerEmailVerified,
        })
        .where(
          and(
            eq(oauthIdentities.provider, input.provider),
            eq(oauthIdentities.providerSubject, input.providerSubject),
          ),
        );
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async attachIdentityToExistingUser(
    input: AttachOAuthIdentityToExistingUserInput,
  ): Promise<void> {
    try {
      await this.host.database.insert(oauthIdentities).values({
        provider: input.provider,
        providerEmail: input.providerEmail,
        providerEmailVerified: input.providerEmailVerified,
        providerSubject: input.providerSubject,
        userId: input.userId,
      });
    } catch (error) {
      if (violatesConstraint(error, OAUTH_PROVIDER_SUBJECT_UNIQUE_CONSTRAINT)) {
        // Raced with someone else claiming this exact (provider, subject)
        // between the service's own findByProviderSubject check and this
        // insert -- the DB constraint is the true authority (locked rule).
        throw new GoogleIdentityAlreadyLinkedError();
      }
      if (violatesConstraint(error, OAUTH_USER_PROVIDER_UNIQUE_CONSTRAINT)) {
        // This user already has a (possibly different-subject) Google
        // identity -- Phase 10K allows at most one per user; unlink first.
        throw new GoogleAccountAlreadyConnectedError();
      }

      throw new GoogleOAuthPersistenceError();
    }
  }

  async findIdentityForUser(
    userId: string,
    provider: string,
  ): Promise<OAuthIdentityForUser | undefined> {
    try {
      const [row] = await this.host.database
        .select({ providerEmail: oauthIdentities.providerEmail })
        .from(oauthIdentities)
        .where(
          and(
            eq(oauthIdentities.userId, userId),
            eq(oauthIdentities.provider, provider),
          ),
        )
        .limit(1);

      return row;
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }

  async deleteIdentityForUser(
    userId: string,
    provider: string,
  ): Promise<boolean> {
    try {
      const deleted = await this.host.database
        .delete(oauthIdentities)
        .where(
          and(
            eq(oauthIdentities.userId, userId),
            eq(oauthIdentities.provider, provider),
          ),
        )
        .returning({ id: oauthIdentities.id });

      return deleted.length > 0;
    } catch {
      throw new GoogleOAuthPersistenceError();
    }
  }
}
