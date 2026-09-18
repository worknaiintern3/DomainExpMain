import { createHash, randomBytes } from 'node:crypto';

import { generateRefreshToken, hashRefreshToken } from '../crypto';
import { normalizeRegistrationEmail } from '../registration/email-normalization';
import { LOGIN_SESSION_TTL_MS } from '../login';
import {
  GoogleAccountEmailConflictError,
  GoogleAuthenticationFailedError,
  GoogleIdentityAlreadyLinkedError,
} from './google-oauth.errors';
import { GoogleIdTokenVerifier } from './google-id-token-verifier';
import type {
  AccessTokenIssuer,
  GoogleAuthorizationRequest,
  GoogleCallbackResult,
  GoogleLinkResult,
  GoogleOAuthConfiguration,
  OAuthSessionIssuer,
} from './google-oauth.types';
import { GoogleTokenExchangeClient } from './google-token-exchange';
import type { OAuthIdentityStore, OAuthUser } from './oauth-identity.types';
import type { OAuthTransactionStore } from './oauth-transaction.types';

export const GOOGLE_PROVIDER = 'google';
const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OIDC_SCOPE = 'openid email profile';
/** 256 bits of randomness, matching REFRESH_TOKEN_BYTES -- more than the RFC 7636 PKCE minimum (43 base64url characters after encoding). */
const RANDOM_VALUE_BYTES = 32;

function randomUrlSafeValue(): string {
  return randomBytes(RANDOM_VALUE_BYTES).toString('base64url');
}

