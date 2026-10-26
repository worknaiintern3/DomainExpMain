/**
 * Google Play Console integration client.
 *
 * Backend endpoints (all under `/api/v1/google-play/*`, require auth):
 *   GET  /status              -> GooglePlayStatusResponse
 *   GET  /apps                -> GooglePlayAppsResponse
 *   POST /verify-account      -> body { developerAccountId } -> { verified, developerAccountId, googleAccountEmail }
 *   POST /refresh             -> { success, tokenExpiresAt }
 *   POST /disconnect          -> { success }
 *   GET  /auth                -> query { developerAccountId?, redirectUri?, token? } -> { authUrl, state } (or 302 redirect)
 *
 * No backend changes are required — this client only consumes existing endpoints.
 */

import { apiRequest } from './client';

export type GooglePlayStatusResponse = {
  connected: boolean;
  googleAccount?: { email: string };
  developerAccount?: { id: string };
};

export type GooglePlayVerifyAccountRequest = {
  developerAccountId: string;
};

export type GooglePlayApp = {
  packageName: string;
  appName: string;
  playStoreUrl: string;
};

export type GooglePlayAppsResponse = {
  success: boolean;
  developerAccount: { id: string };
  googleAccount: { email: string };
  apps: GooglePlayApp[];
};

export function getGooglePlayStatus(signal?: AbortSignal): Promise<GooglePlayStatusResponse> {
  return apiRequest<GooglePlayStatusResponse>('/google-play/status', { signal });
}

export function getGooglePlayApps(signal?: AbortSignal): Promise<GooglePlayAppsResponse> {
  return apiRequest<GooglePlayAppsResponse>('/google-play/apps', { signal });
}

export function verifyGooglePlayDeveloperAccount(
  developerAccountId: string,
): Promise<{ verified: boolean; developerAccountId: string; googleAccountEmail: string }> {
  return apiRequest('/google-play/verify-account', {
    body: { developerAccountId },
    method: 'POST',
  });
}

export function refreshGooglePlayToken(signal?: AbortSignal): Promise<{
  success: boolean;
  tokenExpiresAt: Date;
}> {
  return apiRequest<{ success: boolean; tokenExpiresAt: Date }>('/google-play/refresh', {
    method: 'POST',
    signal,
  });
}

export function disconnectGooglePlay(signal?: AbortSignal): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/google-play/disconnect', {
    method: 'POST',
    signal,
  });
}

export interface StartGooglePlayAuthResult {
  authUrl: string;
  state: string;
}

export function startGooglePlayAuth(
  params: { developerAccountId?: string; redirectUri?: string } = {},
): Promise<StartGooglePlayAuthResult> {
  const search = new URLSearchParams();
  if (params.developerAccountId) search.set('developerAccountId', params.developerAccountId);
  if (params.redirectUri) search.set('redirectUri', params.redirectUri);

  const qs = search.toString();
  return apiRequest<StartGooglePlayAuthResult>(
    `/google-play/auth${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}
