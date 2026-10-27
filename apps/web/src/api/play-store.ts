/**
 * Play Store public search client.
 *
 * Backend endpoints (no auth required):
 *   GET /play-store/developers/search?q=&limit=  -> DeveloperSearchResponse
 *   GET /play-store/developers/:developerId/apps -> DeveloperAppsResponse
 *   GET /play-store/developer-apps?developerId=&limit= -> DeveloperAppsResponse
 *
 * No backend changes are required — this client only consumes existing endpoints.
 */

import { apiRequest } from './client';

export type DeveloperSearchResult = {
  id: string;
  name: string;
  icon?: string;
  sampleApps: string[];
  appCount: number;
  verified: boolean;
};

export type PlayStoreAppItem = {
  id: string;
  name: string;
  packageId: string;
  developerName: string;
  developerId?: string;
  iconUrl?: string;
  playStoreUrl: string;
  summary?: string;
  score?: number;
  scoreText?: string;
  price?: string | number;
  free?: boolean;
  currency?: string;
};

export type DeveloperSearchResponse = {
  query: string;
  total: number;
  developers: DeveloperSearchResult[];
};

export type DeveloperAppsResponse = {
  developerId: string;
  developerName: string;
  total: number;
  apps: PlayStoreAppItem[];
};

export function searchPlayStoreDevelopers(
  query: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<DeveloperSearchResponse> {
  const search = new URLSearchParams({ q: query });
  if (limit) search.set('limit', String(limit));
  return apiRequest<DeveloperSearchResponse>(`/play-store/developers/search?${search}`, {
    signal,
    authenticated: false,
  });
}

export function getPlayStoreDeveloperApps(
  developerId: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<DeveloperAppsResponse> {
  const search = new URLSearchParams();
  if (limit) search.set('limit', String(limit));
  const qs = search.toString();
  return apiRequest<DeveloperAppsResponse>(
    `/play-store/developers/${encodeURIComponent(developerId)}/apps${qs ? `?${qs}` : ''}`,
    { signal, authenticated: false },
  );
}

export function getPlayStoreDeveloperAppsByQuery(
  developerId: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<DeveloperAppsResponse> {
  const search = new URLSearchParams({ developerId });
  if (limit) search.set('limit', String(limit));
  return apiRequest<DeveloperAppsResponse>(`/play-store/developer-apps?${search}`, {
    signal,
    authenticated: false,
  });
}

export interface PlayStoreSyncResponse {
  success: boolean;
  developerName: string;
  total: number;
  apps: PlayStoreAppItem[];
  message: string;
}

export function syncPlayStoreDeveloper(
  developerName: string,
  signal?: AbortSignal,
): Promise<PlayStoreSyncResponse> {
  return apiRequest<PlayStoreSyncResponse>('/play-store/sync', {
    method: 'POST',
    body: { developerName },
    signal,
    authenticated: true,
  });
}

export function getConnectedPlayStoreAccount(
  signal?: AbortSignal,
): Promise<{ developerName: string | null }> {
  return apiRequest<{ developerName: string | null }>('/play-store/connected-account', {
    signal,
    authenticated: true,
  });
}

