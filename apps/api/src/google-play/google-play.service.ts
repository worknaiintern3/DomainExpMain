import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { GooglePlayClientService } from './google-play-client.service';
import { GooglePlayCryptoService } from './google-play-crypto.service';
import {
  GooglePlayAccessDeniedError,
  GooglePlayAccessExpiredError,
  GooglePlayDeveloperAccountNotConfiguredError,
  GooglePlayDeveloperAccountNotFoundError,
  GooglePlayNotConnectedError,
  GooglePlayOAuthError,
  GooglePlayTokenRefreshError,
  GooglePlayUnauthorizedError,
} from './google-play.errors';
import { GooglePlayRepository } from './google-play.repository';
import type {
  GooglePlayAppSummary,
  GooglePlayConnectionEntity,
} from './google-play.types';

const PLAY_CONSOLE_SCOPE =
  'https://www.googleapis.com/auth/androidpublisher openid email profile';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PACKAGE_NAME_PATTERN =
  /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

@Injectable()
export class GooglePlayService {
  private readonly logger = new Logger(GooglePlayService.name);

  constructor(
    @Inject(GooglePlayRepository)
    private readonly repository: GooglePlayRepository,
    @Inject(GooglePlayCryptoService)
    private readonly crypto: GooglePlayCryptoService,
    @Inject(GooglePlayClientService)
    private readonly client: GooglePlayClientService,
  ) {}