function codeChallengeFor(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export class GoogleOAuthService {
  constructor(
    private readonly config: GoogleOAuthConfiguration,
    private readonly transactionStore: OAuthTransactionStore,
    private readonly identityStore: OAuthIdentityStore,
    private readonly tokenExchangeClient: GoogleTokenExchangeClient,
    private readonly idTokenVerifier: GoogleIdTokenVerifier,
    private readonly sessionIssuer: OAuthSessionIssuer,
    private readonly accessTokenIssuer: AccessTokenIssuer,
    private readonly refreshTokenGenerator: () => string = generateRefreshToken,
    private readonly refreshTokenHasher: (token: string) => string = hashRefreshToken,
    private readonly now: () => number = Date.now,
  ) {}

  async startLogin(): Promise<GoogleAuthorizationRequest> {
    return this.startAuthorization({ flow: 'login' });
  }

  /**
   * Connect-Google: the authenticated caller's `userId` is baked into the
   * transaction as `linkingUserId` at creation time (locked -- `state`
   * possession alone is never sufficient proof, see the link callback's
   * `linkingUserId === userId` re-check).
   */
  async startLink(userId: string): Promise<GoogleAuthorizationRequest> {
    return this.startAuthorization({ flow: 'link', linkingUserId: userId });
  }

  private async startAuthorization(
    flowInput: { flow: 'link'; linkingUserId: string } | { flow: 'login' },
  ): Promise<GoogleAuthorizationRequest> {
    const state = randomUrlSafeValue();
    const nonce = randomUrlSafeValue();
    const codeVerifier = randomUrlSafeValue();
    const codeChallenge = codeChallengeFor(codeVerifier);
    const expiresAt = new Date(
      this.now() + this.config.transactionTtlSeconds * 1_000,
    );

    await this.transactionStore.createTransaction({
      codeVerifier,
      expiresAt,
      ...(flowInput.flow === 'link'
        ? { flow: 'link', linkingUserId: flowInput.linkingUserId }
        : { flow: 'login' }),
      nonce,
      provider: GOOGLE_PROVIDER,
      state,
    });

    const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', GOOGLE_OIDC_SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return { authorizationUrl: url.toString() };
  }

  async completeCallback(
    code: string,
    state: string,
  ): Promise<GoogleCallbackResult> {
    const consumedAt = new Date(this.now());
    const transaction = await this.transactionStore.consumeTransaction(
      GOOGLE_PROVIDER,
      state,
      consumedAt,
    );
    if (!transaction) {
      // Unknown, expired, and already-consumed (replayed) all collapse to
      // this one outcome -- see oauth-transaction.types.ts.
      throw new GoogleAuthenticationFailedError();
    }
    if (transaction.flow !== 'login') {
      // A `link` transaction's state must never be redeemable through the
      // public, unauthenticated login callback -- that would let a copied
      // Google authorization URL attach an identity without ever proving
      // who the caller is. The DB's flow/linkingUserId invariant means this
      // can only be a link transaction here, but the check stays explicit.
      throw new GoogleAuthenticationFailedError();
    }

    const idToken = await this.tokenExchangeClient.exchangeAuthorizationCode(
      this.config,
      code,
      transaction.codeVerifier,
    );
    // `idToken` is a raw, unverified JWT string until the next line; it is
    // never logged, stored, or returned past this function's scope.
    const claims = await this.idTokenVerifier.verify(
      idToken,
      this.config.clientId,
      transaction.nonce,
    );

    const normalizedEmail = normalizeRegistrationEmail(claims.email);

    // Case A: an identity already linked to this exact (provider, subject).
    const existingIdentity = await this.identityStore.findByProviderSubject(
      GOOGLE_PROVIDER,
      claims.subject,
    );
    let user: OAuthUser;
    if (existingIdentity) {
      // Refresh last-observed metadata only -- `sub` already resolved the
      // account; an email change at Google never remaps or detaches it.
      await this.identityStore.touchProviderEmail({
        provider: GOOGLE_PROVIDER,
        providerEmail: claims.email,
        providerEmailVerified: claims.emailVerified,
        providerSubject: claims.subject,
      });
      user = existingIdentity.user;
    } else {
      // Case B: no identity yet, but this email already belongs to an
      // existing DomainPulse account -- never auto-link, never auto-merge,
      // never create a second user.
      const emailOwner =
        await this.identityStore.findUserByNormalizedEmail(normalizedEmail);
      if (emailOwner) {
        throw new GoogleAccountEmailConflictError();
      }

      // Case C: a genuinely new Google user. Locked decision 6: a brand-new
      // identity requires a verified email -- fail closed, generically,
      // rather than creating an account from an unverified claim.
      if (!claims.emailVerified) {
        throw new GoogleAuthenticationFailedError();
      }

      const created = await this.identityStore.createIdentityWithNewUser({
        ...(claims.name ? { displayName: claims.name } : {}),
        email: claims.email,
        normalizedEmail,
        provider: GOOGLE_PROVIDER,
        providerEmail: claims.email,
        providerEmailVerified: claims.emailVerified,
        providerSubject: claims.subject,
      });
      user = created.user;
    }

    // From here on, a Google-resolved user follows the identical
    // session-issuance path password login uses -- same TTL constant, same
    // refresh-token generation/hash, same session-store primitive, same
    // AccessTokenService. This is deliberately not a second implementation.
    const refreshToken = this.refreshTokenGenerator();
    const refreshTokenHash = this.refreshTokenHasher(refreshToken);
    const expiresAt = new Date(this.now() + LOGIN_SESSION_TTL_MS);
    const session = await this.sessionIssuer.createSession({
      expiresAt,
      refreshTokenHash,
      userId: user.id,
    });
    const accessToken = this.accessTokenIssuer.issue({
      sessionId: session.id,
      userId: user.id,
    });

    return {
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken,
      session,
      user,
    };
  }

  /**
   * Connect-Google (authenticated linking). `userId` is the CURRENT caller's
   * principal, established by `AccessTokenGuard` -- never taken from the
   * request body. Never creates a user, workspace, membership, or session;
   * never requires (or even checks) email equality with the DomainPulse
   * account (locked -- the proof is the authenticated session plus a
   * successful, nonce/PKCE-verified Google authorization, not email).
   */
  async completeLinkCallback(
    userId: string,
    code: string,
    state: string,
  ): Promise<GoogleLinkResult> {
    const consumedAt = new Date(this.now());
    const transaction = await this.transactionStore.consumeTransaction(
      GOOGLE_PROVIDER,
      state,
      consumedAt,
    );
    if (!transaction) {
      throw new GoogleAuthenticationFailedError();
    }
    if (transaction.flow !== 'link' || transaction.linkingUserId !== userId) {
      // Either a `login` transaction's state was replayed against the link
      // endpoint, or this transaction was started by a DIFFERENT
      // authenticated user than the one completing it now -- the exact
      // login-CSRF-style abuse `linkingUserId` exists to prevent.
      throw new GoogleAuthenticationFailedError();
    }

    const idToken = await this.tokenExchangeClient.exchangeAuthorizationCode(
      this.config,
      code,
      transaction.codeVerifier,
    );
    const claims = await this.idTokenVerifier.verify(
      idToken,
      this.config.clientId,
      transaction.nonce,
    );

    const existingIdentity = await this.identityStore.findByProviderSubject(
      GOOGLE_PROVIDER,
      claims.subject,
    );
    if (existingIdentity) {
      if (existingIdentity.user.id !== userId) {
        // This exact (google, sub) already belongs to a DIFFERENT
        // DomainPulse user -- reject, never re-point it.
        throw new GoogleIdentityAlreadyLinkedError();
      }

      // Same (google, sub) already linked to this same user -- idempotent
      // success (locked rule), just refresh last-observed metadata.
      await this.identityStore.touchProviderEmail({
        provider: GOOGLE_PROVIDER,
        providerEmail: claims.email,
        providerEmailVerified: claims.emailVerified,
        providerSubject: claims.subject,
      });

      return { alreadyLinked: true, providerEmail: claims.email };
    }

    await this.identityStore.attachIdentityToExistingUser({
      provider: GOOGLE_PROVIDER,
      providerEmail: claims.email,
      providerEmailVerified: claims.emailVerified,
      providerSubject: claims.subject,
      userId,
    });

    return { alreadyLinked: false, providerEmail: claims.email };
  }
}
