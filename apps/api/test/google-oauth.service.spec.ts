import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  GOOGLE_PROVIDER,
  GoogleAccountAlreadyConnectedError,
  GoogleAccountEmailConflictError,
  GoogleAuthenticationFailedError,
  GoogleIdentityAlreadyLinkedError,
  GoogleIdTokenVerifier,
  GoogleOAuthService,
  GoogleTokenExchangeClient,
  type AccessTokenIssuer,
  type GoogleOAuthConfiguration,
  type OAuthIdentityStore,
  type OAuthSessionIssuer,
  type OAuthTransactionStore,
} from '../src/auth/oauth';

const config: GoogleOAuthConfiguration = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:5173/auth/google/callback',
  transactionTtlSeconds: 600,
};

const now = new Date('2033-05-18T03:33:20.000Z');
const testUser = {
  createdAt: now,
  displayName: null as string | null,
  email: 'existing-google-user@example.test',
  id: randomUUID(),
  normalizedEmail: 'existing-google-user@example.test',
  updatedAt: now,
};

function fakeTransactionStore(
  overrides: Partial<OAuthTransactionStore> = {},
): OAuthTransactionStore {
  return {
    consumeTransaction: () =>
      Promise.resolve({
        codeVerifier: 'stored-verifier',
        flow: 'login',
        linkingUserId: null,
        nonce: 'stored-nonce',
      }),
    createTransaction: () => Promise.resolve({ state: 'generated-state' }),
    ...overrides,
  };
}

function fakeIdentityStore(
  overrides: Partial<OAuthIdentityStore> = {},
): OAuthIdentityStore {
  return {
    attachIdentityToExistingUser: () =>
      Promise.reject(new Error('unexpected attachIdentityToExistingUser call')),
    createIdentityWithNewUser: () =>
      Promise.reject(new Error('unexpected createIdentityWithNewUser call')),
    deleteIdentityForUser: () =>
      Promise.reject(new Error('unexpected deleteIdentityForUser call')),
    findByProviderSubject: () => Promise.resolve(undefined),
    findIdentityForUser: () => Promise.resolve(undefined),
    findUserByNormalizedEmail: () => Promise.resolve(undefined),
    touchProviderEmail: () => Promise.resolve(),
    ...overrides,
  };
}

function fakeTokenExchangeClient(idToken = 'raw-id-token'): GoogleTokenExchangeClient {
  return {
    exchangeAuthorizationCode: vi.fn(() => Promise.resolve(idToken)),
  } as unknown as GoogleTokenExchangeClient;
}

function fakeIdTokenVerifier(
  claims: {
    email: string;
    emailVerified: boolean;
    name?: string | null;
    subject: string;
  },
): GoogleIdTokenVerifier {
  return {
    verify: vi.fn(() =>
      Promise.resolve({
        email: claims.email,
        emailVerified: claims.emailVerified,
        name: claims.name ?? null,
        subject: claims.subject,
      })),
  } as unknown as GoogleIdTokenVerifier;
}

function fakeSessionIssuer(): OAuthSessionIssuer {
  return {
    createSession: vi.fn((input: { expiresAt: Date }) =>
      Promise.resolve({ expiresAt: input.expiresAt, id: randomUUID() })),
  };
}

function fakeAccessTokenIssuer(): AccessTokenIssuer {
  return {
    issue: vi.fn(() => ({ expiresAt: now, token: 'issued-access-token' })),
  };
}

function buildService(options: {
  transactionStore?: OAuthTransactionStore;
  identityStore?: OAuthIdentityStore;
  tokenExchangeClient?: GoogleTokenExchangeClient;
  idTokenVerifier?: GoogleIdTokenVerifier;
  sessionIssuer?: OAuthSessionIssuer;
  accessTokenIssuer?: AccessTokenIssuer;
} = {}): GoogleOAuthService {
  return new GoogleOAuthService(
    config,
    options.transactionStore ?? fakeTransactionStore(),
    options.identityStore ?? fakeIdentityStore(),
    options.tokenExchangeClient ?? fakeTokenExchangeClient(),
    options.idTokenVerifier ??
      fakeIdTokenVerifier({ email: 'new-user@example.test', emailVerified: true, subject: 'google-subject-1' }),
    options.sessionIssuer ?? fakeSessionIssuer(),
    options.accessTokenIssuer ?? fakeAccessTokenIssuer(),
    () => 'generated-refresh-token',
    () => 'hashed-refresh-token',
    () => now.getTime(),
  );
}

