import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AccessTokenService } from '../src/auth/access-token';
import {
  AccountService,
  LastLoginMethodError,
  PasswordAlreadySetError,
  type LoginMethodsStatus,
} from '../src/auth/account';
import { AuthController, AccessTokenGuard } from '../src/auth/http';
import {
  AuthenticatedIdentityNotFoundError,
  IdentityService,
} from '../src/auth/identity';
import { InvalidCredentialsError } from '../src/auth/login';
import {
  GoogleAccountAlreadyConnectedError,
  GoogleAccountEmailConflictError,
  GoogleAuthenticationFailedError,
  GoogleIdentityAlreadyLinkedError,
  GoogleOAuthService,
} from '../src/auth/oauth';
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
const googleOAuthService = {
  completeCallback: (code: string, state: string) => {
    if (state === 'conflict-state') {
      return Promise.reject(new GoogleAccountEmailConflictError());
    }
    if (state === 'invalid-state' || code === 'invalid-code') {
      return Promise.reject(new GoogleAuthenticationFailedError());
    }

    return Promise.resolve({
      accessToken: 'google-access-output',
      accessTokenExpiresAt: now,
      refreshToken: 'google-refresh-output',
      session: { expiresAt: now, id: randomUUID() },
      user: publicUser,
    });
  },
  completeLinkCallback: vi.fn((_userId: string, code: string, state: string) => {
    if (state === 'link-invalid-state' || code === 'invalid-code') {
      return Promise.reject(new GoogleAuthenticationFailedError());
    }
    if (state === 'link-identity-owned-by-another-state') {
      return Promise.reject(new GoogleIdentityAlreadyLinkedError());
    }
    if (state === 'link-already-connected-state') {
      return Promise.reject(new GoogleAccountAlreadyConnectedError());
    }
    if (state === 'link-idempotent-state') {
      return Promise.resolve({
        alreadyLinked: true,
        providerEmail: 'already-linked-google@example.test',
      });
    }

    return Promise.resolve({
      alreadyLinked: false,
      providerEmail: 'newly-linked-google@example.test',
    });
  }),
  startLink: vi.fn((userId: string) =>
    Promise.resolve({
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?mock=link&user=${userId}`,
    })),
  startLogin: () =>
    Promise.resolve({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?mock=1',
    }),
};
const getLoginMethods = vi.fn((): Promise<LoginMethodsStatus> =>
  Promise.resolve({
    canUnlinkGoogle: true,
    google: { connected: true, email: 'linked-google@example.test' },
    password: { enabled: true },
  }));
const addPassword = vi.fn((_userId: string, password: string) => {
  if (password === 'trigger-already-set-conflict') {
    return Promise.reject(new PasswordAlreadySetError());
  }

  return Promise.resolve();
});
const unlinkGoogle = vi.fn(() => Promise.resolve());
const accountService = { addPassword, getLoginMethods, unlinkGoogle };

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AccessTokenService, useValue: accessTokenService },
    { provide: RegistrationService, useValue: registrationService },
    { provide: AuthenticationService, useValue: authenticationService },
    { provide: LogoutService, useValue: { logout } },
    { provide: IdentityService, useValue: { getAuthenticatedUser } },
    { provide: GoogleOAuthService, useValue: googleOAuthService },
    { provide: AccountService, useValue: accountService },
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

  it('returns a Google authorization URL from a public, empty-body start request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/start',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?mock=1',
    });
  });

  it('rejects a Google start request carrying unexpected fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/start',
      payload: { redirectUri: 'https://attacker.example/callback' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('completes a Google callback and returns the same token-pair shape as password login', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/callback',
      payload: { code: 'valid-code', state: 'valid-state' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        accessToken: 'google-access-output',
        refreshToken: 'google-refresh-output',
      }),
    );
  });

  it('maps an invalid/expired/replayed Google state to a generic 401, never a distinguishable reason', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/callback',
      payload: { code: 'valid-code', state: 'invalid-state' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).not.toContain('invalid-state');
  });

  it('maps a same-email conflict to 409 with the locked frontend copy', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/callback',
      payload: { code: 'valid-code', state: 'conflict-state' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message:
        'An account with this email already exists. Sign in with your password, then connect Google from Security settings.',
    });
  });

  it('rejects a Google callback request missing code/state', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/callback',
      payload: { code: 'valid-code' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns login-method status only for an authenticated caller', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/login-methods',
    });
    const success = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/login-methods',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
    });

    expect(missing.statusCode).toBe(401);
    expect(success.statusCode).toBe(200);
    expect(success.json()).toEqual({
      canUnlinkGoogle: true,
      google: { connected: true, email: 'linked-google@example.test' },
      password: { enabled: true },
    });
    expect(getLoginMethods).toHaveBeenCalledWith(userId);
  });

  it('reports each login-method combination (password only, Google only, both)', async () => {
    getLoginMethods.mockResolvedValueOnce({
      canUnlinkGoogle: false,
      google: { connected: false, email: null },
      password: { enabled: true },
    });
    const passwordOnly = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/login-methods',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
    });

    getLoginMethods.mockResolvedValueOnce({
      canUnlinkGoogle: false,
      google: { connected: true, email: 'google-only@example.test' },
      password: { enabled: false },
    });
    const googleOnly = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/login-methods',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
    });

    expect(passwordOnly.json()).toMatchObject({
      canUnlinkGoogle: false,
      google: { connected: false },
      password: { enabled: true },
    });
    expect(googleOnly.json()).toMatchObject({
      canUnlinkGoogle: false,
      google: { connected: true },
      password: { enabled: false },
    });
  });

  it('adds a password for the authenticated caller and maps an existing password to 409', async () => {
    const requiresAuth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/add',
      payload: { password: 'a-brand-new-password' },
    });
    const success = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/add',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
      payload: { password: 'a-brand-new-password' },
    });
    const conflict = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/add',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
      payload: { password: 'trigger-already-set-conflict' },
    });

    expect(requiresAuth.statusCode).toBe(401);
    expect(success.statusCode).toBe(200);
    expect(addPassword).toHaveBeenCalledWith(userId, 'a-brand-new-password');
    expect(conflict.statusCode).toBe(409);
  });

  it('rejects an added password that fails the canonical password policy', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/add',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
      payload: { password: 'short' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('starts an authenticated Google link only for a signed-in caller', async () => {
    const requiresAuth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/link/start',
      payload: {},
    });
    const success = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/link/start',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
      payload: {},
    });

    expect(requiresAuth.statusCode).toBe(401);
    expect(success.statusCode).toBe(200);
    expect(success.json()).toEqual({
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?mock=link&user=${userId}`,
    });
    expect(googleOAuthService.startLink).toHaveBeenCalledWith(userId);
  });

  it('completes an authenticated Google link and maps each typed outcome', async () => {
    const requiresAuth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/link/callback',
      payload: { code: 'valid-code', state: 'link-success-state' },
    });
    const success = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/link/callback',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
      payload: { code: 'valid-code', state: 'link-success-state' },
    });
    const idempotent = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/link/callback',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
      payload: { code: 'valid-code', state: 'link-idempotent-state' },
    });
    const invalidState = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/link/callback',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
      payload: { code: 'valid-code', state: 'link-invalid-state' },
    });
    const identityOwnedByAnother = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/link/callback',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
      payload: { code: 'valid-code', state: 'link-identity-owned-by-another-state' },
    });
    const alreadyConnected = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/link/callback',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
      payload: { code: 'valid-code', state: 'link-already-connected-state' },
    });

    expect(requiresAuth.statusCode).toBe(401);
    expect(success.statusCode).toBe(200);
    expect(success.json()).toEqual({
      alreadyLinked: false,
      providerEmail: 'newly-linked-google@example.test',
    });
    expect(idempotent.json()).toEqual({
      alreadyLinked: true,
      providerEmail: 'already-linked-google@example.test',
    });
    expect(invalidState.statusCode).toBe(401);
    expect(identityOwnedByAnother.statusCode).toBe(409);
    expect(alreadyConnected.statusCode).toBe(409);
    expect(googleOAuthService.completeLinkCallback).toHaveBeenCalledWith(
      userId,
      'valid-code',
      'link-success-state',
    );
  });

  it('unlinks Google for the authenticated caller and maps the last-login-method conflict', async () => {
    const requiresAuth = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/google/link',
    });
    const success = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/google/link',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
    });

    unlinkGoogle.mockRejectedValueOnce(new LastLoginMethodError());
    const blocked = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/google/link',
      headers: { authorization: `Bearer ${issuedAccessToken.token}` },
    });

    expect(requiresAuth.statusCode).toBe(401);
    expect(success.statusCode).toBe(200);
    expect(unlinkGoogle).toHaveBeenCalledWith(userId);
    expect(blocked.statusCode).toBe(409);
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
