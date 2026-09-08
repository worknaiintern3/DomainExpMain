import { randomUUID } from 'node:crypto';

import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AccessTokenService } from '../src/auth/access-token';
import { AccessTokenGuard } from '../src/auth/http';
import type { AuthenticatedRequest } from '../src/auth/http';

const NOW_SECONDS = 2_000_000_000;

function buildContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getNext: () => undefined,
      getRequest: () => request,
      getResponse: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

function buildAccessTokenService(): AccessTokenService {
  return new AccessTokenService(
    {
      audience: 'domainpulse-test-clients',
      issuer: 'domainpulse-test-api',
      signingKey: Buffer.alloc(32, 21),
      ttlSeconds: 300,
    },
    () => NOW_SECONDS,
  );
}

describe('AccessTokenGuard', () => {
  it('rejects a missing bearer token with a generic 401', () => {
    const guard = new AccessTokenGuard(buildAccessTokenService());
    const request = { headers: {} } as AuthenticatedRequest;

    expect(() => guard.canActivate(buildContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid bearer token without exposing JWT details', () => {
    const guard = new AccessTokenGuard(buildAccessTokenService());
    const request = {
      headers: { authorization: 'Bearer invalid-token' },
    } as AuthenticatedRequest;

    const error = (() => {
      try {
        guard.canActivate(buildContext(request));
      } catch (guardError) {
        return guardError;
      }
      return undefined;
    })();

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as Error).message).toBe('Authentication required');
  });

  it('attaches a typed principal for a valid bearer token', () => {
    const accessTokenService = buildAccessTokenService();
    const guard = new AccessTokenGuard(accessTokenService);
    const principal = { sessionId: randomUUID(), userId: randomUUID() };
    const issued = accessTokenService.issue(principal);
    const request = {
      headers: { authorization: `Bearer ${issued.token}` },
    } as AuthenticatedRequest;

    expect(guard.canActivate(buildContext(request))).toBe(true);
    expect(request.authPrincipal).toEqual(principal);
  });
});
