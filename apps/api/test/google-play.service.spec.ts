import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GooglePlayClientService } from '../src/google-play/google-play-client.service';
import { GooglePlayCryptoService } from '../src/google-play/google-play-crypto.service';
import {
  GooglePlayAccessDeniedError,
  GooglePlayAccessExpiredError,
  GooglePlayDeveloperAccountNotConfiguredError,
  GooglePlayDeveloperAccountNotFoundError,
  GooglePlayNotConnectedError,
  GooglePlayOAuthError,
} from '../src/google-play/google-play.errors';
import { GooglePlayRepository } from '../src/google-play/google-play.repository';
import { GooglePlayService } from '../src/google-play/google-play.service';
import type {
  GooglePlayConnectionEntity,
  GooglePlayOAuthStateEntity,
  GooglePlayUserResource,
} from '../src/google-play/google-play.types';

describe('GooglePlayService', () => {
  let service: GooglePlayService;
  let mockRepository: Partial<GooglePlayRepository>;
  let mockCrypto: GooglePlayCryptoService;
  let mockClient: Partial<GooglePlayClientService>;

  const customerAUserId = randomUUID();
  const customerBUserId = randomUUID();

  beforeEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_PLAY_ENCRYPTION_KEY =
      'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25nLTEyMw==';

    mockCrypto = new GooglePlayCryptoService();

    mockRepository = {
      findConnectionByUserId: vi.fn(),
      saveConnection: vi.fn(),
      updateTokens: vi.fn(),
      updateDeveloperAccountId: vi.fn(),
      deleteConnection: vi.fn(),
      createOAuthState: vi.fn(),
      consumeOAuthState: vi.fn(),
    };

    mockClient = {
      exchangeCodeForTokens: vi.fn(),
      refreshAccessToken: vi.fn(),
      fetchUserInfo: vi.fn(),
      getDeveloperUser: vi.fn(),
      listDeveloperUsers: vi.fn(),
      getAppListing: vi.fn(),
    };

    service = new GooglePlayService(
      mockRepository as GooglePlayRepository,
      mockCrypto,
      mockClient as GooglePlayClientService,
    );
  });

  describe('OAuth start and callback', () => {
    it('starts OAuth flow generating authorization URL and PKCE state', async () => {
      mockRepository.createOAuthState = vi.fn().mockResolvedValue({
        id: randomUUID(),
        userId: customerAUserId,
        state: 'sample-state',
        codeVerifier: 'sample-verifier',
        developerAccountId: 'dev-123',
        redirectUri: 'http://localhost:4000/api/v1/google-play/callback',
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(),
      } as GooglePlayOAuthStateEntity);

      const result = await service.startOAuth({
        userId: customerAUserId,
        developerAccountId: 'dev-123',
      });

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('client_id=test-client-id');
      expect(result.url).toContain('androidpublisher');
      expect(result.url).toContain('code_challenge');
      expect(result.state).toBeDefined();
      expect(mockRepository.createOAuthState).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: customerAUserId,
          developerAccountId: 'dev-123',
        }),
      );
    });

    it('rejects callback when OAuth state is invalid or expired', async () => {
      mockRepository.consumeOAuthState = vi.fn().mockResolvedValue(null);

      await expect(
        service.handleCallback('invalid-code', 'invalid-state'),
      ).rejects.toThrow(GooglePlayOAuthError);
    });

    it('successfully completes callback, encrypts tokens, and saves connection', async () => {
      const state = 'valid-state';
      mockRepository.consumeOAuthState = vi.fn().mockResolvedValue({
        id: randomUUID(),
        userId: customerAUserId,
        state,
        codeVerifier: 'code-verifier-123',
        developerAccountId: 'dev-999',
        redirectUri: 'http://localhost:4000/api/v1/google-play/callback',
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(),
      } as GooglePlayOAuthStateEntity);

      mockClient.exchangeCodeForTokens = vi.fn().mockResolvedValue({
        accessToken: 'ya29.google-test-access-token',
        refreshToken: '1//google-test-refresh-token',
        expiresIn: 3600,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
      });

      mockClient.fetchUserInfo = vi.fn().mockResolvedValue({
        sub: 'google-sub-12345',
        email: 'customerA@gmail.com',
        emailVerified: true,
      });

      // Verification of developer account during callback
      mockClient.getDeveloperUser = vi.fn().mockResolvedValue({
        name: 'developers/dev-999/users/customerA@gmail.com',
        email: 'customerA@gmail.com',
        accessState: 'ACCESS_GRANTED',
        grants: [{ packageName: 'com.customerA.app', appLevelPermissions: ['CAN_VIEW_NON_FINANCIAL_DATA'] }],
      } as GooglePlayUserResource);

      const savedConnection: GooglePlayConnectionEntity = {
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'google-sub-12345',
        googleAccountEmail: 'customerA@gmail.com',
        developerAccountId: 'dev-999',
        encryptedAccessToken: 'encrypted-token',
        encryptedRefreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.saveConnection = vi.fn().mockResolvedValue(savedConnection);
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue(savedConnection);

      const result = await service.handleCallback('auth-code', state);

      expect(result.connection).toBeDefined();
      expect(result.connection.googleAccountEmail).toBe('customerA@gmail.com');
      expect(mockRepository.saveConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: customerAUserId,
          googleAccountId: 'google-sub-12345',
          googleAccountEmail: 'customerA@gmail.com',
          developerAccountId: 'dev-999',
        }),
      );
    });
  });

  describe('Developer Account Verification', () => {
    it('verifies access and saves developerAccountId when user has ACCESS_GRANTED', async () => {
      const encryptedAccessToken = mockCrypto.encrypt('raw-access-token');
      const connection: GooglePlayConnectionEntity = {
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'sub-1',
        googleAccountEmail: 'customerA@gmail.com',
        developerAccountId: null,
        encryptedAccessToken,
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue(connection);

      mockClient.getDeveloperUser = vi.fn().mockResolvedValue({
        name: 'developers/12345678/users/customerA@gmail.com',
        email: 'customerA@gmail.com',
        accessState: 'ACCESS_GRANTED',
        grants: [
          {
            packageName: 'com.customera.fitness',
            appLevelPermissions: ['CAN_VIEW_NON_FINANCIAL_DATA'],
          },
        ],
      } as GooglePlayUserResource);

      const verification = await service.verifyDeveloperAccount(
        customerAUserId,
        '12345678',
      );

      expect(verification.verified).toBe(true);
      expect(verification.developerAccountId).toBe('12345678');
      expect(mockRepository.updateDeveloperAccountId).toHaveBeenCalledWith(
        customerAUserId,
        '12345678',
      );
    });

    it('rejects verification if developer user is not found (404)', async () => {
      const encryptedAccessToken = mockCrypto.encrypt('raw-access-token');
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue({
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'sub-1',
        googleAccountEmail: 'customerA@gmail.com',
        developerAccountId: null,
        encryptedAccessToken,
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockClient.getDeveloperUser = vi.fn().mockResolvedValue(null);

      await expect(
        service.verifyDeveloperAccount(customerAUserId, 'invalid-dev-id'),
      ).rejects.toThrow(GooglePlayDeveloperAccountNotFoundError);
    });

    it('throws ACCESS_EXPIRED when accessState is INVITATION_EXPIRED', async () => {
      const encryptedAccessToken = mockCrypto.encrypt('raw-access-token');
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue({
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'sub-1',
        googleAccountEmail: 'customerA@gmail.com',
        developerAccountId: null,
        encryptedAccessToken,
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockClient.getDeveloperUser = vi.fn().mockResolvedValue({
        name: 'developers/12345678/users/customerA@gmail.com',
        email: 'customerA@gmail.com',
        accessState: 'INVITATION_EXPIRED',
      } as GooglePlayUserResource);

      await expect(
        service.verifyDeveloperAccount(customerAUserId, '12345678'),
      ).rejects.toThrow(GooglePlayAccessExpiredError);
    });

    it('throws GooglePlayAccessDeniedError when accessState is not ACCESS_GRANTED (e.g. INVITED)', async () => {
      const encryptedAccessToken = mockCrypto.encrypt('raw-access-token');
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue({
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'sub-1',
        googleAccountEmail: 'customerA@gmail.com',
        developerAccountId: null,
        encryptedAccessToken,
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockClient.getDeveloperUser = vi.fn().mockResolvedValue({
        name: 'developers/12345678/users/customerA@gmail.com',
        email: 'customerA@gmail.com',
        accessState: 'INVITED',
      } as GooglePlayUserResource);

      await expect(
        service.verifyDeveloperAccount(customerAUserId, '12345678'),
      ).rejects.toThrow(GooglePlayAccessDeniedError);
    });
  });

  describe('Customer Isolation & App Discovery', () => {
    it('Customer A never sees Customer B apps (strict tenant isolation)', async () => {
      // Setup Customer A
      const connA: GooglePlayConnectionEntity = {
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'sub-A',
        googleAccountEmail: 'customerA@gmail.com',
        developerAccountId: 'developer-A-id',
        encryptedAccessToken: mockCrypto.encrypt('token-A'),
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup Customer B
      const connB: GooglePlayConnectionEntity = {
        id: randomUUID(),
        userId: customerBUserId,
        googleAccountId: 'sub-B',
        googleAccountEmail: 'customerB@gmail.com',
        developerAccountId: 'developer-B-id',
        encryptedAccessToken: mockCrypto.encrypt('token-B'),
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findConnectionByUserId = vi.fn().mockImplementation((uid) => {
        if (uid === customerAUserId) return Promise.resolve(connA);
        if (uid === customerBUserId) return Promise.resolve(connB);
        return Promise.resolve(null);
      });

      mockClient.getDeveloperUser = vi.fn().mockImplementation(({ developerAccountId, email }) => {
        if (developerAccountId === 'developer-A-id' && email === 'customerA@gmail.com') {
          return Promise.resolve({
            name: `developers/developer-A-id/users/${email}`,
            email,
            accessState: 'ACCESS_GRANTED',
            grants: [
              {
                packageName: 'com.customerA.gympro',
                appLevelPermissions: ['CAN_VIEW_NON_FINANCIAL_DATA'],
              },
            ],
          });
        }
        if (developerAccountId === 'developer-B-id' && email === 'customerB@gmail.com') {
          return Promise.resolve({
            name: `developers/developer-B-id/users/${email}`,
            email,
            accessState: 'ACCESS_GRANTED',
            grants: [
              {
                packageName: 'com.customerB.accounting',
                appLevelPermissions: ['CAN_VIEW_NON_FINANCIAL_DATA'],
              },
            ],
          });
        }
        return Promise.resolve(null);
      });

      mockClient.getAppListing = vi.fn().mockImplementation(({ packageName }) => {
        if (packageName === 'com.customerA.gympro') {
          return Promise.resolve({ title: 'GymPro A' });
        }
        if (packageName === 'com.customerB.accounting') {
          return Promise.resolve({ title: 'Accounting B' });
        }
        return Promise.resolve(null);
      });

      // Request apps for Customer A
      const resultA = await service.getApps(customerAUserId);
      expect(resultA.developerAccount.id).toBe('developer-A-id');
      expect(resultA.googleAccount.email).toBe('customerA@gmail.com');
      expect(resultA.apps).toHaveLength(1);
      expect(resultA.apps[0]?.packageName).toBe('com.customerA.gympro');
      expect(resultA.apps[0]?.appName).toBe('GymPro A');
      expect(resultA.apps[0]?.playStoreUrl).toBe(
        'https://play.google.com/store/apps/details?id=com.customerA.gympro',
      );

      // Request apps for Customer B
      const resultB = await service.getApps(customerBUserId);
      expect(resultB.developerAccount.id).toBe('developer-B-id');
      expect(resultB.googleAccount.email).toBe('customerB@gmail.com');
      expect(resultB.apps).toHaveLength(1);
      expect(resultB.apps[0]?.packageName).toBe('com.customerB.accounting');
      expect(resultB.apps[0]?.appName).toBe('Accounting B');
      expect(resultB.apps[0]?.playStoreUrl).toBe(
        'https://play.google.com/store/apps/details?id=com.customerB.accounting',
      );

      // Verify that Customer A result never contains Customer B packages
      expect(resultA.apps.some((a) => a.packageName.includes('customerB'))).toBe(false);
      expect(resultB.apps.some((a) => a.packageName.includes('customerA'))).toBe(false);
    });

    it('handles account-level CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL permission', async () => {
      const conn: GooglePlayConnectionEntity = {
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'sub-A',
        googleAccountEmail: 'owner@customer.com',
        developerAccountId: 'global-dev-123',
        encryptedAccessToken: mockCrypto.encrypt('global-token'),
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue(conn);

      mockClient.getDeveloperUser = vi.fn().mockResolvedValue({
        name: 'developers/global-dev-123/users/owner@customer.com',
        email: 'owner@customer.com',
        accessState: 'ACCESS_GRANTED',
        developerAccountPermissions: ['CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL'],
        grants: [], // Empty per-app grants because user has global account-level permission
      });

      // Discovers all apps in the account by listing users
      mockClient.listDeveloperUsers = vi.fn().mockResolvedValue([
        {
          name: 'developers/global-dev-123/users/dev1@customer.com',
          email: 'dev1@customer.com',
          grants: [
            { packageName: 'com.customer.shop', appLevelPermissions: ['CAN_VIEW_NON_FINANCIAL_DATA'] },
            { packageName: 'com.customer.driver', appLevelPermissions: ['CAN_VIEW_NON_FINANCIAL_DATA'] },
          ],
        },
      ]);

      mockClient.getAppListing = vi.fn().mockImplementation(({ packageName }) => {
        if (packageName === 'com.customer.shop') return Promise.resolve({ title: 'Customer Shop' });
        return Promise.resolve(null);
      });

      const result = await service.getApps(customerAUserId);

      expect(result.apps).toHaveLength(2);
      expect(result.apps[0]?.packageName).toBe('com.customer.driver');
      // Falls back to packageName if listing title is missing
      expect(result.apps[0]?.appName).toBe('com.customer.driver');
      expect(result.apps[1]?.packageName).toBe('com.customer.shop');
      expect(result.apps[1]?.appName).toBe('Customer Shop');
    });

    it('returns empty apps array when no authorized packages exist (no demo apps)', async () => {
      const conn: GooglePlayConnectionEntity = {
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'sub-A',
        googleAccountEmail: 'noapps@customer.com',
        developerAccountId: 'empty-dev-123',
        encryptedAccessToken: mockCrypto.encrypt('token'),
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue(conn);

      mockClient.getDeveloperUser = vi.fn().mockResolvedValue({
        name: 'developers/empty-dev-123/users/noapps@customer.com',
        email: 'noapps@customer.com',
        accessState: 'ACCESS_GRANTED',
        grants: [],
      });

      const result = await service.getApps(customerAUserId);
      expect(result.apps).toEqual([]);
    });

    it('throws GooglePlayDeveloperAccountNotConfiguredError when developerAccountId is missing', async () => {
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue({
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'sub-A',
        googleAccountEmail: 'user@customer.com',
        developerAccountId: null,
        encryptedAccessToken: mockCrypto.encrypt('token'),
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.getApps(customerAUserId)).rejects.toThrow(
        GooglePlayDeveloperAccountNotConfiguredError,
      );
    });

    it('throws GooglePlayNotConnectedError when connection does not exist', async () => {
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue(null);

      await expect(service.getApps(customerAUserId)).rejects.toThrow(
        GooglePlayNotConnectedError,
      );
    });
  });

  describe('Token Refresh and Disconnect', () => {
    it('automatically refreshes token when access token is expired', async () => {
      const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
      const encryptedExpiredAccessToken = mockCrypto.encrypt('expired-token');
      const encryptedRefreshToken = mockCrypto.encrypt('valid-refresh-token');

      const conn: GooglePlayConnectionEntity = {
        id: randomUUID(),
        userId: customerAUserId,
        googleAccountId: 'sub-A',
        googleAccountEmail: 'user@customer.com',
        developerAccountId: 'dev-123',
        encryptedAccessToken: encryptedExpiredAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: expiredDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.findConnectionByUserId = vi.fn().mockResolvedValue(conn);

      mockClient.refreshAccessToken = vi.fn().mockResolvedValue({
        accessToken: 'brand-new-access-token',
        expiresIn: 3600,
      });

      mockClient.getDeveloperUser = vi.fn().mockResolvedValue({
        name: 'developers/dev-123/users/user@customer.com',
        email: 'user@customer.com',
        accessState: 'ACCESS_GRANTED',
        grants: [{ packageName: 'com.auto.refresh', appLevelPermissions: ['CAN_VIEW_NON_FINANCIAL_DATA'] }],
      });

      const result = await service.getApps(customerAUserId);

      expect(mockClient.refreshAccessToken).toHaveBeenCalled();
      expect(mockRepository.updateTokens).toHaveBeenCalled();
      expect(result.apps[0]?.packageName).toBe('com.auto.refresh');
    });

    it('disconnects and deletes connection for customer without affecting others', async () => {
      mockRepository.deleteConnection = vi.fn().mockResolvedValue(true);

      const result = await service.disconnect(customerAUserId);

      expect(result.success).toBe(true);
      expect(mockRepository.deleteConnection).toHaveBeenCalledWith(customerAUserId);
    });
  });
});
