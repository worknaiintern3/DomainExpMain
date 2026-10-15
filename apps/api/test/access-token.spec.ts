import { randomUUID } from 'node:crypto';

import { sign } from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { MAX_ACCESS_TOKEN_TTL_SECONDS } from '../src/auth/access-token/access-token.config';

import {
  AccessTokenConfigurationError,
  AccessTokenService,
  InvalidAccessTokenError,
  parseAccessTokenEnvironment,
  type AccessTokenConfiguration,
} from '../src/auth/access-token';

const NOW_SECONDS = 2_000_000_000;

function buildTestSigningKey(seed: number): Buffer {
  return Buffer.from(
    Array.from({ length: 32 }, (_, index) => (index + seed) % 256),
  );
}

function buildConfiguration(
  overrides: Partial<AccessTokenConfiguration> = {},
): AccessTokenConfiguration {
  return {
    audience: 'domainpulse-test-clients',
    issuer: 'domainpulse-test-api',
    signingKey: buildTestSigningKey(11),
    ttlSeconds: 300,
    ...overrides,
  };
}

describe('AccessTokenService', () => {
  it('issues and verifies a token with the required identity claims', () => {
    const configuration = buildConfiguration();
    const service = new AccessTokenService(
      configuration,
      () => NOW_SECONDS,
    );
    const subject = { sessionId: randomUUID(), userId: randomUUID() };

    const issued = service.issue(subject);

    expect(service.verify(issued.token)).toEqual(subject);
    expect(issued.expiresAt).toEqual(
      new Date((NOW_SECONDS + configuration.ttlSeconds) * 1_000),
    );
  });

  it('rejects an expired token', () => {
    const configuration = buildConfiguration();
    const issuer = new AccessTokenService(configuration, () => NOW_SECONDS);
    const issued = issuer.issue({
      sessionId: randomUUID(),
      userId: randomUUID(),
    });
    const verifier = new AccessTokenService(
      configuration,
      () => NOW_SECONDS + configuration.ttlSeconds + 1,
    );

    expect(() => verifier.verify(issued.token)).toThrow(
      InvalidAccessTokenError,
    );
  });

  it('rejects an invalid signature', () => {
    const verifier = new AccessTokenService(
      buildConfiguration(),
      () => NOW_SECONDS,
    );
    const attacker = new AccessTokenService(
      buildConfiguration({ signingKey: buildTestSigningKey(12) }),
      () => NOW_SECONDS,
    );
    const issued = attacker.issue({
      sessionId: randomUUID(),
      userId: randomUUID(),
    });

    expect(() => verifier.verify(issued.token)).toThrow(
      InvalidAccessTokenError,
    );
  });

  it('rejects the wrong issuer', () => {
    const verifier = new AccessTokenService(
      buildConfiguration(),
      () => NOW_SECONDS,
    );
    const otherIssuer = new AccessTokenService(
      buildConfiguration({ issuer: 'other-test-issuer' }),
      () => NOW_SECONDS,
    );
    const issued = otherIssuer.issue({
      sessionId: randomUUID(),
      userId: randomUUID(),
    });

    expect(() => verifier.verify(issued.token)).toThrow(
      InvalidAccessTokenError,
    );
  });

  it('rejects the wrong audience', () => {
    const verifier = new AccessTokenService(
      buildConfiguration(),
      () => NOW_SECONDS,
    );
    const otherAudience = new AccessTokenService(
      buildConfiguration({ audience: 'other-test-audience' }),
      () => NOW_SECONDS,
    );
    const issued = otherAudience.issue({
      sessionId: randomUUID(),
      userId: randomUUID(),
    });

    expect(() => verifier.verify(issued.token)).toThrow(
      InvalidAccessTokenError,
    );
  });

  it.each([
    '',
    'not-a-jwt',
    'header.payload.signature',
    'x'.repeat(8_193),
  ])('rejects malformed token input', (token) => {
    const service = new AccessTokenService(
      buildConfiguration(),
      () => NOW_SECONDS,
    );

    expect(() => service.verify(token)).toThrow(InvalidAccessTokenError);
  });

  it.each(['sub', 'sid', 'iat', 'exp'] as const)(
    'rejects a token missing required %s claim',
    (missingClaim) => {
      const configuration = buildConfiguration();
      const completeClaims: Record<string, string | number> = {
        aud: configuration.audience,
        exp: NOW_SECONDS + configuration.ttlSeconds,
        iat: NOW_SECONDS,
        iss: configuration.issuer,
        sid: randomUUID(),
        sub: randomUUID(),
      };
      const claims = Object.fromEntries(
        Object.entries(completeClaims).filter(
          ([claimName]) => claimName !== missingClaim,
        ),
      );
      const token = sign(claims, configuration.signingKey, {
        algorithm: 'HS256',
        noTimestamp: missingClaim === 'iat',
      });
      const service = new AccessTokenService(
        configuration,
        () => NOW_SECONDS,
      );

      expect(() => service.verify(token)).toThrow(InvalidAccessTokenError);
    },
  );

  it('rejects a token issued in the future', () => {
    const configuration = buildConfiguration();
    const token = sign(
      {
        aud: configuration.audience,
        exp: NOW_SECONDS + 400,
        iat: NOW_SECONDS + 100,
        iss: configuration.issuer,
        sid: randomUUID(),
        sub: randomUUID(),
      },
      configuration.signingKey,
      { algorithm: 'HS256' },
    );
    const service = new AccessTokenService(
      configuration,
      () => NOW_SECONDS,
    );

    expect(() => service.verify(token)).toThrow(InvalidAccessTokenError);
  });
});

describe('access-token configuration', () => {
  it('accepts a strong encoded key and applies the bounded default TTL', () => {
    const configuration = parseAccessTokenEnvironment({
      JWT_ACCESS_TOKEN_AUDIENCE: 'domainpulse-test-clients',
      JWT_ACCESS_TOKEN_ISSUER: 'domainpulse-test-api',
      JWT_ACCESS_TOKEN_SECRET: buildTestSigningKey(13).toString('base64url'),
    });

    expect(configuration.ttlSeconds).toBe(300);
    expect(configuration.signingKey).toHaveLength(32);
  });

  it.each([
    {},
    {
      JWT_ACCESS_TOKEN_AUDIENCE: 'domainpulse-test-clients',
      JWT_ACCESS_TOKEN_ISSUER: 'domainpulse-test-api',
      JWT_ACCESS_TOKEN_SECRET: 'weak',
    },
    {
      JWT_ACCESS_TOKEN_AUDIENCE: 'domainpulse-test-clients',
      JWT_ACCESS_TOKEN_ISSUER: 'domainpulse-test-api',
      JWT_ACCESS_TOKEN_SECRET: Buffer.alloc(32, 13).toString('base64url'),
    },
    {
      JWT_ACCESS_TOKEN_AUDIENCE: 'domainpulse-test-clients',
      JWT_ACCESS_TOKEN_ISSUER: 'domainpulse-test-api',
      JWT_ACCESS_TOKEN_SECRET: buildTestSigningKey(13).toString('base64url'),
      JWT_ACCESS_TOKEN_TTL_SECONDS: String(MAX_ACCESS_TOKEN_TTL_SECONDS + 1),
    },
  ])('rejects missing, weak, or out-of-range configuration', (environment) => {
    expect(() => parseAccessTokenEnvironment(environment)).toThrow(
      AccessTokenConfigurationError,
    );
  });
});
