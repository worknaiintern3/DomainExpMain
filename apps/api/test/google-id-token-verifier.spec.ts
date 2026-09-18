import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { GoogleAuthenticationFailedError } from '../src/auth/oauth';
import { GoogleIdTokenVerifier } from '../src/auth/oauth/google-id-token-verifier';

const AUDIENCE = 'test-google-client-id';
const NONCE = 'test-nonce-value';
const KEY_ID = 'test-key-1';

type RsaPrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

async function buildVerifier() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const jwks = createLocalJWKSet({ keys: [{ ...jwk, alg: 'RS256', kid: KEY_ID, use: 'sig' }] });
  const verifier = new GoogleIdTokenVerifier({ keyResolver: jwks });
  return { privateKey, verifier };
}

interface ClaimOverrides {
  aud?: string;
  email?: unknown;
  email_verified?: unknown;
  exp?: string | number;
  iat?: number;
  iss?: string;
  name?: unknown;
  nonce?: unknown;
  omitEmail?: boolean;
  sub?: unknown;
}

async function signToken(privateKey: RsaPrivateKey, overrides: ClaimOverrides = {}): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const payload: Record<string, unknown> = {
    email_verified: overrides.email_verified ?? true,
    name: overrides.name,
    nonce: overrides.nonce ?? NONCE,
  };
  if (!overrides.omitEmail) {
    payload.email = overrides.email ?? 'user@example.test';
  }
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setSubject((overrides.sub as string | undefined) ?? 'google-subject-1')
    .setIssuedAt(overrides.iat ?? nowSeconds)
    .setIssuer(overrides.iss ?? 'https://accounts.google.com')
    .setAudience(overrides.aud ?? AUDIENCE)
    .setExpirationTime(overrides.exp ?? '5m');

  return jwt.sign(privateKey);
}

describe('GoogleIdTokenVerifier', () => {
  it('accepts a validly signed token with all expected claims', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey);

    const claims = await verifier.verify(token, AUDIENCE, NONCE);

    expect(claims).toEqual({
      email: 'user@example.test',
      emailVerified: true,
      name: null,
      subject: 'google-subject-1',
    });
  });

  it('accepts the alternate documented Google issuer form', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey, { iss: 'accounts.google.com' });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).resolves.toMatchObject({
      subject: 'google-subject-1',
    });
  });

  it('rejects a token signed by an untrusted key (bad signature)', async () => {
    const { verifier } = await buildVerifier();
    const { privateKey: otherKey } = await generateKeyPair('RS256');
    const token = await signToken(otherKey);

    await expect(verifier.verify(token, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('rejects a wrong issuer', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey, { iss: 'https://evil.example' });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('rejects a wrong audience', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey, { aud: 'someone-elses-client-id' });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('rejects an expired token', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey, { exp: '-10m' });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('rejects a token issued far in the future (invalid iat)', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const farFuture = Math.floor(Date.now() / 1_000) + 24 * 60 * 60;
    const token = await signToken(privateKey, { iat: farFuture, exp: farFuture + 300 });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('rejects a nonce mismatch', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey, { nonce: 'a-different-nonce' });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('rejects a missing/blank subject', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey, { sub: '' });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('rejects a missing email claim', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey, { omitEmail: true });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('accepts a stringified "true"/"false" email_verified defensively, never trusting anything but exact true', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const trueToken = await signToken(privateKey, { email_verified: 'true' });
    const falseToken = await signToken(privateKey, { email_verified: 'false' });

    await expect(verifier.verify(trueToken, AUDIENCE, NONCE)).resolves.toMatchObject({ emailVerified: true });
    await expect(verifier.verify(falseToken, AUDIENCE, NONCE)).resolves.toMatchObject({ emailVerified: false });
  });

  it('rejects a malformed email_verified value', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey, { email_verified: 'not-a-boolean' });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('rejects a token signed with an unaccepted algorithm (e.g. HS256)', async () => {
    const { verifier } = await buildVerifier();
    // A symmetric HS256 token can never validate against an RSA JWKS in the
    // first place, but this also documents that only RS256 is ever accepted
    // -- there is no algorithm-negotiation surface to confuse.
    const hsToken = await new SignJWT({ email: 'x@example.test', email_verified: true, nonce: NONCE })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('sub')
      .setIssuedAt()
      .setIssuer('https://accounts.google.com')
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('irrelevant-shared-secret-not-a-real-key'));

    await expect(verifier.verify(hsToken, AUDIENCE, NONCE)).rejects.toBeInstanceOf(
      GoogleAuthenticationFailedError,
    );
  });

  it('accepts an optional, valid name claim', async () => {
    const { privateKey, verifier } = await buildVerifier();
    const token = await signToken(privateKey, { name: 'Test User' });

    await expect(verifier.verify(token, AUDIENCE, NONCE)).resolves.toMatchObject({ name: 'Test User' });
  });
});
