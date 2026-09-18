import type { Database, WorkspaceTransactionHost } from '@domainpulse/database';

export interface OAuthUser {
  readonly createdAt: Date;
  readonly displayName: string | null;
  readonly email: string;
  readonly id: string;
  readonly normalizedEmail: string;
  readonly updatedAt: Date;
}

export interface ResolvedOAuthIdentity {
  readonly user: OAuthUser;
}

export interface CreateOAuthIdentityWithNewUserInput {
  readonly displayName?: string;
  readonly email: string;
  readonly normalizedEmail: string;
  readonly provider: string;
  readonly providerEmail: string;
  readonly providerEmailVerified: boolean;
  readonly providerSubject: string;
}

export interface TouchOAuthIdentityInput {
  readonly provider: string;
  readonly providerEmail: string;
  readonly providerEmailVerified: boolean;
  readonly providerSubject: string;
}

export interface AttachOAuthIdentityToExistingUserInput {
  readonly provider: string;
  readonly providerEmail: string;
  readonly providerEmailVerified: boolean;
  readonly providerSubject: string;
  readonly userId: string;
}

export interface OAuthIdentityForUser {
  readonly providerEmail: string | null;
}

export interface OAuthIdentityStore {
  /** Case B: a plain existence check against `users.normalizedEmail`, no join, no credential exposure -- the same shape `RegistrationEmailConflictError` detection already relies on. */
  findUserByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<{ readonly id: string } | undefined>;
  /** Case A. */
  findByProviderSubject(
    provider: string,
    providerSubject: string,
  ): Promise<ResolvedOAuthIdentity | undefined>;
  /** Case C: one transaction, mirroring `PostgresRegistrationRepository.createRegistration` exactly, with `oauth_identities` in place of `password_credentials`. */
  createIdentityWithNewUser(
    input: CreateOAuthIdentityWithNewUserInput,
  ): Promise<ResolvedOAuthIdentity>;
  /** Case A's last-observed-metadata refresh; never remaps `userId`. */
  touchProviderEmail(input: TouchOAuthIdentityInput): Promise<void>;
  /**
   * Connect-Google (authenticated linking): attaches a Google identity to an
   * ALREADY-EXISTING `userId` -- no user, workspace, or membership is ever
   * created here. Relies on the same two unique constraints as Case C/D, but
   * maps each violation to its own distinguishable outcome (see
   * `GoogleIdentityAlreadyLinkedError`/`GoogleAccountAlreadyConnectedError`)
   * since this is an authenticated action, not anonymous sign-in.
   */
  attachIdentityToExistingUser(
    input: AttachOAuthIdentityToExistingUserInput,
  ): Promise<void>;
  /** Login-methods status and unlink-eligibility: does this user have a `provider` identity, and what email is on file for it. */
  findIdentityForUser(
    userId: string,
    provider: string,
  ): Promise<OAuthIdentityForUser | undefined>;
  /** Unlink: removes only the identity row -- never the user, workspace, memberships, sessions, or password credential. Returns whether a row was actually removed. */
  deleteIdentityForUser(userId: string, provider: string): Promise<boolean>;
}

export interface OAuthIdentityDatabaseHost {
  readonly database: Database;
}

export type OAuthIdentityTransactionHost = WorkspaceTransactionHost;
