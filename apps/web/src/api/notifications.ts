/**
 * Notification preferences, delivery history, and monitored expiry client.
 *
 * Backend endpoints (all authenticated):
 *   GET   /notifications/preferences
 *   PATCH /notifications/preferences
 *   GET   /notifications/history?limit=
 *   PATCH /notifications/history/:id/read
 *   GET   /notifications/expiries
 *   POST  /notifications/expiries
 *   POST  /notifications/trigger-check
 *
 * These mirror the endpoints the mobile app uses; no backend changes are
 * required by this client.
 */

import { apiRequest } from './client';

export type AssetExpiryType = 'domain' | 'server' | 'hosting' | 'ssl';

export interface NotificationPreferences {
  id: string;
  userId: string;
  workspaceId: string;
  pushEnabled: boolean;
  reminderThresholds: number[];
  notifyDomains: boolean;
  notifyServers: boolean;
  notifyHosting: boolean;
  notifySsl: boolean;
  timeZone: string;
  preferredHour: number;
  createdAt: string;
  updatedAt: string;
}

export type UpdateNotificationPreferences = Partial<
  Pick<
    NotificationPreferences,
    | 'pushEnabled'
    | 'reminderThresholds'
    | 'notifyDomains'
    | 'notifyServers'
    | 'notifyHosting'
    | 'notifySsl'
    | 'timeZone'
    | 'preferredHour'
  >
>;

export type NotificationHistoryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

export interface NotificationHistoryItem {
  id: string;
  assetId: string;
  assetType: AssetExpiryType;
  assetName: string;
  expiryDate: string;
  reminderThreshold: number;
  title: string;
  body: string;
  status: NotificationHistoryStatus;
  ticketId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface MonitoredExpiry {
  id: string;
  workspaceId: string;
  assetType: AssetExpiryType;
  assetName: string;
  hostname: string | null;
  provider: string | null;
  expiresAt: string;
  status: string;
  timeZone: string;
  reminderThresholds: number[];
  createdAt: string;
}

export interface UpsertAssetExpiryInput {
  assetId: string;
  assetType: AssetExpiryType;
  assetName: string;
  hostname?: string | null;
  expiryDate: string;
  providerKey?: string | null;
}

export interface ExpiryCheckResult {
  jobId: string;
  startedAt: string;
  completedAt: string;
  assetsChecked: number;
  remindersIdentified: number;
  remindersSent: number;
  remindersSkippedAlreadySent: number;
  remindersSkippedDisabled: number;
  dryRun: boolean;
  errors: string[];
}

export function getNotificationPreferences(
  signal?: AbortSignal,
): Promise<NotificationPreferences> {
  return apiRequest('/notifications/preferences', { signal });
}

export function updateNotificationPreferences(
  updates: UpdateNotificationPreferences,
): Promise<NotificationPreferences> {
  return apiRequest('/notifications/preferences', {
    body: updates,
    method: 'PATCH',
  });
}

export function listNotificationHistory(
  limit = 50,
  signal?: AbortSignal,
): Promise<NotificationHistoryItem[]> {
  const search = new URLSearchParams({ limit: String(limit) });
  return apiRequest(`/notifications/history?${search}`, { signal });
}

export function markNotificationRead(
  id: string,
): Promise<{ ok: boolean; markedRead: boolean }> {
  return apiRequest(`/notifications/history/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

export function listMonitoredExpiries(
  signal?: AbortSignal,
): Promise<MonitoredExpiry[]> {
  return apiRequest('/notifications/expiries', { signal });
}

export function upsertMonitoredExpiry(
  input: UpsertAssetExpiryInput,
): Promise<Pick<MonitoredExpiry, 'id' | 'assetType' | 'assetName' | 'hostname' | 'expiresAt' | 'status'>> {
  return apiRequest('/notifications/expiries', { body: input, method: 'POST' });
}

export function triggerExpiryCheck(
  body: { dryRun?: boolean; simulatedDaysRemaining?: number } = {},
): Promise<ExpiryCheckResult> {
  return apiRequest('/notifications/trigger-check', { body, method: 'POST' });
}
