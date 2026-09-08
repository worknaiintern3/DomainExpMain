import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  passwordCredentials,
  users,
  workspaceMembers,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { and, count, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { verifyPassword } from '../src/auth/crypto';
import {
  PostgresRegistrationRepository,
  RegistrationEmailConflictError,
  RegistrationPersistenceError,
  RegistrationService,
  type PersistRegistrationInput,
  type RegisteredUser,
  type RegistrationStore,
} from '../src/auth/registration';
import {
  cleanupRegisteredUsers,
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

describe('RegistrationService', () => {
  it('normalizes email, hashes the password, and returns no credential data', async () => {
    let persistedInput: PersistRegistrationInput | undefined;
    const registeredUser: RegisteredUser = {
      createdAt: new Date(),
      displayName: 'Test User',
      email: 'Test.User@example.test',
      id: randomUUID(),
      normalizedEmail: 'test.user@example.test',
      updatedAt: new Date(),
    };
    const registrationStore: RegistrationStore = {
      createRegistration(input) {
        persistedInput = input;
        return Promise.resolve(registeredUser);
      },
    };
    const passwordHasher = vi.fn(() =>
      Promise.resolve('encoded-test-password-hash'),
    );
    const service = new RegistrationService(registrationStore, passwordHasher);

    const result = await service.register({
      displayName: 'Test User',
      email: '  Test.User@EXAMPLE.TEST  ',
      password: 'unit-test-password-not-used-by-any-account',
    });

    expect(passwordHasher).toHaveBeenCalledOnce();
    expect(passwordHasher).toHaveBeenCalledWith(
      'unit-test-password-not-used-by-any-account',
    );
    expect(persistedInput).toEqual({
      displayName: 'Test User',
      email: 'Test.User@EXAMPLE.TEST',
      normalizedEmail: 'test.user@example.test',
      passwordHash: 'encoded-test-password-hash',
    });
    expect(result).toBe(registeredUser);
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
  });
});

describeWithPostgreSql(
  'registration persistence (requires a disposable TEST_DATABASE_URL)',
  () => {
    const suitePrefix = `registration-test-${randomUUID()}`;
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Registration integration client was not initialized');
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

      await cleanupRegisteredUsers(client, suitePrefix);
      await client.close();
    });

    it('atomically creates the user, credential, personal workspace, and owner membership', async () => {
      const activeClient = getClient();
      const repository = new PostgresRegistrationRepository(activeClient);
      const service = new RegistrationService(repository);
      const password = 'integration-test-password-not-used-by-any-account';
      const registeredUser = await service.register({
        displayName: 'Integration User',
        email: `  ${suitePrefix}-Atomic@EXAMPLE.TEST  `,
        password,
      });

      const [credential] = await activeClient.database
        .select()
        .from(passwordCredentials)
        .where(eq(passwordCredentials.userId, registeredUser.id));
      const [persistedUser] = await activeClient.database
        .select({ personalWorkspaceId: users.personalWorkspaceId })
        .from(users)
        .where(eq(users.id, registeredUser.id));
      const [personalWorkspace] = await activeClient.database
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, persistedUser?.personalWorkspaceId ?? ''));
      const [ownerMembership] = await activeClient.database
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.userId, registeredUser.id),
            eq(
              workspaceMembers.workspaceId,
              persistedUser?.personalWorkspaceId ?? '',
            ),
          ),
        );

      expect(registeredUser).toMatchObject({
        displayName: 'Integration User',
        email: `${suitePrefix}-Atomic@EXAMPLE.TEST`,
        normalizedEmail: `${suitePrefix}-atomic@example.test`,
      });
      expect(credential?.passwordHash).not.toBe(password);
      await expect(
        verifyPassword(password, credential?.passwordHash ?? ''),
      ).resolves.toBe(true);
      expect(personalWorkspace).toMatchObject({
        id: persistedUser?.personalWorkspaceId,
        name: 'Personal Workspace',
      });
      expect(ownerMembership).toMatchObject({
        role: 'owner',
        userId: registeredUser.id,
        workspaceId: persistedUser?.personalWorkspaceId,
      });
    });

    it('maps authoritative normalized-email conflicts to a safe error', async () => {
      const activeClient = getClient();
      const service = new RegistrationService(
        new PostgresRegistrationRepository(activeClient),
      );
      const email = `${suitePrefix}-duplicate@example.test`;

      await service.register({
        email,
        password: 'first-integration-test-password',
      });

      await expect(
        service.register({
          email: `  ${email.toUpperCase()}  `,
          password: 'second-integration-test-password',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'REGISTRATION_EMAIL_CONFLICT',
          message: 'An account with this email already exists',
          name: RegistrationEmailConflictError.name,
        }),
      );

      const [userCount] = await activeClient.database
        .select({ value: count() })
        .from(users)
        .where(eq(users.normalizedEmail, email));
      const [credentialCount] = await activeClient.database
        .select({ value: count() })
        .from(passwordCredentials)
        .innerJoin(users, eq(passwordCredentials.userId, users.id))
        .where(eq(users.normalizedEmail, email));
      const [workspaceCount] = await activeClient.database
        .select({ value: count() })
        .from(workspaces)
        .innerJoin(users, eq(users.personalWorkspaceId, workspaces.id))
        .where(eq(users.normalizedEmail, email));
      const [membershipCount] = await activeClient.database
        .select({ value: count() })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .where(
          and(
            eq(users.normalizedEmail, email),
            eq(workspaceMembers.workspaceId, users.personalWorkspaceId),
          ),
        );

      expect(userCount?.value).toBe(1);
      expect(credentialCount?.value).toBe(1);
      expect(workspaceCount?.value).toBe(1);
      expect(membershipCount?.value).toBe(1);
    });

    it('rolls back the user insert when credential persistence fails', async () => {
      const activeClient = getClient();
      const email = `${suitePrefix}-rollback@example.test`;
      const service = new RegistrationService(
        new PostgresRegistrationRepository(activeClient),
        () => Promise.resolve('   '),
      );
      const [workspaceCountBefore] = await activeClient.database
        .select({ value: count() })
        .from(workspaces);
      const [membershipCountBefore] = await activeClient.database
        .select({ value: count() })
        .from(workspaceMembers);

      await expect(
        service.register({
          email,
          password: 'rollback-integration-test-password',
        }),
      ).rejects.toBeInstanceOf(RegistrationPersistenceError);

      const [userCount] = await activeClient.database
        .select({ value: count() })
        .from(users)
        .where(eq(users.normalizedEmail, email));
      const [workspaceCountAfter] = await activeClient.database
        .select({ value: count() })
        .from(workspaces);
      const [membershipCountAfter] = await activeClient.database
        .select({ value: count() })
        .from(workspaceMembers);

      expect(userCount?.value).toBe(0);
      expect(workspaceCountAfter?.value).toBe(workspaceCountBefore?.value);
      expect(membershipCountAfter?.value).toBe(membershipCountBefore?.value);
    });
  },
);
