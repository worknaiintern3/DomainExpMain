/**
 * GET /api/v1/settings          -> { general }
 * PUT /api/v1/settings/general   -> { general, portfolio }
 * PUT /api/v1/settings/portfolio -> { general, portfolio }   (names live in real columns:
 *   displayName -> users.display_name, workspaceName -> workspaces.name)
 */
import { apiRequest } from './client';

export type LandingPage =
  | '/overview'
  | '/domains'
  | '/servers'
  | '/websites'
  | '/applications'
  | '/projects'
  | '/cloud-resources'
  | '/accounts'
  | '/find-domain'
  | '/pricing'
  | '/alerts'
  | '/activities'
  | '/notifications'
  | '/infrastructure-map'
  | '/google-play'
  | '/play-store';

export interface GeneralSettingsPayload {
  dateFormat: 'DD MMM YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  defaultLandingPage: LandingPage;
  displayName: string | null;
  rowsPerPage: 20 | 50 | 100;
  timezone: string;
  workspaceName: string;
}

export interface PortfolioSettingsPayload {
  autoFetchMetadataOnCreation: boolean;
  automaticMetadataRefresh: 'on-open' | 'manual';
  criticalThresholdDays: number;
  defaultAutoRenew: 'on' | 'off' | 'unknown';
  metadataSources: { dns: boolean; http: boolean; infra: boolean; rdap: boolean; tls: boolean };
  warningThresholdDays: number;
}

export interface DiscoverySettingsPayload {
  availabilityCheckMode: 'selected' | 'all';
  defaultCheckedTlds: string[];
  defaultSearchSort: 'availability' | 'price' | 'tld' | 'match';
  savedSearchHistory: boolean;
}

export interface SettingsResponse {
  discovery: DiscoverySettingsPayload;
  general: GeneralSettingsPayload;
  portfolio: PortfolioSettingsPayload;
}

export interface SettingsReadResponse extends SettingsResponse {
  role: 'owner' | 'admin' | 'member';
}

export function getSettings(signal?: AbortSignal): Promise<SettingsReadResponse> {
  return apiRequest<SettingsReadResponse>('/settings', signal ? { signal } : {});
}

export function saveGeneralSettings(input: GeneralSettingsPayload): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>('/settings/general', { body: input, method: 'PUT' });
}

export function savePortfolioSettings(input: PortfolioSettingsPayload): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>('/settings/portfolio', { body: input, method: 'PUT' });
}

export function saveDiscoverySettings(input: DiscoverySettingsPayload): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>('/settings/discovery', { body: input, method: 'PUT' });
}
