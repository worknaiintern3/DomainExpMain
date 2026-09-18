import { describe, expect, it, vi } from 'vitest';

import { AccountService, LastLoginMethodError, PasswordAlreadySetError } from '../src/auth/account';
import type { PasswordCredentialStore } from '../src/auth/account';
import { GOOGLE_PROVIDER, type OAuthIdentityForUser, type OAuthIdentityStore } from '../src/auth/oauth';

function fakePasswordStore(overrides: Partial<PasswordCredentialStore> = {}): PasswordCredentialStore {
  return {
    create: () => Promise.resolve(),
    exists: () => Promise.resolve(false),
    ...overrides,
  };
}

function fakeIdentityStore(overrides: Partial<OAuthIdentityStore> = {}): OAuthIdentityStore {
  return {
    attachIdentityToExistingUser: () => Promise.reject(new Error('unexpected call')),
    createIdentityWithNewUser: () => Promise.reject(new Error('unexpected call')),
    deleteIdentityForUser: () => Promise.resolve(true),
    findByProviderSubject: () => Promise.resolve(undefined),
    findIdentityForUser: () => Promise.resolve(undefined),
    findUserByNormalizedEmail: () => Promise.resolve(undefined),
    touchProviderEmail: () => Promise.resolve(),
    ...overrides,
  };
}

describe('AccountService.getLoginMethods', () => {
  it('password only', async () => {
    const service = new AccountService(
      fakePasswordStore({ exists: () => Promise.resolve(true) }),
      fakeIdentityStore({ findIdentityForUser: () => Promise.resolve(undefined) }),
    );

    await expect(service.getLoginMethods('user-1')).resolves.toEqual({
      canUnlinkGoogle: false,
      google: { connected: false, email: null },
      password: { enabled: true },
    });
  });

  it('google only', async () => {
    const identity: OAuthIdentityForUser = { providerEmail: 'user@example.test' };
    const service = new AccountService(
      fakePasswordStore({ exists: () => Promise.resolve(false) }),
      fakeIdentityStore({ findIdentityForUser: () => Promise.resolve(identity) }),
    );

    await expect(service.getLoginMethods('user-1')).resolves.toEqual({
      canUnlinkGoogle: false,
      google: { connected: true, email: 'user@example.test' },
      password: { enabled: false },
    });
  });

  it('both -- and only then is unlink allowed', async () => {
    const identity: OAuthIdentityForUser = { providerEmail: 'user@example.test' };
    const service = new AccountService(
      fakePasswordStore({ exists: () => Promise.resolve(true) }),
      fakeIdentityStore({ findIdentityForUser: () => Promise.resolve(identity) }),
    );

    await expect(service.getLoginMethods('user-1')).resolves.toEqual({
      canUnlinkGoogle: true,
      google: { connected: true, email: 'user@example.test' },
      password: { enabled: true },
    });
  });
});

describe('AccountService.addPassword', () => {
  it('a Google-only user succeeds', async () => {
    const create = vi.fn(() => Promise.resolve());
    const service = new AccountService(
      fakePasswordStore({ create, exists: () => Promise.resolve(false) }),
      fakeIdentityStore(),
    );

    await service.addPassword('user-1', 'a-brand-new-password');

    expect(create).toHaveBeenCalledWith('user-1', expect.any(String));
  });

  it('rejects with a typed conflict when a password already exists, without overwriting it', async () => {
    const create = vi.fn(() => Promise.resolve());
    const service = new AccountService(
      fakePasswordStore({ create, exists: () => Promise.resolve(true) }),
      fakeIdentityStore(),
    );

    await expect(service.addPassword('user-1', 'a-brand-new-password')).rejects.toBeInstanceOf(
      PasswordAlreadySetError,
    );
    expect(create).not.toHaveBeenCalled();
  });
});

describe('AccountService.unlinkGoogle', () => {
  it('blocks removing the last login method (Google-only)', async () => {
    const deleteIdentityForUser = vi.fn(() => Promise.resolve(true));
    const service = new AccountService(
      fakePasswordStore({ exists: () => Promise.resolve(false) }),
      fakeIdentityStore({ deleteIdentityForUser }),
    );

    await expect(service.unlinkGoogle('user-1')).rejects.toBeInstanceOf(LastLoginMethodError);
    expect(deleteIdentityForUser).not.toHaveBeenCalled();
  });

  it('succeeds when a password credential also exists, removing only the identity', async () => {
    const deleteIdentityForUser = vi.fn(() => Promise.resolve(true));
    const service = new AccountService(
      fakePasswordStore({ exists: () => Promise.resolve(true) }),
      fakeIdentityStore({ deleteIdentityForUser }),
    );

    await service.unlinkGoogle('user-1');

    expect(deleteIdentityForUser).toHaveBeenCalledWith('user-1', GOOGLE_PROVIDER);
  });
});
