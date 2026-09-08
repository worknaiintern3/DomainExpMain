import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  sessions,
  type DatabaseClient,
} from '@domainpulse/database';
import { and, count, eq, isNull } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AccessTokenService } from '../src/auth/access-token';
import { generateRefreshToken, hashRefreshToken } from '../src/auth/crypto';
import { PostgresLoginRepository, LoginService } from '../src/auth/login';
import {
  PostgresRegistrationRepository,
  RegistrationService,
} from '../src/auth/registration';
import { AuthenticationService } from '../src/auth/runtime';
import {
  InvalidRefreshTokenError,
  LogoutService,
  PostgresSessionRepository,
  RefreshTokenService,
  type SessionStore,
} from '../src/auth/session';
import {
  cleanupRegisteredUsers,
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

describe('authentication token issuance', () => {
  it('adds a signed access token to login while persisting only the refresh hash', async () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    let persistedRefreshHash: string | undefined;
    const loginService = new LoginService(
      {
        createSession(input) {
          persistedRefreshHash = input.refreshTokenHash;
          return Promise.resolve({ expiresAt: input.expiresAt, id: sessionId });
        },
        findCredentialByNormalizedEmail() {
          const timestamp = new Date(1_000);
          return Promise.resolve({
            passwordHash: 'stored-password-hash',
            user: {
              createdAt: timestamp,
              displayName: null,
              email: 'runtime-user@example.test',
              id: userId,
              normalizedEmail: 'runtime-user@example.test',
              updatedAt: timestamp,
            },
          });
        },
      },
      () => Promise.resolve(true),
      () => 'caller-refresh-output',
      () => 'stored-refresh-hash',
      60_000,
      () => 1_000,
    );
    const accessTokenService = new AccessTokenService(
      {
        audience: 'domainpulse-test-clients',
        issuer: 'domainpulse-test-api',
        signingKey: Buffer.alloc(32, 51),
        ttlSeconds: 300,
      },
      () => 1,
    );
    const unusedRefreshService = new RefreshTokenService(
      {
        revokeSession: () => Promise.resolve(),
        rotateRefreshCredential: () => Promise.resolve({ kind: 'invalid' }),
      },
      accessTokenService,
    );
    const authentication = new AuthenticationService(
      loginService,
      accessTokenService,
      unusedRefreshService,
    );

    const result = await authentication.login({
      email: 'runtime-user@example.test',
      password: 'candidate-password',
    });

    expect(result.refreshToken).toBe('caller-refresh-output');
    expect(persistedRefreshHash).toBe('stored-refresh-hash');
    expect(persistedRefreshHash).not.toBe(result.refreshToken);
    expect(accessTokenService.verify(result.accessToken)).toEqual({
      sessionId,
      userId,
    });
  });
});

describe('refresh and logout services', () => {
  it('hashes the current token and returns only the newly generated raw token', async () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    const rotateRefreshCredential = vi.fn<SessionStore['rotateRefreshCredential']>(
      () =>
        Promise.resolve({
          kind: 'rotated',
          session: {
            expiresAt: new Date(61_000),
            sessionId,
            userId,
          },
        }),
    );
    const store: SessionStore = {
      revokeSession: () => Promise.resolve(),
      rotateRefreshCredential,
    };
    const service = new RefreshTokenService(
      store,
      {
        issue: () => ({ expiresAt: new Date(2_000), token: 'access-output' }),
      },
      () => 'next-refresh-output',
      (token) => `hash:${token}`,
      60_000,
      () => 1_000,
    );

    const result = await service.refresh('current-refresh-input');

    expect(rotateRefreshCredential).toHaveBeenCalledWith({
      currentRefreshTokenHash: 'hash:current-refresh-input',
      nextExpiresAt: new Date(61_000),
      nextRefreshTokenHash: 'hash:next-refresh-output',
      rotatedAt: new Date(1_000),
    });
    expect(result).toEqual({
      accessToken: 'access-output',
      accessTokenExpiresAt: new Date(2_000),
      refreshToken: 'next-refresh-output',
      session: { expiresAt: new Date(61_000), id: sessionId },
    });
  });

  it.each(['invalid', 'replayed'] as const)(
    'returns the same generic failure for a %s refresh credential',
    async (kind) => {
      const store: SessionStore = {
        revokeSession: () => Promise.resolve(),
        rotateRefreshCredential: () => Promise.resolve({ kind }),
      };
      const service = new RefreshTokenService(
        store,
        {
          issue: () => {
            throw new Error('Access tokens must not be issued');
          },
        },
      );

      const error = await service
        .refresh('bounded-refresh-input')
        .catch((refreshError: unknown) => refreshError);

      expect(error).toBeInstanceOf(InvalidRefreshTokenError);
      expect(error).toEqual(
        expect.objectContaining({
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Authentication failed',
        }),
      );
    },
  );

  it('rejects empty and oversized refresh-token input before persistence', async () => {
    const rotateRefreshCredential = vi.fn<SessionStore['rotateRefreshCredential']>();
    const store: SessionStore = {
      revokeSession: () => Promise.resolve(),
      rotateRefreshCredential,
    };
    const service = new RefreshTokenService(store, {
      issue: () => {
        throw new Error('Access tokens must not be issued');
      },
    });

    await expect(service.refresh('')).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    await expect(service.refresh('x'.repeat(513))).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(rotateRefreshCredential).not.toHaveBeenCalled();
  });

  it('passes only the authenticated principal identifiers to idempotent logout', async () => {
    const revokeSession = vi.fn<SessionStore['revokeSession']>(() =>
      Promise.resolve(),
    );
    const store: SessionStore = {
      revokeSession,
      rotateRefreshCredential: () => Promise.resolve({ kind: 'invalid' }),
    };
    const principal = { sessionId: randomUUID(), userId: randomUUID() };
    const logout = new LogoutService(store, () => 1_000);

    await logout.logout(principal);
    await logout.logout(principal);

    expect(revokeSession).toHaveBeenCalledTimes(2);
    expect(revokeSession).toHaveBeenCalledWith(
      principal.userId,
      principal.sessionId,
      new Date(1_000),
    );
  });
});

