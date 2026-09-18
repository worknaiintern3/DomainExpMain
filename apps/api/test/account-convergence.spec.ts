import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  users,
  workspaceMembers,
  type DatabaseClient,
} from '@domainpulse/database';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AccountService, LastLoginMethodError, PostgresPasswordCredentialRepository } from '../src/auth/account';
import { hashPassword } from '../src/auth/crypto';
import { PostgresLoginRepository } from '../src/auth/login';
import { GOOGLE_PROVIDER, PostgresOAuthIdentityRepository } from '../src/auth/oauth';
import { PostgresRegistrationRepository, RegistrationService } from '../src/auth/registration';
import {
  cleanupRegisteredUsers,
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

/**
 * These are the two "critical acceptance tests" the multi-login product
 * requirement is built around: whichever method a user signs up with, and
 * whichever method they add later, both must resolve to exactly the SAME
 * `users.id`/personal workspace/membership -- never a second account.
 */
describeWithPostgreSql(
  'Password + Google account convergence (requires a disposable TEST_DATABASE_URL)',
  () => {
    const suitePrefix = `account-convergence-${randomUUID()}`;
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Account convergence integration client was not initialized');
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
      if (!client) return;
      await cleanupRegisteredUsers(client, suitePrefix);
      await client.close();
    });

    it('Google-first user: Add Password converges on the exact same user, workspace, and membership', async () => {
      const activeClient = getClient();
      const identityRepository = new PostgresOAuthIdentityRepository(activeClient);
      const passwordRepository = new PostgresPasswordCredentialRepository(activeClient);
      const loginRepository = new PostgresLoginRepository(activeClient);
      const email = `${suitePrefix}-google-first@example.test`;
      const subject = `${suitePrefix}-subject-google-first`;

      // 1. Create a new user via Google.
      const { user: createdUser } = await identityRepository.createIdentityWithNewUser({
        email,
        normalizedEmail: email.toLowerCase(),
        provider: GOOGLE_PROVIDER,
        providerEmail: email,
        providerEmailVerified: true,
        providerSubject: subject,
      });
      const [beforeAddPassword] = await activeClient.database
        .select({ personalWorkspaceId: users.personalWorkspaceId })
        .from(users)
        .where(eq(users.id, createdUser.id));
      const membershipsBefore = await activeClient.database
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, createdUser.id));

      // 2. Google-only: no password credential exists yet.
      expect(await passwordRepository.exists(createdUser.id)).toBe(false);

      // 3. Add Password.
      const passwordHash = await hashPassword('a-perfectly-fine-password');
      await passwordRepository.create(createdUser.id, passwordHash);

      // 4. Password login must resolve the EXACT SAME users.id.
      const credential = await loginRepository.findCredentialByNormalizedEmail(
        email.toLowerCase(),
      );
      expect(credential?.user.id).toBe(createdUser.id);

      // 5. Same personal workspace, same single owner membership -- nothing
      // duplicated.
      const [afterAddPassword] = await activeClient.database
        .select({ personalWorkspaceId: users.personalWorkspaceId })
        .from(users)
        .where(eq(users.id, createdUser.id));
      const membershipsAfter = await activeClient.database
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, createdUser.id));
      expect(afterAddPassword?.personalWorkspaceId).toBe(beforeAddPassword?.personalWorkspaceId);
      expect(membershipsAfter).toHaveLength(membershipsBefore.length);
      expect(membershipsAfter).toHaveLength(1);
      expect(membershipsAfter[0]).toMatchObject({ role: 'owner' });

      // 6. Google login again resolves the same user, unaffected by the
      // added password.
      const resolvedByGoogle = await identityRepository.findByProviderSubject(
        GOOGLE_PROVIDER,
        subject,
      );
      expect(resolvedByGoogle?.user.id).toBe(createdUser.id);
    });

    it('Password-first user: Connect Google converges on the exact same user, workspace, and membership', async () => {
      const activeClient = getClient();
      const registration = new RegistrationService(
        new PostgresRegistrationRepository(activeClient),
      );
      const identityRepository = new PostgresOAuthIdentityRepository(activeClient);
      const loginRepository = new PostgresLoginRepository(activeClient);
      const email = `${suitePrefix}-password-first@example.test`;
      const subject = `${suitePrefix}-subject-password-first`;

      // 1. Register a normal password account.
      const registeredUser = await registration.register({
        email,
        password: 'a-perfectly-fine-password',
      });
      const [beforeLink] = await activeClient.database
        .select({ personalWorkspaceId: users.personalWorkspaceId })
        .from(users)
        .where(eq(users.id, registeredUser.id));
      const membershipsBefore = await activeClient.database
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, registeredUser.id));

      // 2. Password login resolves the registered user.
      const beforeLinkCredential = await loginRepository.findCredentialByNormalizedEmail(
        email.toLowerCase(),
      );
      expect(beforeLinkCredential?.user.id).toBe(registeredUser.id);

      // 3. Connect Google (authenticated linking) -- deliberately a
      // DIFFERENT Google email than the DomainPulse account's, proving email
      // equality is never required for explicit authenticated linking.
      await identityRepository.attachIdentityToExistingUser({
        provider: GOOGLE_PROVIDER,
        providerEmail: `${suitePrefix}-different-google-email@example.test`,
        providerEmailVerified: true,
        providerSubject: subject,
        userId: registeredUser.id,
      });

      // 4. Google login now resolves the EXACT SAME users.id.
      const resolvedByGoogle = await identityRepository.findByProviderSubject(
        GOOGLE_PROVIDER,
        subject,
      );
      expect(resolvedByGoogle?.user.id).toBe(registeredUser.id);

      // 5. Same personal workspace, same single owner membership.
      const [afterLink] = await activeClient.database
        .select({ personalWorkspaceId: users.personalWorkspaceId })
        .from(users)
        .where(eq(users.id, registeredUser.id));
      const membershipsAfter = await activeClient.database
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, registeredUser.id));
      expect(afterLink?.personalWorkspaceId).toBe(beforeLink?.personalWorkspaceId);
      expect(membershipsAfter).toHaveLength(membershipsBefore.length);
      expect(membershipsAfter).toHaveLength(1);
      expect(membershipsAfter[0]).toMatchObject({ role: 'owner' });

      // 6. Password login again resolves the same user afterwards.
      const afterLinkCredential = await loginRepository.findCredentialByNormalizedEmail(
        email.toLowerCase(),
      );
      expect(afterLinkCredential?.user.id).toBe(registeredUser.id);
    });

    it('unlink: Google-only user is blocked (last login method), Google+password user succeeds and both survive appropriately', async () => {
      const activeClient = getClient();
      const identityRepository = new PostgresOAuthIdentityRepository(activeClient);
      const passwordRepository = new PostgresPasswordCredentialRepository(activeClient);
      const accountService = new AccountService(passwordRepository, identityRepository);

      // Google-only user.
      const googleOnlyEmail = `${suitePrefix}-unlink-google-only@example.test`;
      const { user: googleOnlyUser } = await identityRepository.createIdentityWithNewUser({
        email: googleOnlyEmail,
        normalizedEmail: googleOnlyEmail.toLowerCase(),
        provider: GOOGLE_PROVIDER,
        providerEmail: googleOnlyEmail,
        providerEmailVerified: true,
        providerSubject: `${suitePrefix}-subject-unlink-google-only`,
      });

      await expect(accountService.unlinkGoogle(googleOnlyUser.id)).rejects.toBeInstanceOf(
        LastLoginMethodError,
      );
      // Blocked -- the identity must still be there.
      expect(
        await identityRepository.findByProviderSubject(
          GOOGLE_PROVIDER,
          `${suitePrefix}-subject-unlink-google-only`,
        ),
      ).toBeDefined();

      // Google + password user.
      const bothEmail = `${suitePrefix}-unlink-both@example.test`;
      const { user: bothUser } = await identityRepository.createIdentityWithNewUser({
        email: bothEmail,
        normalizedEmail: bothEmail.toLowerCase(),
        provider: GOOGLE_PROVIDER,
        providerEmail: bothEmail,
        providerEmailVerified: true,
        providerSubject: `${suitePrefix}-subject-unlink-both`,
      });
      await passwordRepository.create(bothUser.id, await hashPassword('a-perfectly-fine-password'));

      await accountService.unlinkGoogle(bothUser.id);

      // Google identity is gone...
      expect(
        await identityRepository.findByProviderSubject(
          GOOGLE_PROVIDER,
          `${suitePrefix}-subject-unlink-both`,
        ),
      ).toBeUndefined();
      // ...but the user, and their password credential, are untouched.
      expect(await passwordRepository.exists(bothUser.id)).toBe(true);
      const [stillThere] = await activeClient.database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, bothUser.id));
      expect(stillThere?.id).toBe(bothUser.id);
    });
  },
);
