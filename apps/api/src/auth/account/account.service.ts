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
}
