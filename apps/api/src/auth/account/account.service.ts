import { hashPassword } from '../crypto';
import { GOOGLE_PROVIDER } from '../oauth';
import type { OAuthIdentityStore } from '../oauth';
import { LastLoginMethodError, PasswordAlreadySetError } from './account.errors';
import type { LoginMethodsStatus } from './account.types';
import type { PasswordCredentialStore } from './password-credential.types';

export class AccountService {
  constructor(
    private readonly passwordCredentialStore: PasswordCredentialStore,
    private readonly identityStore: OAuthIdentityStore,
    private readonly passwordHasher: (password: string) => Promise<string> = hashPassword,
    private readonly database?: any,
  ) {}

  async getLoginMethods(userId: string): Promise<LoginMethodsStatus> {
    const [passwordEnabled, googleIdentity] = await Promise.all([
      this.passwordCredentialStore.exists(userId),
      this.identityStore.findIdentityForUser(userId, GOOGLE_PROVIDER),
    ]);

    return {
      canUnlinkGoogle: Boolean(googleIdentity) && passwordEnabled,
      google: {
        connected: Boolean(googleIdentity),
        email: googleIdentity?.providerEmail ?? null,
      },
      password: { enabled: passwordEnabled },
    };
  }

  /**
   * Google-first user adds a password. Reuses the exact same password
   * policy (enforced by the HTTP-layer Zod schema, identical to
   * registration's) and the exact same hashing primitive registration uses --
   * this is deliberately not a second credential implementation. Once this
   * succeeds, the existing password `LoginService` finds this user through
   * the ordinary `users JOIN password_credentials` lookup; no special
   * "Google-user password login" path is added.
   */
  async addPassword(userId: string, password: string): Promise<void> {
    const alreadyHasPassword = await this.passwordCredentialStore.exists(userId);
    if (alreadyHasPassword) {
      throw new PasswordAlreadySetError();
    }

    const passwordHash = await this.passwordHasher(password);
    await this.passwordCredentialStore.create(userId, passwordHash);
  }

  /**
   * Never allows a user to be left with zero usable sign-in methods. Only
   * removes the `oauth_identities` row -- the user, workspace, memberships,
   * other sessions, and any password credential are all untouched.
   */
  async unlinkGoogle(userId: string): Promise<void> {
    const passwordEnabled = await this.passwordCredentialStore.exists(userId);
    if (!passwordEnabled) {
      throw new LastLoginMethodError();
    }

    await this.identityStore.deleteIdentityForUser(userId, GOOGLE_PROVIDER);
  }

  /**
   * Safely and permanently deletes a user account, all owned workspaces,
   * associated infrastructure records, credentials, and active sessions.
   */
  async deleteAccount(userId: string): Promise<void> {
    const cols = this.database?.collections;
    if (!cols) {
      // Fallback: direct mongoose collections
      const { mongoose } = require('@domainpulse/database');
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not available for account deletion');
      }
      const wsMembers = await db.collection('workspaceMembers').find({ userId }).toArray();
      for (const member of wsMembers) {
        if (member.role === 'owner') {
          const wsId = member.workspaceId;
          await Promise.allSettled([
            db.collection('domains').deleteMany({ workspaceId: wsId }),
            db.collection('servers').deleteMany({ workspaceId: wsId }),
            db.collection('providerAccounts').deleteMany({ workspaceId: wsId }),
            db.collection('emailAccounts').deleteMany({ workspaceId: wsId }),
            db.collection('cloudResources').deleteMany({ workspaceId: wsId }),
            db.collection('projects').deleteMany({ workspaceId: wsId }),
            db.collection('websiteApplications').deleteMany({ workspaceId: wsId }),
            db.collection('inventoryNodes').deleteMany({ workspaceId: wsId }),
            db.collection('inventoryRelationships').deleteMany({ workspaceId: wsId }),
            db.collection('providerConnections').deleteMany({ workspaceId: wsId }),
            db.collection('monitoringTargets').deleteMany({ workspaceId: wsId }),
            db.collection('monitoringRuns').deleteMany({ workspaceId: wsId }),
            db.collection('workspaces').deleteOne({ id: wsId }),
          ]);
        }
      }
      await db.collection('workspaceMembers').deleteMany({ userId });
      await Promise.allSettled([
        db.collection('passwordCredentials').deleteMany({ userId }),
        db.collection('sessions').deleteMany({ userId }),
        db.collection('oauthIdentities').deleteMany({ userId }),
        db.collection('oauthTransactions').deleteMany({ userId }),
        db.collection('googlePlayConnections')?.deleteMany({ userId }),
        db.collection('notificationDeviceTokens')?.deleteMany({ userId }),
        db.collection('notificationPreferences')?.deleteMany({ userId }),
      ]);
      await db.collection('users').deleteOne({ id: userId });
      return;
    }

    const memberships = await cols.workspaceMembers.find({ userId } as any).toArray();
    for (const member of memberships) {
      const wsId = (member as any).workspaceId;
      if ((member as any).role === 'owner') {
        await Promise.allSettled([
          cols.domains.deleteMany({ workspaceId: wsId } as any),
          cols.servers.deleteMany({ workspaceId: wsId } as any),
          cols.providerAccounts.deleteMany({ workspaceId: wsId } as any),
          cols.emailAccounts.deleteMany({ workspaceId: wsId } as any),
          cols.cloudResources.deleteMany({ workspaceId: wsId } as any),
          cols.projects.deleteMany({ workspaceId: wsId } as any),
          cols.websiteApplications.deleteMany({ workspaceId: wsId } as any),
          cols.inventoryNodes.deleteMany({ workspaceId: wsId } as any),
          cols.inventoryRelationships.deleteMany({ workspaceId: wsId } as any),
          cols.providerConnections.deleteMany({ workspaceId: wsId } as any),
          cols.monitoringTargets.deleteMany({ workspaceId: wsId } as any),
          cols.monitoringRuns.deleteMany({ workspaceId: wsId } as any),
          cols.workspaces.deleteOne({ id: wsId } as any),
        ]);
      }
    }

    await cols.workspaceMembers.deleteMany({ userId } as any);
    await Promise.allSettled([
      cols.passwordCredentials.deleteMany({ userId } as any),
      cols.sessions.deleteMany({ userId } as any),
      cols.oauthIdentities.deleteMany({ userId } as any),
      cols.oauthTransactions.deleteMany({ userId } as any),
      (cols as any).googlePlayConnections?.deleteMany({ userId } as any),
      (cols as any).notificationDeviceTokens?.deleteMany({ userId } as any),
      (cols as any).notificationPreferences?.deleteMany({ userId } as any),
    ]);
    await cols.users.deleteOne({ id: userId } as any);
  }
}
