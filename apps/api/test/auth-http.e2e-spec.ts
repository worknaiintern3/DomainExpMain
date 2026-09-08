import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AccessTokenService } from '../src/auth/access-token';
import { AuthController, AccessTokenGuard } from '../src/auth/http';
import {
  AuthenticatedIdentityNotFoundError,
  IdentityService,
} from '../src/auth/identity';
import { InvalidCredentialsError } from '../src/auth/login';
import {
  RegistrationEmailConflictError,
  RegistrationService,
} from '../src/auth/registration';
import { AuthenticationService } from '../src/auth/runtime';
import { InvalidRefreshTokenError, LogoutService } from '../src/auth/session';

const userId = randomUUID();
const sessionId = randomUUID();
const now = new Date('2033-05-18T03:33:20.000Z');
const accessTokenService = new AccessTokenService(
  {
    audience: 'domainpulse-test-clients',
    issuer: 'domainpulse-test-api',
    signingKey: Buffer.alloc(32, 41),
    ttlSeconds: 300,
  },
  () => 2_000_000_000,
);
const issuedAccessToken = accessTokenService.issue({ sessionId, userId });
const publicUser = {
  createdAt: now,
  displayName: 'HTTP Test User',
  email: 'http-user@example.test',
  id: userId,
  normalizedEmail: 'http-user@example.test',
  updatedAt: now,
};
const logout = vi.fn(() => Promise.resolve());
const getAuthenticatedUser = vi.fn((requestedUserId: string) => {
  if (requestedUserId !== userId) {
    return Promise.reject(new AuthenticatedIdentityNotFoundError());
  }

  return Promise.resolve(publicUser);
});
const registrationService = {
  register: (input: { email: string }) => {
    if (input.email === 'duplicate@example.test') {
      return Promise.reject(new RegistrationEmailConflictError());
    }

    return Promise.resolve(publicUser);
  },
};
const authenticationService = {
  login: (input: { email: string }) => {
    if (input.email === 'invalid@example.test') {
      return Promise.reject(new InvalidCredentialsError());
    }

    return Promise.resolve({
      accessToken: 'test-access-output',
      accessTokenExpiresAt: now,
      refreshToken: 'test-refresh-output',
      session: { expiresAt: now, id: sessionId },
      user: publicUser,
    });
  },
  refresh: (refreshToken: string) => {
    if (refreshToken === 'invalid-refresh-input') {
      return Promise.reject(new InvalidRefreshTokenError());
    }

    return Promise.resolve({
      accessToken: 'rotated-access-output',
      accessTokenExpiresAt: now,
      refreshToken: 'rotated-refresh-output',
      session: { expiresAt: now, id: randomUUID() },
    });
  },
};

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AccessTokenService, useValue: accessTokenService },
    { provide: RegistrationService, useValue: registrationService },
    { provide: AuthenticationService, useValue: authenticationService },
    { provide: LogoutService, useValue: { logout } },
    { provide: IdentityService, useValue: { getAuthenticatedUser } },
    AccessTokenGuard,
  ],
})
class TestAuthHttpModule {
  readonly testModule = true;
}

describe('auth HTTP endpoints', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      TestAuthHttpModule,
      new FastifyAdapter({ logger: false }),
      { logger: false },
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('validates registration input without echoing rejected values', async () => {
    const rejectedPassword = 'short';
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'not-an-email', password: rejectedPassword },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(rejectedPassword);
    expect(response.body).not.toContain('not-an-email');
  });

  it('registers safely and maps duplicate email to 409', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        displayName: 'HTTP Test User',
        email: 'http-user@example.test',
        password: 'bounded-test-password',
      },
    });
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'duplicate@example.test',
        password: 'bounded-test-password',
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.body).not.toMatch(/password|hash/iu);
    expect(duplicate.statusCode).toBe(409);
  });

  it('returns token pairs for valid login and a generic 401 for failure', async () => {
    const success = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'http-user@example.test',
        password: 'bounded-test-password',
      },
    });
    const failure = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'invalid@example.test',
        password: 'bounded-test-password',
      },
    });

    expect(success.statusCode).toBe(200);
    expect(success.json()).toEqual(
      expect.objectContaining({
        accessToken: 'test-access-output',
        refreshToken: 'test-refresh-output',
      }),
    );
    expect(failure.statusCode).toBe(401);
    expect(failure.body).not.toContain('invalid@example.test');
  });

  it('rotates a valid refresh token and rejects an invalid one', async () => {
    const success = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'bounded-refresh-input' },
    });
    const failure = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'invalid-refresh-input' },
    });

    expect(success.statusCode).toBe(200);
    expect(success.json()).toEqual(
      expect.objectContaining({
        accessToken: 'rotated-access-output',
        refreshToken: 'rotated-refresh-output',
      }),
    );
    expect(failure.statusCode).toBe(401);
    expect(failure.body).not.toContain('invalid-refresh-input');
  });

  it('protects /auth/me and resolves only the authenticated identity', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    const success = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
    });

    expect(missing.statusCode).toBe(401);
    expect(success.statusCode).toBe(200);
    expect(success.body).not.toMatch(/password|hash|refreshToken/iu);
    expect(getAuthenticatedUser).toHaveBeenCalledWith(userId);
  });

  it('revokes the signed current session and remains idempotent', async () => {
    const request = {
      method: 'POST' as const,
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
    };

    const first = await app.inject(request);
    const second = await app.inject(request);

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
    expect(logout).toHaveBeenCalledWith({ sessionId, userId });
  });
});
