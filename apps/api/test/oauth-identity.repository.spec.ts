import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  oauthIdentities,
  passwordCredentials,
  users,
  workspaceMembers,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  GoogleAccountEmailConflictError,
  GoogleAuthenticationFailedError,
  PostgresOAuthIdentityRepository,
} from '../src/auth/oauth';
import { PostgresRegistrationRepository, RegistrationService } from '../src/auth/registration';
import {
  cleanupRegisteredUsers,
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;
const GOOGLE = 'google';

describeWithPostgreSql(
  'PostgresOAuthIdentityRepository (requires a disposable TEST_DATABASE_URL)',
  () => {
    const suitePrefix = `oauth-identity-test-${randomUUID()}`;
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('OAuth identity integration client was not initialized');
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

    it('atomically creates the user, personal workspace, owner membership, and oauth identity -- no password_credentials row', async () => {
      const activeClient = getClient();
      const repository = new PostgresOAuthIdentityRepository(activeClient);
      const email = `${suitePrefix}-brand-new@example.test`;

      const { user } = await repository.createIdentityWithNewUser({
        displayName: 'Brand New Googler',
        email,
        normalizedEmail: email.toLowerCase(),
        provider: GOOGLE,
        providerEmail: email,
        providerEmailVerified: true,
        providerSubject: `${suitePrefix}-subject-brand-new`,
      });

      const [persistedUser] = await activeClient.database
        .select({ personalWorkspaceId: users.personalWorkspaceId })
        .from(users)
        .where(eq(users.id, user.id));
      const [personalWorkspace] = await activeClient.database
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, persistedUser?.personalWorkspaceId ?? ''));
      const [ownerMembership] = await activeClient.database
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.userId, user.id),
            eq(workspaceMembers.workspaceId, persistedUser?.personalWorkspaceId ?? ''),
          ),
        );
      const [identity] = await activeClient.database
        .select()
        .from(oauthIdentities)
        .where(eq(oauthIdentities.userId, user.id));
      const [credential] = await activeClient.database
        .select()
        .from(passwordCredentials)
        .where(eq(passwordCredentials.userId, user.id));

      expect(user).toMatchObject({ displayName: 'Brand New Googler', email });
      expect(personalWorkspace).toMatchObject({ name: 'Personal Workspace' });
      expect(ownerMembership).toMatchObject({ role: 'owner' });
      expect(identity).toMatchObject({
        provider: GOOGLE,
        providerEmail: email,
        providerEmailVerified: true,
        providerSubject: `${suitePrefix}-subject-brand-new`,
      });
      expect(credential).toBeUndefined();
    });

    it('finds an existing identity by (provider, subject) -- repeat login resolves the same user', async () => {
      const activeClient = getClient();
      const repository = new PostgresOAuthIdentityRepository(activeClient);
      const email = `${suitePrefix}-repeat@example.test`;
      const subject = `${suitePrefix}-subject-repeat`;
      const { user: created } = await repository.createIdentityWithNewUser({
        email,
        normalizedEmail: email.toLowerCase(),
        provider: GOOGLE,
        providerEmail: email,
        providerEmailVerified: true,
        providerSubject: subject,
      });

      const found = await repository.findByProviderSubject(GOOGLE, subject);

      expect(found?.user.id).toBe(created.id);
    });

    it('touchProviderEmail updates last-observed metadata without remapping the identity', async () => {
      const activeClient = getClient();
      const repository = new PostgresOAuthIdentityRepository(activeClient);
      const originalEmail = `${suitePrefix}-changing@example.test`;
      const subject = `${suitePrefix}-subject-changing`;
      const { user: created } = await repository.createIdentityWithNewUser({
        email: originalEmail,
        normalizedEmail: originalEmail.toLowerCase(),
        provider: GOOGLE,
        providerEmail: originalEmail,
        providerEmailVerified: true,
        providerSubject: subject,
      });

      await repository.touchProviderEmail({
        provider: GOOGLE,
        providerEmail: `${suitePrefix}-new-email@example.test`,
        providerEmailVerified: false,
        providerSubject: subject,
      });

      const found = await repository.findByProviderSubject(GOOGLE, subject);
      const [identity] = await activeClient.database
        .select()
        .from(oauthIdentities)
        .where(eq(oauthIdentities.userId, created.id));

      // The identity still resolves to the SAME DomainPulse user -- an email
      // change at Google never detaches or remaps `sub`'s resolved account.
      expect(found?.user.id).toBe(created.id);
      expect(identity).toMatchObject({
        providerEmail: `${suitePrefix}-new-email@example.test`,
        providerEmailVerified: false,
      });
      // The user's own `users.email` (set at creation time) is untouched by a later provider-email change.
      expect(found?.user.email).toBe(originalEmail);
    });

    it('maps a same-email conflict with an existing password account to the typed conflict error, creating nothing', async () => {
      const activeClient = getClient();
      const email = `${suitePrefix}-password-first@example.test`;
      const registration = new RegistrationService(new PostgresRegistrationRepository(activeClient));
      await registration.register({ email, password: 'oauth-integration-test-password' });

      const repository = new PostgresOAuthIdentityRepository(activeClient);
      const emailOwner = await repository.findUserByNormalizedEmail(email.toLowerCase());
      expect(emailOwner).toBeDefined();

      // The repository itself only raises this from the DB constraint if the
      // service layer's own pre-check (Case B) is bypassed -- exercised
      // directly here to prove the constraint is the true authority.
      await expect(
        repository.createIdentityWithNewUser({
          email,
          normalizedEmail: email.toLowerCase(),
          provider: GOOGLE,
          providerEmail: email,
          providerEmailVerified: true,
          providerSubject: `${suitePrefix}-subject-conflict`,
        }),
      ).rejects.toBeInstanceOf(GoogleAccountEmailConflictError);

      const identities = await activeClient.database
        .select()
        .from(oauthIdentities)
        .where(eq(oauthIdentities.providerSubject, `${suitePrefix}-subject-conflict`));
      expect(identities).toHaveLength(0);
    });

    it('a provider-subject race is rejected by the DB unique constraint, not silently duplicated', async () => {
      const activeClient = getClient();
      const repository = new PostgresOAuthIdentityRepository(activeClient);
      const subject = `${suitePrefix}-subject-race`;
      await repository.createIdentityWithNewUser({
        email: `${suitePrefix}-race-a@example.test`,
        normalizedEmail: `${suitePrefix}-race-a@example.test`,
        provider: GOOGLE,
        providerEmail: `${suitePrefix}-race-a@example.test`,
        providerEmailVerified: true,
        providerSubject: subject,
      });

      await expect(
        repository.createIdentityWithNewUser({
          email: `${suitePrefix}-race-b@example.test`,
          normalizedEmail: `${suitePrefix}-race-b@example.test`,
          provider: GOOGLE,
          providerEmail: `${suitePrefix}-race-b@example.test`,
          providerEmailVerified: true,
          providerSubject: subject,
        }),
      ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);

      const identities = await activeClient.database
        .select()
        .from(oauthIdentities)
        .where(eq(oauthIdentities.providerSubject, subject));
      expect(identities).toHaveLength(1);
    });

    it('workspace hydration: the new Google user\'s personal workspace membership matches the password-registration invariant exactly', async () => {
      const activeClient = getClient();
      const repository = new PostgresOAuthIdentityRepository(activeClient);
      const email = `${suitePrefix}-workspace@example.test`;
      const { user } = await repository.createIdentityWithNewUser({
        email,
        normalizedEmail: email.toLowerCase(),
        provider: GOOGLE,
        providerEmail: email,
        providerEmailVerified: true,
        providerSubject: `${suitePrefix}-subject-workspace`,
      });

      const [persistedUser] = await activeClient.database
        .select({ personalWorkspaceId: users.personalWorkspaceId })
        .from(users)
        .where(eq(users.id, user.id));
      const memberships = await activeClient.database
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, user.id));

      expect(persistedUser?.personalWorkspaceId).toBeTruthy();
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({
        role: 'owner',
        workspaceId: persistedUser?.personalWorkspaceId,
      });
    });
  },
);
