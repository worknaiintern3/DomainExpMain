import { Injectable, Logger } from '@nestjs/common';
import {
  GooglePlayAccessDeniedError,
  GooglePlayDeveloperAccountNotFoundError,
  GooglePlayError,
  GooglePlayOAuthError,
  GooglePlayRateLimitError,
  GooglePlayTokenRefreshError,
  GooglePlayUnauthorizedError,
} from './google-play.errors';
import type {
  GooglePlayAppListing,
  GooglePlayOAuthTokens,
  GooglePlayUserResource,
  GoogleUserInfo,
} from './google-play.types';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const ANDROID_PUBLISHER_BASE_URL =
  'https://androidpublisher.googleapis.com/androidpublisher/v3';

@Injectable()
export class GooglePlayClientService {
  private readonly logger = new Logger(GooglePlayClientService.name);

  async exchangeCodeForTokens(params: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<GooglePlayOAuthTokens> {
    const body = new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      grant_type: 'authorization_code',
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    });

    let res: Response;
    try {
      res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch (err: unknown) {
      this.logger.error(`Failed to connect to Google OAuth token endpoint: ${String(err)}`);
      throw new GooglePlayOAuthError('Failed to communicate with Google authentication server');
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      this.logger.warn(`Google token exchange returned ${res.status}: ${errorText}`);
      throw new GooglePlayOAuthError(
        res.status === 400
          ? 'Invalid or expired authorization code'
          : `Google OAuth error: HTTP ${res.status}`,
      );
    }

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      id_token?: string;
    };

    if (!data.access_token) {
      throw new GooglePlayOAuthError('Google did not return an access token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ?? 3600,
      scope: data.scope ?? '',
      idToken: data.id_token,
    };
  }

  async refreshAccessToken(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
    const body = new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: 'refresh_token',
    });

    let res: Response;
    try {
      res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch (err: unknown) {
      this.logger.error(`Network error refreshing Google token: ${String(err)}`);
      throw new GooglePlayTokenRefreshError('Network failure refreshing access token');
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      this.logger.warn(`Token refresh failed with status ${res.status}: ${errorText}`);
      throw new GooglePlayTokenRefreshError(
        'Google rejected token refresh. Authorization may have been revoked.',
      );
    }

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) {
      throw new GooglePlayTokenRefreshError('Google token refresh returned no access token');
    }

    const result: { accessToken: string; expiresIn: number; refreshToken?: string } = {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 3600,
    };
    if (data.refresh_token) {
      result.refreshToken = data.refresh_token;
    }
    return result;
  }

  async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    let res: Response;
    try {
      res = await fetch(GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err: unknown) {
      this.logger.error(`Failed to fetch Google user info: ${String(err)}`);
      throw new GooglePlayOAuthError('Failed to fetch user profile from Google');
    }

    if (!res.ok) {
      throw new GooglePlayUnauthorizedError('Google user profile could not be retrieved');
    }

    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
    };

    if (!data.sub || !data.email) {
      throw new GooglePlayOAuthError('Incomplete user identity received from Google');
    }

    const user: GoogleUserInfo = {
      sub: data.sub,
      email: data.email,
    };
    if (data.email_verified !== undefined) {
      return {
        ...user,
        emailVerified: data.email_verified,
      };
    }
    return user;
  }

  async getDeveloperUser(params: {
    developerAccountId: string;
    email: string;
    accessToken: string;
  }): Promise<GooglePlayUserResource | null> {
    const encodedDev = encodeURIComponent(params.developerAccountId);
    const encodedEmail = encodeURIComponent(params.email);
    const url = `${ANDROID_PUBLISHER_BASE_URL}/developers/${encodedDev}/users/${encodedEmail}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err: unknown) {
      this.logger.error(`Failed to reach Google Play Developer API: ${String(err)}`);
      throw new GooglePlayError('Network failure connecting to Google Play Developer API');
    }

    if (res.status === 401) {
      throw new GooglePlayUnauthorizedError();
    }
    if (res.status === 403) {
      throw new GooglePlayAccessDeniedError();
    }
    if (res.status === 404) {
      return null;
    }
    if (res.status === 429) {
      throw new GooglePlayRateLimitError();
    }
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      this.logger.warn(`getDeveloperUser returned HTTP ${res.status}: ${errorText}`);
      throw new GooglePlayError(`Google Play Developer API returned status ${res.status}`);
    }

    const data = (await res.json()) as GooglePlayUserResource;
    return data;
  }

  async listDeveloperUsers(params: {
    developerAccountId: string;
    accessToken: string;
  }): Promise<GooglePlayUserResource[]> {
    const encodedDev = encodeURIComponent(params.developerAccountId);
    const url = `${ANDROID_PUBLISHER_BASE_URL}/developers/${encodedDev}/users`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err: unknown) {
      this.logger.error(`Failed to list developer users: ${String(err)}`);
      throw new GooglePlayError('Network failure connecting to Google Play Developer API');
    }

    if (res.status === 401) {
      throw new GooglePlayUnauthorizedError();
    }
    if (res.status === 403) {
      throw new GooglePlayAccessDeniedError();
    }
    if (res.status === 404) {
      throw new GooglePlayDeveloperAccountNotFoundError();
    }
    if (res.status === 429) {
      throw new GooglePlayRateLimitError();
    }
    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as { users?: GooglePlayUserResource[] };
    return data.users ?? [];
  }

  async getAppListing(params: {
    packageName: string;
    accessToken: string;
  }): Promise<GooglePlayAppListing | null> {
    const encodedPackage = encodeURIComponent(params.packageName);
    const editUrl = `${ANDROID_PUBLISHER_BASE_URL}/applications/${encodedPackage}/edits`;

    let editRes: Response;
    try {
      editRes = await fetch(editUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({}),
      });
    } catch {
      return null;
    }

    if (!editRes.ok) {
      return null;
    }

    const editData = (await editRes.json()) as { id?: string };
    const editId = editData.id;
    if (!editId) {
      return null;
    }

    try {
      const listingUrl = `${ANDROID_PUBLISHER_BASE_URL}/applications/${encodedPackage}/edits/${encodeURIComponent(editId)}/listings`;
      const listingRes = await fetch(listingUrl, {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!listingRes.ok) {
        return null;
      }

      const listingData = (await listingRes.json()) as {
        listings?: GooglePlayAppListing[];
      };
      const listings = listingData.listings ?? [];
      const primary =
        listings.find((l) => (l.language || '').toLowerCase().startsWith('en')) ||
        listings[0];

      return primary ?? null;
    } finally {
      // Discard draft edit
      fetch(`${editUrl}/${encodeURIComponent(editId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
      }).catch(() => {});
    }
  }
}
