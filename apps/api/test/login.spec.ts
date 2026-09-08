import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  sessions,
  users,
  type DatabaseClient,
} from '@domainpulse/database';
import { eq, like, count } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { hashRefreshToken, verifyPassword } from '../src/auth/crypto';
import {
  DUMMY_PASSWORD_HASH,
  InvalidCredentialsError,
  LOGIN_SESSION_TTL_MS,
  LoginPersistenceError,
  LoginService,
  PostgresLoginRepository,
  type LoginStore,
  type StoredLoginCredential,
} from '../src/auth/login';
import { RegistrationService } from '../src/auth/registration';
import { PostgresRegistrationRepository } from '../src/auth/registration';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

function buildCredential(): StoredLoginCredential {
  const now = new Date();
  return {
    passwordHash: 'stored-hash',
    user: {
      createdAt: now,
      displayName: 'Test User',
      email: 'Test.User@example.test',
      id: randomUUID(),
      normalizedEmail: 'test.user@example.test',
      updatedAt: now,
    },
  };
}

describe('LoginService', () => {
  it('normalizes email and returns user, session, and raw refresh token', async () => {
    const credential = buildCredential();
    let lookedUp: string | undefined;
    const store: LoginStore = {
      createSession(input) {
        return Promise.resolve({
          expiresAt: input.expiresAt,
          id: randomUUID(),
        });
      },
      findCredentialByNormalizedEmail(normalizedEmail) {
        lookedUp = normalizedEmail;
        return Promise.resolve(credential);
      },
    };
    const service = new LoginService(
      store,
      () => Promise.resolve(true),
      () => 'raw-refresh-token',
      () => 'hashed-refresh-token',
      60_000,
      () => 1_000,
    );

    const result = await service.login({
      email: '  Test.User@EXAMPLE.TEST  ',
      password: 'candidate-password',
    });

    expect(lookedUp).toBe('test.user@example.test');
    expect(result.user).toBe(credential.user);
    expect(result.refreshToken).toBe('raw-refresh-token');
    expect(result.session.expiresAt).toEqual(new Date(61_000));
  });

  it('verifies exactly once against the dummy hash for unknown email and creates no session', async () => {
    const createSession = vi.fn(
      (): Promise<{ expiresAt: Date; id: string }> =>
        Promise.reject(new LoginPersistenceError()),
    );
    const store: LoginStore = {
      createSession,
      findCredentialByNormalizedEmail: () => Promise.resolve(undefined),
    };
    const verifier = vi.fn(() => Promise.resolve(false));

    const error = await new LoginService(store, verifier)
      .login({ email: 'missing@example.test', password: 'candidate-password' })
      .catch((loginError: unknown) => loginError);

    expect(error).toBeInstanceOf(InvalidCredentialsError);
    expect(verifier).toHaveBeenCalledTimes(1);
    expect(verifier).toHaveBeenCalledWith(
      'candidate-password',
      DUMMY_PASSWORD_HASH,
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it('verifies exactly once against the stored hash for wrong password and creates no session', async () => {
    const credential = buildCredential();
    const createSession = vi.fn(
      (): Promise<{ expiresAt: Date; id: string }> =>
        Promise.reject(new LoginPersistenceError()),
    );
    const store: LoginStore = {
      createSession,
      findCredentialByNormalizedEmail: () => Promise.resolve(credential),
    };
    const verifier = vi.fn(() => Promise.resolve(false));

    const error = await new LoginService(store, verifier)
      .login({ email: 'test.user@example.test', password: 'wrong-password' })
      .catch((loginError: unknown) => loginError);

    expect(error).toBeInstanceOf(InvalidCredentialsError);
    expect(verifier).toHaveBeenCalledTimes(1);
    expect(verifier).toHaveBeenCalledWith('wrong-password', 'stored-hash');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('returns the identical safe error for both failure paths', async () => {
    const credential = buildCredential();
    const unknownStore: LoginStore = {
      createSession: () => Promise.reject(new LoginPersistenceError()),
      findCredentialByNormalizedEmail: () => Promise.resolve(undefined),
    };
    const wrongPasswordStore: LoginStore = {
      createSession: () => Promise.reject(new LoginPersistenceError()),
      findCredentialByNormalizedEmail: () => Promise.resolve(credential),
    };
    const unknownVerifier = vi.fn(() => Promise.resolve(false));
    const wrongPasswordVerifier = vi.fn(() => Promise.resolve(false));

    const unknownError = await new LoginService(
      unknownStore,
      unknownVerifier,
    )
      .login({ email: 'missing@example.test', password: 'candidate-password' })
      .catch((error: unknown) => error);
    const wrongPasswordError = await new LoginService(
      wrongPasswordStore,
      wrongPasswordVerifier,
    )
      .login({ email: 'test.user@example.test', password: 'wrong-password' })
      .catch((error: unknown) => error);

    expect(unknownError).toBeInstanceOf(InvalidCredentialsError);
    expect(wrongPasswordError).toBeInstanceOf(InvalidCredentialsError);
    expect(unknownVerifier).toHaveBeenCalledTimes(1);
    expect(wrongPasswordVerifier).toHaveBeenCalledTimes(1);
    expect({
      code: (wrongPasswordError as InvalidCredentialsError).code,
      message: (wrongPasswordError as Error).message,
      name: (wrongPasswordError as Error).name,
    }).toEqual({
      code: (unknownError as InvalidCredentialsError).code,
      message: (unknownError as Error).message,
      name: (unknownError as Error).name,
    });
  });

  it('does not expose whether an account exists', async () => {
    const store: LoginStore = {
      createSession: () => Promise.reject(new LoginPersistenceError()),
      findCredentialByNormalizedEmail: () => Promise.resolve(undefined),
    };
    const verifier = vi.fn(() => Promise.resolve(false));

    const error = await new LoginService(store, verifier)
      .login({ email: 'missing@example.test', password: 'x' })
      .catch((loginError: unknown) => loginError);

    expect(error).toBeInstanceOf(InvalidCredentialsError);
    expect((error as Error).message).toBe('Invalid email or password');
    expect((error as Error).message).not.toContain('missing@example.test');
    expect((error as Error).message).not.toMatch(/exist|found|unknown/iu);
  });

  it('uses a dummy hash matching the current scrypt profile', async () => {
    expect(DUMMY_PASSWORD_HASH.startsWith('$scrypt$v=1$N=131072,r=8,p=1,l=64$')).toBe(
      true,
    );
    await expect(
      verifyPassword('candidate-password', DUMMY_PASSWORD_HASH),
    ).resolves.toBe(false);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, LOGIN_SESSION_TTL_MS + 1])(
    'rejects session TTL %s',
    (ttl) => {
      const store: LoginStore = {
        createSession: () => Promise.reject(new LoginPersistenceError()),
        findCredentialByNormalizedEmail: () => Promise.resolve(undefined),
      };

      expect(
        () => new LoginService(store, undefined, undefined, undefined, ttl),
      ).toThrow(RangeError);
    },
  );
});

describeWithPostgreSql(
  'login persistence (requires a disposable TEST_DATABASE_URL)',
  () => {
    const suitePrefix = `login-test-${randomUUID()}`;
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Login integration client was not initialized');
      }

      return client;
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

      await client.database
        .delete(users)
        .where(like(users.normalizedEmail, `${suitePrefix}-%`));
      await client.close();
    });

    it('creates a session storing only the refresh-token hash', async () => {
      const activeClient = getClient();
      const registration = new RegistrationService(
        new PostgresRegistrationRepository(activeClient),
      );
      const password = 'login-integration-password-not-used-elsewhere';
      const email = `${suitePrefix}-user@example.test`;
      const registered = await registration.register({ email, password });

      const service = new LoginService(
        new PostgresLoginRepository(activeClient),
      );
      const result = await service.login({
        email: `  ${email.toUpperCase()}  `,
        password,
      });

      expect(result.user.id).toBe(registered.id);
      expect(result.refreshToken.length).toBeGreaterThan(0);

      const [persisted] = await activeClient.database
        .select()
        .from(sessions)
        .where(eq(sessions.id, result.session.id));

      expect(persisted).toBeDefined();
      expect(persisted?.userId).toBe(registered.id);
      expect(persisted?.refreshTokenHash).toBe(
        hashRefreshToken(result.refreshToken),
      );
      expect(persisted).not.toHaveProperty('refreshToken');

      const ttlMs =
        (persisted?.expiresAt.getTime() ?? 0) - Date.now();
      expect(ttlMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 60_000);
    });

    it('rejects unknown email and wrong password with the same safe error', async () => {
      const activeClient = getClient();
      const registration = new RegistrationService(
        new PostgresRegistrationRepository(activeClient),
      );
      const email = `${suitePrefix}-same-error@example.test`;
      await registration.register({
        email,
        password: 'correct-login-integration-password',
      });

      const service = new LoginService(
        new PostgresLoginRepository(activeClient),
      );

      const unknown = await service
        .login({
          email: `${suitePrefix}-missing@example.test`,
          password: 'candidate-password',
        })
        .catch((error: unknown) => error);
      const wrong = await service
        .login({ email, password: 'wrong-password' })
        .catch((error: unknown) => error);

      for (const error of [unknown, wrong]) {
        expect(error).toBeInstanceOf(InvalidCredentialsError);
        expect(error).toEqual(
          expect.objectContaining({
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            name: InvalidCredentialsError.name,
          }),
        );
      }
    });

    it('creates no session for unknown email or wrong password', async () => {
      const activeClient = getClient();
      const registration = new RegistrationService(
        new PostgresRegistrationRepository(activeClient),
      );
      const email = `${suitePrefix}-no-session@example.test`;
      await registration.register({
        email,
        password: 'correct-login-integration-password',
      });

      const service = new LoginService(
        new PostgresLoginRepository(activeClient),
      );
      const [before] = await activeClient.database
        .select({ value: count() })
        .from(sessions);

      await service
        .login({
          email: `${suitePrefix}-absent@example.test`,
          password: 'candidate-password',
        })
        .catch(() => undefined);
      await service
        .login({ email, password: 'wrong-password' })
        .catch(() => undefined);

      const [after] = await activeClient.database
        .select({ value: count() })
        .from(sessions);

      expect(after?.value).toBe(before?.value);
    });

    it('sanitizes repository lookup failures', async () => {
      const activeClient = getClient();
      const repository = new PostgresLoginRepository(activeClient);
      await activeClient.close();
      client = undefined;

      await expect(
        repository.findCredentialByNormalizedEmail('any@example.test'),
      ).rejects.toBeInstanceOf(LoginPersistenceError);
    });

  },
);