describe('GoogleOAuthService.startLogin', () => {
  it('generates state/nonce/PKCE, persists the transaction, and returns a URL built only from static config', async () => {
    let persistedState: string | undefined;
    let persistedProvider: string | undefined;
    const transactionStore = fakeTransactionStore({
      createTransaction: (input) => {
        persistedState = input.state;
        persistedProvider = input.provider;
        return Promise.resolve({ state: input.state });
      },
    });

    const result = await buildService({ transactionStore }).startLogin();

    expect(persistedProvider).toBe(GOOGLE_PROVIDER);
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe(config.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe(persistedState);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    // Never requests offline access or a Google refresh token (locked decision 6/9).
    expect(url.searchParams.has('access_type')).toBe(false);
    expect(url.searchParams.has('prompt')).toBe(false);
  });
});

describe('GoogleOAuthService.completeCallback — account decision tree', () => {
  it('Case A: an existing (google, sub) identity logs in and only refreshes provider-email metadata', async () => {
    const touchProviderEmail = vi.fn(() => Promise.resolve());
    const identityStore = fakeIdentityStore({
      findByProviderSubject: () => Promise.resolve({ user: testUser }),
      touchProviderEmail,
    });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'updated-email@example.test',
      emailVerified: true,
      subject: 'google-subject-existing',
    });

    const result = await buildService({ identityStore, idTokenVerifier })
      .completeCallback('auth-code', 'state-value');

    expect(result.user).toEqual(testUser);
    expect(touchProviderEmail).toHaveBeenCalledWith({
      provider: GOOGLE_PROVIDER,
      providerEmail: 'updated-email@example.test',
      providerEmailVerified: true,
      providerSubject: 'google-subject-existing',
    });
    expect(result.accessToken).toBe('issued-access-token');
    expect(result.refreshToken).toBe('generated-refresh-token');
  });

  it('Case B: no identity yet, but the email already belongs to an existing account -> typed conflict, no writes', async () => {
    const createIdentityWithNewUser = vi.fn();
    const identityStore = fakeIdentityStore({
      createIdentityWithNewUser,
      findUserByNormalizedEmail: () => Promise.resolve({ id: testUser.id }),
    });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'collides@example.test',
      emailVerified: true,
      subject: 'google-subject-new',
    });

    await expect(
      buildService({ identityStore, idTokenVerifier }).completeCallback('auth-code', 'state-value'),
    ).rejects.toBeInstanceOf(GoogleAccountEmailConflictError);
    expect(createIdentityWithNewUser).not.toHaveBeenCalled();
  });

  it('Case C: no identity, no email collision, verified email -> creates a new user via one atomic call', async () => {
    const createIdentityWithNewUser = vi.fn(() => Promise.resolve({ user: testUser }));
    const identityStore = fakeIdentityStore({ createIdentityWithNewUser });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'Brand.New@Example.TEST',
      emailVerified: true,
      name: 'Brand New',
      subject: 'google-subject-brand-new',
    });

    const result = await buildService({ identityStore, idTokenVerifier })
      .completeCallback('auth-code', 'state-value');

    expect(createIdentityWithNewUser).toHaveBeenCalledWith({
      displayName: 'Brand New',
      email: 'Brand.New@Example.TEST',
      normalizedEmail: 'brand.new@example.test',
      provider: GOOGLE_PROVIDER,
      providerEmail: 'Brand.New@Example.TEST',
      providerEmailVerified: true,
      providerSubject: 'google-subject-brand-new',
    });
    expect(result.user).toEqual(testUser);
  });

  it('Case C, no name claim: omits displayName entirely rather than inventing one', async () => {
    const createIdentityWithNewUser = vi.fn(
      (_input: Parameters<OAuthIdentityStore['createIdentityWithNewUser']>[0]) =>
        Promise.resolve({ user: testUser }),
    );
    const identityStore = fakeIdentityStore({ createIdentityWithNewUser });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'no-name@example.test',
      emailVerified: true,
      subject: 'google-subject-no-name',
    });

    await buildService({ identityStore, idTokenVerifier }).completeCallback('auth-code', 'state-value');

    const call = createIdentityWithNewUser.mock.calls[0];
    expect(call).toBeDefined();
    expect(call?.[0]).not.toHaveProperty('displayName');
  });

  it('Case C guard: an unverified email on a brand-new identity fails closed with the generic error, never creating a user', async () => {
    const createIdentityWithNewUser = vi.fn();
    const identityStore = fakeIdentityStore({ createIdentityWithNewUser });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'unverified@example.test',
      emailVerified: false,
      subject: 'google-subject-unverified',
    });

    await expect(
      buildService({ identityStore, idTokenVerifier }).completeCallback('auth-code', 'state-value'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
    expect(createIdentityWithNewUser).not.toHaveBeenCalled();
  });

  it('Case D: a provider-subject race surfaces as the same generic failure, never account details', async () => {
    const identityStore = fakeIdentityStore({
      createIdentityWithNewUser: () => Promise.reject(new GoogleAuthenticationFailedError()),
    });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'race@example.test',
      emailVerified: true,
      subject: 'google-subject-race',
    });

    await expect(
      buildService({ identityStore, idTokenVerifier }).completeCallback('auth-code', 'state-value'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
  });

  it('unknown/expired/replayed state all collapse to the same generic failure before any Google call', async () => {
    const exchangeAuthorizationCode = vi.fn();
    const transactionStore = fakeTransactionStore({
      consumeTransaction: () => Promise.resolve(undefined),
    });
    const tokenExchangeClient = {
      exchangeAuthorizationCode,
    } as unknown as GoogleTokenExchangeClient;

    await expect(
      buildService({ transactionStore, tokenExchangeClient }).completeCallback('auth-code', 'unknown-state'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it('a failed token exchange never reaches identity resolution', async () => {
    const findByProviderSubject = vi.fn();
    const identityStore = fakeIdentityStore({ findByProviderSubject });
    const tokenExchangeClient = {
      exchangeAuthorizationCode: () => Promise.reject(new GoogleAuthenticationFailedError()),
    } as unknown as GoogleTokenExchangeClient;

    await expect(
      buildService({ identityStore, tokenExchangeClient }).completeCallback('auth-code', 'state-value'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
    expect(findByProviderSubject).not.toHaveBeenCalled();
  });

  it('a failed ID-token verification never reaches identity resolution', async () => {
    const findByProviderSubject = vi.fn();
    const identityStore = fakeIdentityStore({ findByProviderSubject });
    const idTokenVerifier = {
      verify: () => Promise.reject(new GoogleAuthenticationFailedError()),
    } as unknown as GoogleIdTokenVerifier;

    await expect(
      buildService({ identityStore, idTokenVerifier }).completeCallback('auth-code', 'state-value'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
    expect(findByProviderSubject).not.toHaveBeenCalled();
  });

  it('passes the transaction-stored code_verifier and nonce through, never a caller-supplied one', async () => {
    const transactionStore = fakeTransactionStore({
      consumeTransaction: () =>
        Promise.resolve({
          codeVerifier: 'the-real-stored-verifier',
          flow: 'login',
          linkingUserId: null,
          nonce: 'the-real-stored-nonce',
        }),
    });
    const exchangeAuthorizationCode = vi.fn(() => Promise.resolve('raw-id-token'));
    const tokenExchangeClient = { exchangeAuthorizationCode } as unknown as GoogleTokenExchangeClient;
    const verify = vi.fn(() =>
      Promise.resolve({ email: 'x@example.test', emailVerified: true, name: null, subject: 'sub-1' }));
    const idTokenVerifier = { verify } as unknown as GoogleIdTokenVerifier;
    const identityStore = fakeIdentityStore({
      findByProviderSubject: () => Promise.resolve({ user: testUser }),
    });

    await buildService({ identityStore, transactionStore, tokenExchangeClient, idTokenVerifier })
      .completeCallback('auth-code', 'state-value');

    expect(exchangeAuthorizationCode).toHaveBeenCalledWith(config, 'auth-code', 'the-real-stored-verifier');
    expect(verify).toHaveBeenCalledWith('raw-id-token', config.clientId, 'the-real-stored-nonce');
  });

  it('never returns or logs the raw ID token, code, or code_verifier', async () => {
    const identityStore = fakeIdentityStore({
      findByProviderSubject: () => Promise.resolve({ user: testUser }),
    });
    const result = await buildService({ identityStore }).completeCallback('sensitive-auth-code', 'state-value');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('sensitive-auth-code');
    expect(serialized).not.toContain('raw-id-token');
    expect(serialized).not.toContain('stored-verifier');
  });

  it('rejects a `link` transaction submitted to the public login callback', async () => {
    const transactionStore = fakeTransactionStore({
      consumeTransaction: () =>
        Promise.resolve({
          codeVerifier: 'stored-verifier',
          flow: 'link',
          linkingUserId: testUser.id,
          nonce: 'stored-nonce',
        }),
    });

    await expect(
      buildService({ transactionStore }).completeCallback('auth-code', 'link-state'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
  });
});

describe('GoogleOAuthService.startLink', () => {
  it('persists a `link` transaction carrying the authenticated caller as linkingUserId', async () => {
    let persistedInput: Parameters<OAuthTransactionStore['createTransaction']>[0] | undefined;
    const transactionStore = fakeTransactionStore({
      createTransaction: (input) => {
        persistedInput = input;
        return Promise.resolve({ state: input.state });
      },
    });

    const result = await buildService({ transactionStore }).startLink(testUser.id);

    expect(persistedInput).toMatchObject({
      flow: 'link',
      linkingUserId: testUser.id,
      provider: GOOGLE_PROVIDER,
    });
    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get('state')).toBe(persistedInput?.state);
  });
});

describe('GoogleOAuthService.completeLinkCallback', () => {
  function fakeLinkTransactionStore(
    userId: string,
    overrides: Partial<OAuthTransactionStore> = {},
  ): OAuthTransactionStore {
    return fakeTransactionStore({
      consumeTransaction: () =>
        Promise.resolve({
          codeVerifier: 'stored-verifier',
          flow: 'link',
          linkingUserId: userId,
          nonce: 'stored-nonce',
        }),
      ...overrides,
    });
  }

  it('valid same authenticated user: attaches the identity to the existing user, creates nothing else', async () => {
    const attachIdentityToExistingUser = vi.fn(() => Promise.resolve());
    const identityStore = fakeIdentityStore({ attachIdentityToExistingUser });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'newly-linked@example.test',
      emailVerified: true,
      subject: 'google-subject-to-link',
    });
    const transactionStore = fakeLinkTransactionStore(testUser.id);

    const result = await buildService({ identityStore, idTokenVerifier, transactionStore })
      .completeLinkCallback(testUser.id, 'auth-code', 'link-state');

    expect(attachIdentityToExistingUser).toHaveBeenCalledWith({
      provider: GOOGLE_PROVIDER,
      providerEmail: 'newly-linked@example.test',
      providerEmailVerified: true,
      providerSubject: 'google-subject-to-link',
      userId: testUser.id,
    });
    expect(result).toEqual({ alreadyLinked: false, providerEmail: 'newly-linked@example.test' });
  });

  it('wrong authenticated user (linkingUserId mismatch) is rejected before any Google call', async () => {
    const exchangeAuthorizationCode = vi.fn();
    const tokenExchangeClient = { exchangeAuthorizationCode } as unknown as GoogleTokenExchangeClient;
    const transactionStore = fakeLinkTransactionStore('a-different-user-id');

    await expect(
      buildService({ tokenExchangeClient, transactionStore })
        .completeLinkCallback(testUser.id, 'auth-code', 'link-state'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it('a `login` state sent to the link callback is rejected', async () => {
    const transactionStore = fakeTransactionStore({
      consumeTransaction: () =>
        Promise.resolve({
          codeVerifier: 'stored-verifier',
          flow: 'login',
          linkingUserId: null,
          nonce: 'stored-nonce',
        }),
    });

    await expect(
      buildService({ transactionStore }).completeLinkCallback(testUser.id, 'auth-code', 'login-state'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
  });

  it('replay/expired/unknown state collapses to the same generic failure', async () => {
    const transactionStore = fakeTransactionStore({
      consumeTransaction: () => Promise.resolve(undefined),
    });

    await expect(
      buildService({ transactionStore }).completeLinkCallback(testUser.id, 'auth-code', 'gone-state'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
  });

  it('nonce mismatch (surfaced by the ID-token verifier) is rejected', async () => {
    const idTokenVerifier = {
      verify: () => Promise.reject(new GoogleAuthenticationFailedError()),
    } as unknown as GoogleIdTokenVerifier;
    const transactionStore = fakeLinkTransactionStore(testUser.id);

    await expect(
      buildService({ idTokenVerifier, transactionStore })
        .completeLinkCallback(testUser.id, 'auth-code', 'link-state'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationFailedError);
  });

  it('already linked to the SAME user: idempotent success, only refreshes metadata, never re-inserts', async () => {
    const attachIdentityToExistingUser = vi.fn();
    const touchProviderEmail = vi.fn(() => Promise.resolve());
    const identityStore = fakeIdentityStore({
      attachIdentityToExistingUser,
      findByProviderSubject: () => Promise.resolve({ user: testUser }),
      touchProviderEmail,
    });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'already-linked@example.test',
      emailVerified: true,
      subject: 'google-subject-already-linked',
    });
    const transactionStore = fakeLinkTransactionStore(testUser.id);

    const result = await buildService({ identityStore, idTokenVerifier, transactionStore })
      .completeLinkCallback(testUser.id, 'auth-code', 'link-state');

    expect(attachIdentityToExistingUser).not.toHaveBeenCalled();
    expect(touchProviderEmail).toHaveBeenCalled();
    expect(result).toEqual({ alreadyLinked: true, providerEmail: 'already-linked@example.test' });
  });

  it('the Google identity already belongs to a DIFFERENT DomainPulse user: rejected, never re-pointed', async () => {
    const identityStore = fakeIdentityStore({
      findByProviderSubject: () => Promise.resolve({ user: testUser }),
    });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'someone-elses-google@example.test',
      emailVerified: true,
      subject: 'google-subject-owned-by-another',
    });
    const transactionStore = fakeLinkTransactionStore('the-caller-not-testUser');

    await expect(
      buildService({ identityStore, idTokenVerifier, transactionStore })
        .completeLinkCallback('the-caller-not-testUser', 'auth-code', 'link-state'),
    ).rejects.toBeInstanceOf(GoogleIdentityAlreadyLinkedError);
  });

  it('the caller already has a DIFFERENT Google identity connected: DB constraint rejects, requires unlink first', async () => {
    const identityStore = fakeIdentityStore({
      attachIdentityToExistingUser: () =>
        Promise.reject(new GoogleAccountAlreadyConnectedError()),
    });
    const transactionStore = fakeLinkTransactionStore(testUser.id);

    await expect(
      buildService({ identityStore, transactionStore })
        .completeLinkCallback(testUser.id, 'auth-code', 'link-state'),
    ).rejects.toBeInstanceOf(GoogleAccountAlreadyConnectedError);
  });

  it('never requires or checks email equality with the DomainPulse account being linked to', async () => {
    const attachIdentityToExistingUser = vi.fn(() => Promise.resolve());
    const identityStore = fakeIdentityStore({ attachIdentityToExistingUser });
    const idTokenVerifier = fakeIdTokenVerifier({
      email: 'totally-different-email@example.test',
      emailVerified: true,
      subject: 'google-subject-different-email',
    });
    const transactionStore = fakeLinkTransactionStore(testUser.id);

    // testUser.email is 'existing-google-user@example.test' -- deliberately
    // different from the Google claim's email above.
    await expect(
      buildService({ identityStore, idTokenVerifier, transactionStore })
        .completeLinkCallback(testUser.id, 'auth-code', 'link-state'),
    ).resolves.toMatchObject({ alreadyLinked: false });
    expect(attachIdentityToExistingUser).toHaveBeenCalled();
  });
});