describeWithPostgreSql(
  'auth session runtime (requires a disposable TEST_DATABASE_URL)',
  () => {
    const suitePrefix = `auth-runtime-test-${randomUUID()}`;
    const accessTokenConfiguration = {
      audience: 'domainpulse-test-clients',
      issuer: 'domainpulse-test-api',
      signingKey: Buffer.alloc(32, 31),
      ttlSeconds: 300,
    } as const;
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Auth runtime integration client was not initialized');
      }

      return client;
    };

    const buildRuntime = (now: () => number = Date.now) => {
      const activeClient = getClient();
      const accessTokenService = new AccessTokenService(
        accessTokenConfiguration,
        () => Math.floor(now() / 1_000),
      );
      const sessionRepository = new PostgresSessionRepository(activeClient);
      const refreshTokenService = new RefreshTokenService(
        sessionRepository,
        accessTokenService,
        generateRefreshToken,
        hashRefreshToken,
        undefined,
        now,
      );
      const authenticationService = new AuthenticationService(
        new LoginService(new PostgresLoginRepository(activeClient)),
        accessTokenService,
        refreshTokenService,
      );

      return {
        accessTokenService,
        authenticationService,
        logoutService: new LogoutService(sessionRepository, now),
      };
    };

    const register = async (label: string) => {
      const activeClient = getClient();
      return new RegistrationService(
        new PostgresRegistrationRepository(activeClient),
      ).register({
        email: `${suitePrefix}-${label}@example.test`,
        password: 'auth-runtime-integration-password',
      });
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, {
        migrationsFolder: '../../packages/database/migrations',
      });
    });

    afterAll(async () => {
      if (!client) {
        return;
      }

      await cleanupRegisteredUsers(client, suitePrefix);
      await client.close();
    });

    it('login returns a valid access token while persisting only the refresh hash', async () => {
      const user = await register('login');
      const { accessTokenService, authenticationService } = buildRuntime();

      const result = await authenticationService.login({
        email: user.email,
        password: 'auth-runtime-integration-password',
      });
      const [persisted] = await getClient().database
        .select()
        .from(sessions)
        .where(eq(sessions.id, result.session.id));

      expect(accessTokenService.verify(result.accessToken)).toEqual({
        sessionId: result.session.id,
        userId: user.id,
      });
      expect(persisted?.refreshTokenHash).toBe(
        hashRefreshToken(result.refreshToken),
      );
      expect(persisted).not.toHaveProperty('refreshToken');
    });

    it('rotates once and revokes the successor when the old token is replayed', async () => {
      const user = await register('replay');
      const { authenticationService } = buildRuntime();
      const login = await authenticationService.login({
        email: user.email,
        password: 'auth-runtime-integration-password',
      });

      const rotated = await authenticationService.refresh(login.refreshToken);

      expect(rotated.refreshToken).not.toBe(login.refreshToken);
      await expect(
        authenticationService.refresh(login.refreshToken),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

      const [oldSession] = await getClient().database
        .select()
        .from(sessions)
        .where(eq(sessions.id, login.session.id));
      const [successor] = await getClient().database
        .select()
        .from(sessions)
        .where(eq(sessions.id, rotated.session.id));

      expect(oldSession?.revokedAt).toBeInstanceOf(Date);
      expect(successor?.refreshTokenHash).toBe(
        hashRefreshToken(rotated.refreshToken),
      );
      expect(successor?.revokedAt).toBeInstanceOf(Date);
    });

    it('allows only one concurrent rotation and revokes its token family', async () => {
      const user = await register('concurrent');
      const { authenticationService } = buildRuntime();
      const login = await authenticationService.login({
        email: user.email,
        password: 'auth-runtime-integration-password',
      });

      const attempts = await Promise.allSettled([
        authenticationService.refresh(login.refreshToken),
        authenticationService.refresh(login.refreshToken),
      ]);

      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);

      const [activeSessions] = await getClient().database
        .select({ value: count() })
        .from(sessions)
        .where(
          and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)),
        );

      expect(activeSessions?.value).toBe(0);
    });

    it('rejects expired, revoked, malformed, and unknown refresh tokens', async () => {
      const user = await register('invalid-refresh');
      const normalRuntime = buildRuntime();
      const login = await normalRuntime.authenticationService.login({
        email: user.email,
        password: 'auth-runtime-integration-password',
      });
      const futureRuntime = buildRuntime(
        () => Date.now() + 31 * 24 * 60 * 60 * 1_000,
      );

      await expect(
        futureRuntime.authenticationService.refresh(login.refreshToken),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      await expect(
        normalRuntime.authenticationService.refresh(''),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      await expect(
        normalRuntime.authenticationService.refresh(generateRefreshToken()),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

      const secondLogin = await normalRuntime.authenticationService.login({
        email: user.email,
        password: 'auth-runtime-integration-password',
      });
      const principal = normalRuntime.accessTokenService.verify(
        secondLogin.accessToken,
      );
      await normalRuntime.logoutService.logout(principal);
      await normalRuntime.logoutService.logout(principal);
      await expect(
        normalRuntime.authenticationService.refresh(secondLogin.refreshToken),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      expect(() =>
        normalRuntime.accessTokenService.verify(secondLogin.accessToken),
      ).not.toThrow();
    });
  },
);
