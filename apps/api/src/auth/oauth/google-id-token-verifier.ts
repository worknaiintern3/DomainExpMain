import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

import { GoogleAuthenticationFailedError } from './google-oauth.errors';
import type { VerifiedGoogleIdTokenClaims } from './google-oauth.types';

/**
 * All remote-JWKS handling (fetch, per-`kid` caching, rotation) is `jose`'s
 * `createRemoteJWKSet` -- nothing here hand-rolls key fetching, caching, or
 * selection (locked decision 7). `jwtVerify` itself performs the
 * cryptographic signature check against the resolved key and enforces the
 * pinned algorithm allowlist; this module only adds the claim-level checks
 * `jose` doesn't already cover (nonce; the narrow, Zod-validated shape of
 * the claims this codebase actually trusts).
 */

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const ACCEPTED_ALGORITHMS = ['RS256'];
/** Tolerates ordinary clock skew between this server and Google's, matching the conservative-but-not-zero tolerance AccessTokenService.verify() applies to its own `iat`/`exp` checks. */
const CLOCK_TOLERANCE_SECONDS = 5;

const GoogleIdTokenClaimsSchema = z.object({
  email: z.string().trim().min(1).max(320),
  // Google's documented claim is a boolean, but some intermediaries have
  // historically stringified it; both are accepted defensively, never
  // trusted as anything other than exactly `true` for "verified".
  email_verified: z.union([
    z.boolean(),
    z.enum(['true', 'false']).transform((value) => value === 'true'),
  ]),
  name: z.string().trim().min(1).max(200).optional(),
  nonce: z.string().min(1),
  sub: z.string().min(1).max(255),
});

export interface GoogleIdTokenVerifierOptions {
  readonly jwksUri?: string;
  /** Test-only escape hatch: inject a `jose` key resolver directly (e.g. `createLocalJWKSet`) so unit tests never perform a real network fetch against Google. Production code always omits this and gets a real `createRemoteJWKSet`. */
  readonly keyResolver?: JWTVerifyGetKey;
}

export class GoogleIdTokenVerifier {
  private readonly jwks: JWTVerifyGetKey;

  constructor(options: GoogleIdTokenVerifierOptions = {}) {
    this.jwks =
      options.keyResolver ??
      createRemoteJWKSet(new URL(options.jwksUri ?? GOOGLE_JWKS_URI));
  }

  /** Verifies signature, issuer, audience, expiry, algorithm, and nonce together; returns only the narrow claim shape the rest of the system trusts. Any failure -- cryptographic or claim-shape -- throws the one generic GoogleAuthenticationFailedError. */
  async verify(
    idToken: string,
    audience: string,
    expectedNonce: string,
  ): Promise<VerifiedGoogleIdTokenClaims> {
    let payload: JWTPayload;
    try {
      const result = await jwtVerify(idToken, this.jwks, {
        algorithms: ACCEPTED_ALGORITHMS,
        audience,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        issuer: GOOGLE_ISSUERS,
      });
      payload = result.payload;
    } catch {
      throw new GoogleAuthenticationFailedError();
    }

    // `jwtVerify` validates `exp`/`nbf` against the clock, but does not by
    // itself reject an `iat` that is absurdly in the future (a token issued
    // "ahead of time" with a correspondingly pushed-out `exp` would
    // otherwise still pass) -- checked explicitly here rather than assumed.
    if (
      typeof payload.iat !== 'number' ||
      payload.iat > Math.floor(Date.now() / 1_000) + CLOCK_TOLERANCE_SECONDS
    ) {
      throw new GoogleAuthenticationFailedError();
    }

    const claims = GoogleIdTokenClaimsSchema.safeParse(payload);
    if (!claims.success) {
      throw new GoogleAuthenticationFailedError();
    }
    // Constant-time-insensitive comparison is unnecessary here: `nonce` is
    // not a secret an attacker is trying to brute-force character-by-
    // character (it was already bound to this specific transaction row via
    // the earlier state-consume step), so a plain equality check is
    // sufficient and matches the codebase's existing plain-equality claim
    // checks in AccessTokenService.verify().
    if (claims.data.nonce !== expectedNonce) {
      throw new GoogleAuthenticationFailedError();
    }

    return {
      email: claims.data.email,
      emailVerified: claims.data.email_verified,
      name: claims.data.name ?? null,
      subject: claims.data.sub,
    };
  }
}
