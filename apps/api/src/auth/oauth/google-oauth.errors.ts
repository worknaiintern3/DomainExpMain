export class GoogleOAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleOAuthConfigurationError';
  }
}

/**
 * The single external-facing OAuth failure. Deliberately generic: unknown
 * state, expired state, replayed state, a failed Google token exchange, and
 * every ID-token claim rejection (bad signature, wrong issuer/audience,
 * expired, nonce mismatch, missing subject) all collapse to this one error
 * at the HTTP boundary, so the client can never distinguish *why* a Google
 * sign-in failed. Mirrors `InvalidRefreshTokenError`/`InvalidCredentialsError`'s
 * existing "authentication failed" posture exactly.
 */
export class GoogleAuthenticationFailedError extends Error {
  readonly code = 'GOOGLE_AUTHENTICATION_FAILED';

  constructor() {
    super('Google authentication failed');
    this.name = 'GoogleAuthenticationFailedError';
  }
}

/**
 * The one deliberately distinguishable outcome (locked decision 4): a
 * verified Google identity's email already belongs to an existing
 * DomainPulse account with no linked Google identity. Not a security leak --
 * `RegistrationEmailConflictError` already tells an unauthenticated caller
 * "this email is taken" for the exact same reason, so this reveals nothing
 * `/auth/register` doesn't already reveal.
 */
export class GoogleAccountEmailConflictError extends Error {
  readonly code = 'GOOGLE_ACCOUNT_EMAIL_CONFLICT';

  constructor() {
    super('An account with this email already exists');
    this.name = 'GoogleAccountEmailConflictError';
  }
}

export class GoogleOAuthPersistenceError extends Error {
  readonly code = 'GOOGLE_OAUTH_PERSISTENCE_ERROR';

  constructor() {
    super('Google sign-in could not be completed');
    this.name = 'GoogleOAuthPersistenceError';
  }
}

/**
 * Link-only: the `(google, sub)` resolved by a `link` transaction's ID token
 * already belongs to a DIFFERENT DomainPulse user than the authenticated
 * caller. DB-enforced via `oauth_identities_provider_subject_unique` --
 * caught here rather than silently re-pointing the identity.
 */
export class GoogleIdentityAlreadyLinkedError extends Error {
  readonly code = 'GOOGLE_IDENTITY_ALREADY_LINKED';

  constructor() {
    super('This Google account is already connected to a different account');
    this.name = 'GoogleIdentityAlreadyLinkedError';
  }
}

/**
 * Link-only: the authenticated caller already has a Google identity linked
 * (a different `sub`) -- DB-enforced via `oauth_identities_user_provider_unique`.
 * Phase 10K supports at most one Google identity per user; the caller must
 * unlink the existing one first.
 */
export class GoogleAccountAlreadyConnectedError extends Error {
  readonly code = 'GOOGLE_ACCOUNT_ALREADY_CONNECTED';

  constructor() {
    super('A different Google account is already connected. Disconnect it before connecting a new one.');
    this.name = 'GoogleAccountAlreadyConnectedError';
  }
}
