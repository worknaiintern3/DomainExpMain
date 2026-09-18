export interface GoogleOAuthConfiguration {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly transactionTtlSeconds: number;
}

export interface GoogleAuthorizationRequest {
  readonly authorizationUrl: string;
}

export interface VerifiedGoogleIdTokenClaims {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string | null;
  readonly subject: string;
}

export interface GoogleOAuthUser {
  readonly createdAt: Date;
  readonly displayName: string | null;
  readonly email: string;
  readonly id: string;
  readonly updatedAt: Date;
}

export interface GoogleOAuthSession {
  readonly expiresAt: Date;
  readonly id: string;
}

export interface GoogleCallbackResult {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly session: GoogleOAuthSession;
  readonly user: GoogleOAuthUser;
}

/**
 * Connect-Google (authenticated linking) result -- deliberately minimal: no
 * DomainPulse tokens (linking never issues a new session, see locked rule
 * 11), no `sub`, no Google tokens. `providerEmail` is safe display metadata
 * only, the same field already shown by the login-methods status.
 */
export interface GoogleLinkResult {
  readonly alreadyLinked: boolean;
  readonly providerEmail: string;
}

/**
 * The exact shape `PostgresLoginRepository.createSession` already has --
 * declared here as its own narrow interface (rather than importing
 * `LoginStore`, which also carries password-lookup responsibility this
 * module has no business depending on) so `GoogleOAuthService` can reuse
 * the *same* session-row-creation primitive password login uses, via
 * ordinary structural typing, with zero changes to the login module.
 */
export interface OAuthSessionIssuer {
  createSession(input: {
    readonly expiresAt: Date;
    readonly refreshTokenHash: string;
    readonly userId: string;
  }): Promise<GoogleOAuthSession>;
}

export interface AccessTokenIssuer {
  issue(subject: { readonly sessionId: string; readonly userId: string }): {
    readonly expiresAt: Date;
    readonly token: string;
  };
}