  private getClientId(): string {
    const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!id) {
      throw new GooglePlayOAuthError('GOOGLE_OAUTH_CLIENT_ID is not configured');
    }
    return id;
  }

  private getClientSecret(): string {
    const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!secret) {
      throw new GooglePlayOAuthError(
        'GOOGLE_OAUTH_CLIENT_SECRET is not configured',
      );
    }
    return secret;
  }

  getRedirectUri(explicitRedirectUri?: string): string {
    if (explicitRedirectUri) {
      return explicitRedirectUri;
    }

    if (process.env.GOOGLE_PLAY_REDIRECT_URI) {
      return process.env.GOOGLE_PLAY_REDIRECT_URI;
    }

    if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
      const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI;
      try {
        const parsed = new URL(configured);
        parsed.pathname = '/api/v1/google-play/callback';
        return parsed.toString();
      } catch {
        // fallback
      }
    }

    return 'http://localhost:4000/api/v1/google-play/callback';
  }

  async startOAuth(params: {
    userId: string;
    developerAccountId?: string;
    redirectUri?: string;
  }): Promise<{ url: string; state: string }> {
    const clientId = this.getClientId();
    const redirectUri = this.getRedirectUri(params.redirectUri);

    const state = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);
    await this.repository.createOAuthState({
      userId: params.userId,
      state,
      codeVerifier,
      developerAccountId: params.developerAccountId?.trim() || null,
      redirectUri,
      expiresAt,
    });

    const urlParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: PLAY_CONSOLE_SCOPE,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${urlParams.toString()}`;
    return { url, state };
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{
    connection: GooglePlayConnectionEntity;
    redirectUri?: string | null;
  }> {
    const oauthState = await this.repository.consumeOAuthState(state);
    if (!oauthState) {
      throw new GooglePlayOAuthError(
        'Invalid or expired Google OAuth state. Please start over.',
      );
    }

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = oauthState.redirectUri || this.getRedirectUri();

    const tokens = await this.client.exchangeCodeForTokens({
      clientId,
      clientSecret,
      code,
      redirectUri,
      codeVerifier: oauthState.codeVerifier,
    });

    const userInfo = await this.client.fetchUserInfo(tokens.accessToken);

    const encryptedAccessToken = this.crypto.encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? this.crypto.encrypt(tokens.refreshToken)
      : null;
    const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    const connection = await this.repository.saveConnection({
      userId: oauthState.userId,
      googleAccountId: userInfo.sub,
      googleAccountEmail: userInfo.email,
      developerAccountId: oauthState.developerAccountId,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenExpiresAt,
    });

    // If developer account ID was provided during onboarding, verify it immediately
    if (oauthState.developerAccountId) {
      try {
        await this.verifyDeveloperAccount(
          oauthState.userId,
          oauthState.developerAccountId,
        );
      } catch (err: unknown) {
        this.logger.warn(
          `Initial developer account verification deferred or failed: ${String(err)}`,
        );
      }
    }

    return { connection, redirectUri: oauthState.redirectUri };
  }

  async getStatus(userId: string): Promise<{
    connected: boolean;
    googleAccount?: { email: string };
    developerAccount?: { id: string };
  }> {
    const conn = await this.repository.findConnectionByUserId(userId);
    if (!conn) {
      return { connected: false };
    }

    const statusResult: {
      connected: boolean;
      googleAccount?: { email: string };
      developerAccount?: { id: string };
    } = {
      connected: true,
      googleAccount: { email: conn.googleAccountEmail },
    };
    if (conn.developerAccountId) {
      statusResult.developerAccount = { id: conn.developerAccountId };
    }

    return statusResult;
  }

  async verifyDeveloperAccount(
    userId: string,
    rawDeveloperAccountId: string,
  ): Promise<{
    verified: boolean;
    developerAccountId: string;
    googleAccountEmail: string;
  }> {
    const developerAccountId = rawDeveloperAccountId.trim();
    if (!developerAccountId) {
      throw new GooglePlayDeveloperAccountNotFoundError(
        'Developer Account ID cannot be empty',
      );
    }

    const conn = await this.repository.findConnectionByUserId(userId);
    if (!conn) {
      throw new GooglePlayNotConnectedError();
    }

    const accessToken = await this.getValidAccessToken(conn);

    const userResource = await this.client.getDeveloperUser({
      developerAccountId,
      email: conn.googleAccountEmail,
      accessToken,
    });

    if (!userResource) {
      throw new GooglePlayDeveloperAccountNotFoundError(
        `User ${conn.googleAccountEmail} is not authorized or was not found in developer account ${developerAccountId}`,
      );
    }

    if (userResource.accessState === 'INVITATION_EXPIRED') {
      throw new GooglePlayAccessExpiredError();
    }

    if (userResource.accessState !== 'ACCESS_GRANTED') {
      throw new GooglePlayAccessDeniedError(
        `Access state is '${userResource.accessState ?? 'UNSPECIFIED'}'. Google Play Console invitation must be accepted.`,
      );
    }

    await this.repository.updateDeveloperAccountId(userId, developerAccountId);

    return {
      verified: true,
      developerAccountId,
      googleAccountEmail: conn.googleAccountEmail,
    };
  }

  async getApps(userId: string): Promise<{
    success: boolean;
    developerAccount: { id: string };
    googleAccount: { email: string };
    apps: GooglePlayAppSummary[];
  }> {
    const conn = await this.repository.findConnectionByUserId(userId);
    if (!conn) {
      throw new GooglePlayNotConnectedError();
    }

    if (!conn.developerAccountId) {
      throw new GooglePlayDeveloperAccountNotConfiguredError();
    }

    const accessToken = await this.getValidAccessToken(conn);

    const userResource = await this.client.getDeveloperUser({
      developerAccountId: conn.developerAccountId,
      email: conn.googleAccountEmail,
      accessToken,
    });

    if (!userResource) {
      throw new GooglePlayDeveloperAccountNotFoundError(
        `Google account ${conn.googleAccountEmail} does not have access to developer account ${conn.developerAccountId}`,
      );
    }

    if (userResource.accessState === 'INVITATION_EXPIRED') {
      throw new GooglePlayAccessExpiredError();
    }

    if (userResource.accessState !== 'ACCESS_GRANTED') {
      throw new GooglePlayAccessDeniedError(
        `Play Console access not granted (status: ${userResource.accessState ?? 'UNSPECIFIED'})`,
      );
    }

    const authorizedPackageNames = new Set<string>();

    // 1. Collect from per-app grants
    if (Array.isArray(userResource.grants)) {
      for (const grant of userResource.grants) {
        if (
          grant?.packageName &&
          PACKAGE_NAME_PATTERN.test(grant.packageName)
        ) {
          authorizedPackageNames.add(grant.packageName);
        }
      }
    }

    // 2. Check account-level permission: CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL
    const hasGlobalPermission =
      userResource.developerAccountPermissions?.includes(
        'CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL',
      ) ||
      userResource.developerAccountPermissions?.includes(
        'CAN_MANAGE_PERMISSIONS',
      );

    if (hasGlobalPermission) {
      try {
        const users = await this.client.listDeveloperUsers({
          developerAccountId: conn.developerAccountId,
          accessToken,
        });

        for (const u of users) {
          if (Array.isArray(u.grants)) {
            for (const g of u.grants) {
              if (g?.packageName && PACKAGE_NAME_PATTERN.test(g.packageName)) {
                authorizedPackageNames.add(g.packageName);
              }
            }
          }
        }
      } catch (err: unknown) {
        this.logger.debug(
          `Listing account users for global package discovery: ${String(err)}`,
        );
      }
    }

    // 3. For each authorized package, retrieve verified app listing details
    const apps: GooglePlayAppSummary[] = [];

    for (const packageName of authorizedPackageNames) {
      let appName = packageName;

      try {
        const listing = await this.client.getAppListing({
          packageName,
          accessToken,
        });
        if (listing?.title && listing.title.trim().length > 0) {
          appName = listing.title.trim();
        }
      } catch {
        // Fall back cleanly to packageName without fabricating names
      }

      apps.push({
        packageName,
        appName,
        playStoreUrl: `https://play.google.com/store/apps/details?id=${packageName}`,
      });
    }

    // Sort cleanly by appName
    apps.sort((a, b) => a.appName.localeCompare(b.appName));

    return {
      success: true,
      developerAccount: {
        id: conn.developerAccountId,
      },
      googleAccount: {
        email: conn.googleAccountEmail,
      },
      apps,
    };
  }

  async refreshToken(userId: string): Promise<{
    success: boolean;
    tokenExpiresAt: Date;
  }> {
    const conn = await this.repository.findConnectionByUserId(userId);
    if (!conn) {
      throw new GooglePlayNotConnectedError();
    }

    if (!conn.encryptedRefreshToken) {
      throw new GooglePlayTokenRefreshError(
        'No refresh token available. Re-authorization required.',
      );
    }

    const refreshTokenPlain = this.crypto.decrypt(conn.encryptedRefreshToken);
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const refreshed = await this.client.refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken: refreshTokenPlain,
    });

    const encryptedAccessToken = this.crypto.encrypt(refreshed.accessToken);
    const encryptedRefreshToken = refreshed.refreshToken
      ? this.crypto.encrypt(refreshed.refreshToken)
      : undefined;
    const tokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);

    await this.repository.updateTokens({
      userId,
      encryptedAccessToken,
      encryptedRefreshToken: encryptedRefreshToken ?? null,
      tokenExpiresAt,
    });

    return {
      success: true,
      tokenExpiresAt,
    };
  }

  async disconnect(userId: string): Promise<{ success: boolean }> {
    const deleted = await this.repository.deleteConnection(userId);
    return { success: deleted };
  }

  private async getValidAccessToken(
    conn: GooglePlayConnectionEntity,
  ): Promise<string> {
    const now = new Date();
    const marginMs = 60 * 1000; // 1-minute safety margin

    // Check if token is still valid
    if (conn.tokenExpiresAt.getTime() > now.getTime() + marginMs) {
      try {
        return this.crypto.decrypt(conn.encryptedAccessToken);
      } catch {
        // decryption failed, fallback to refresh
      }
    }

    // Attempt token refresh
    if (!conn.encryptedRefreshToken) {
      throw new GooglePlayUnauthorizedError(
        'Google Play authorization token has expired and cannot be refreshed. Please reconnect your account.',
      );
    }

    let refreshTokenPlain: string;
    try {
      refreshTokenPlain = this.crypto.decrypt(conn.encryptedRefreshToken);
    } catch {
      throw new GooglePlayUnauthorizedError(
        'Corrupt refresh token. Please reconnect your Google Play account.',
      );
    }

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const refreshed = await this.client.refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken: refreshTokenPlain,
    });

    const encryptedAccessToken = this.crypto.encrypt(refreshed.accessToken);
    const encryptedRefreshToken = refreshed.refreshToken
      ? this.crypto.encrypt(refreshed.refreshToken)
      : undefined;
    const tokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);

    await this.repository.updateTokens({
      userId: conn.userId,
      encryptedAccessToken,
      encryptedRefreshToken: encryptedRefreshToken ?? null,
      tokenExpiresAt,
    });

    return refreshed.accessToken;
  }
}
