import { apiRequest } from './client';

const base = '/admin/mobile';

export interface AdminMobileConfig { id: string; appName: string; logoUrl: string | null; primaryColor: string; secondaryColor: string; maintenanceMode: boolean; maintenanceMessage: string | null }
export interface AdminFeatureFlag { id: string; key: string; name: string; description: string | null; enabled: boolean; minAppVersion: string | null }
export interface MobileNavigationItem { key: string; label: string; icon: string; route: string; sortOrder: number; enabled: boolean; badge?: string | null }
export interface AdminNavigationItem extends MobileNavigationItem { id: string }
export interface MobileHomeSection { sectionKey: string; title: string; sortOrder: number; enabled: boolean; configJson?: Record<string, unknown> | null }
export interface AdminHomeSection extends MobileHomeSection { id: string }
export interface AdminVersion { id: string; platform: 'ios' | 'android' | 'all'; minimumVersion: string; latestVersion: string; forceUpdate: boolean; updateUrl: string | null; releaseNotes: string | null }
export interface AdminAnnouncement { id: string; title: string; message: string; type: 'info' | 'warning' | 'critical' | 'promo'; actionUrl: string | null; actionLabel: string | null; isActive: boolean; startsAt: string | null; expiresAt: string | null }
export interface AdminAuditLog { id: string; userId: string | null; action: string; target: string; details: string | null; ipAddress: string | null; createdAt: string }
export type UpdateMobileAppConfigRequest = Partial<Omit<AdminMobileConfig, 'id'>>;
export type UpdateMobileFeatureFlagRequest = Partial<Pick<AdminFeatureFlag, 'name' | 'description' | 'enabled' | 'minAppVersion'>>;
export type UpdateMobileAppVersionRequest = Partial<Omit<AdminVersion, 'id' | 'platform'>>;
export type CreateMobileAnnouncementRequest = Omit<AdminAnnouncement, 'id'>;

export const getMobileAdminConfig = (signal?: AbortSignal) =>
  apiRequest<AdminMobileConfig>(`${base}/config`, { signal });
export const updateMobileAdminConfig = (body: UpdateMobileAppConfigRequest) =>
  apiRequest<AdminMobileConfig>(`${base}/config`, { method: 'PATCH', body });
export const getMobileAdminFeatures = () => apiRequest<AdminFeatureFlag[]>(`${base}/features`);
export const updateMobileAdminFeature = (key: string, body: UpdateMobileFeatureFlagRequest) =>
  apiRequest<AdminFeatureFlag>(`${base}/features/${encodeURIComponent(key)}`, { method: 'PATCH', body });
export const getMobileAdminNavigation = () => apiRequest<AdminNavigationItem[]>(`${base}/navigation`);
export const updateMobileAdminNavigation = (items: MobileNavigationItem[]) =>
  apiRequest<AdminNavigationItem[]>(`${base}/navigation`, { method: 'PUT', body: { items } });
export const getMobileAdminHome = () => apiRequest<AdminHomeSection[]>(`${base}/home`);
export const updateMobileAdminHome = (sections: MobileHomeSection[]) =>
  apiRequest<AdminHomeSection[]>(`${base}/home`, { method: 'PUT', body: { sections } });
export const getMobileAdminVersions = () => apiRequest<AdminVersion[]>(`${base}/versions`);
export const updateMobileAdminVersion = (platform: AdminVersion['platform'], body: UpdateMobileAppVersionRequest) =>
  apiRequest<AdminVersion>(`${base}/versions/${platform}`, { method: 'PUT', body });
export const getMobileAdminAnnouncements = () => apiRequest<AdminAnnouncement[]>(`${base}/announcements`);
export const createMobileAdminAnnouncement = (body: CreateMobileAnnouncementRequest) =>
  apiRequest<AdminAnnouncement>(`${base}/announcements`, { method: 'POST', body });
export const updateMobileAdminAnnouncement = (id: string, body: Partial<CreateMobileAnnouncementRequest>) =>
  apiRequest<AdminAnnouncement>(`${base}/announcements/${encodeURIComponent(id)}`, { method: 'PATCH', body });
export const deleteMobileAdminAnnouncement = (id: string) =>
  apiRequest<{ success: boolean }>(`${base}/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getMobileAdminAuditLogs = () => apiRequest<AdminAuditLog[]>(`${base}/audit-logs`);
