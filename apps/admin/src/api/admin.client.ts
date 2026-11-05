import type {
  CreateMobileAnnouncementRequest,
  MobileAnnouncement,
  MobileAppConfig,
  MobileAppVersion,
  MobileAuditLogResponse,
  MobileFeatureFlag,
  MobileHomeSection,
  MobileNavigationItem,
  UpdateMobileAppConfigRequest,
  UpdateMobileAppVersionRequest,
  UpdateMobileFeatureFlagRequest,
} from '@domainpulse/contracts';
import type {
  PlatformStats,
  PlatformUser,
  WebDomainItem,
  WebServerItem,
} from '../types/admin.types';

const TOKEN_KEY = 'domainpulse_admin_token';
const API_PREFIX = '/api/v1/admin';
export const ADMIN_SESSION_CHANGED_EVENT = 'domainpulse:admin-session-changed';

function storeToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(ADMIN_SESSION_CHANGED_EVENT));
}

// Clean up any legacy sandbox keys from previous versions
try {
  const legacyKeys = [
    'dp_admin_dev_users_v2',
    'dp_admin_dev_domains_v2',
    'dp_admin_dev_servers_v2',
    'dp_admin_dev_config',
    'dp_admin_dev_features',
    'dp_admin_dev_navigation',
    'dp_admin_dev_home',
    'dp_admin_dev_versions',
    'dp_admin_dev_announcements',
    'dp_admin_dev_audit_logs',
  ];
  legacyKeys.forEach((key) => localStorage.removeItem(key));
} catch {
  // ignore
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Only send Content-Type header if there is an actual request body
  if (options.body !== undefined && options.body !== null) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(path, {
      ...options,
      headers,
      signal: controller.signal,
    });

    // Ignore a stale response if another request has already signed in again.
    if (response.status === 401 && localStorage.getItem(TOKEN_KEY) === token) {
      storeToken(null);
    }

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson?.detail) errorMsg = errJson.detail;
        else if (errJson?.message) errorMsg = errJson.message;
      } catch {
        // Keep the HTTP error if the server did not send JSON.
      }
      throw new Error(errorMsg);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      return undefined as unknown as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  } catch (error) {
    if (timedOut) throw new Error('The request timed out. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export class AdminClient {
  hasToken(): boolean {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    storeToken(token);
  }

  clearToken(): void {
    storeToken(null);
  }

  async login(email: string, password: string): Promise<{ accessToken: string; user: any }> {
    const res = await request<{ accessToken: string; user: any }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res?.accessToken) {
      this.setToken(res.accessToken);
    }
    return res;
  }

  /* ---------------- PLATFORM & STATS ---------------- */
  async getPlatformStats(): Promise<PlatformStats> {
    return request<PlatformStats>(`${API_PREFIX}/platform/stats`);
  }

  /* ---------------- USERS MANAGEMENT ---------------- */
  async getUsers(filter?: {
    type?: 'all' | 'web' | 'mobile';
    search?: string;
    status?: string;
    role?: string;
  }): Promise<PlatformUser[]> {
    const params = new URLSearchParams();
    if (filter?.type && filter.type !== 'all') params.set('type', filter.type);
    if (filter?.search) params.set('search', filter.search);
    if (filter?.status && filter.status !== 'all') params.set('status', filter.status);
    if (filter?.role && filter.role !== 'all') params.set('role', filter.role);

    const queryString = params.toString();
    const url = queryString ? `${API_PREFIX}/users?${queryString}` : `${API_PREFIX}/users`;
    return request<PlatformUser[]>(url);
  }

  async getUserById(id: string): Promise<PlatformUser> {
    return request<PlatformUser>(`${API_PREFIX}/users/${id}`);
  }

  async getUserDetail(id: string): Promise<PlatformUser> {
    return this.getUserById(id);
  }

  async updateUser(id: string, updates: Partial<PlatformUser> & Record<string, any>): Promise<PlatformUser> {
    return request<PlatformUser>(`${API_PREFIX}/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async toggleUserStatus(id: string, status: 'active' | 'suspended', reason?: string): Promise<PlatformUser> {
    return this.updateUser(id, {
      status,
      suspendReason: status === 'suspended' ? reason || 'Administrative suspension' : null,
    });
  }

  async updateUserRole(id: string, role: string): Promise<PlatformUser> {
    return this.updateUser(id, {
      platformRole: role as any,
    });
  }

  async revokeUserSessions(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`${API_PREFIX}/users/${id}/revoke-sessions`, {
      method: 'POST',
    });
  }

  async sendUserNotification(
    id: string,
    payload: { title: string; message: string; channel?: string },
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${API_PREFIX}/users/${id}/notify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async broadcastNotification(payload: {
    title: string;
    message: string;
    platform?: string;
  }): Promise<{ success: boolean; recipientsCount?: number; devicesCount?: number }> {
    return request<{ success: boolean; recipientsCount?: number; devicesCount?: number }>(
      `${API_PREFIX}/users/broadcast`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async deleteUser(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${API_PREFIX}/users/${id}`, {
      method: 'DELETE',
    });
  }

  /* ---------------- PLATFORM INVENTORY: DOMAINS & SERVERS ---------------- */
  async getAllDomains(search?: string): Promise<WebDomainItem[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<WebDomainItem[]>(`${API_PREFIX}/platform/domains${query}`);
  }

  async getAllServers(search?: string): Promise<WebServerItem[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<WebServerItem[]>(`${API_PREFIX}/platform/servers${query}`);
  }

  /* ---------------- MOBILE APP CONFIGURATION & CONTROL ---------------- */
  async getConfig(): Promise<MobileAppConfig> {
    return request<MobileAppConfig>(`${API_PREFIX}/mobile/config`);
  }

  async updateConfig(input: UpdateMobileAppConfigRequest): Promise<MobileAppConfig> {
    return request<MobileAppConfig>(`${API_PREFIX}/mobile/config`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async getFeatures(): Promise<MobileFeatureFlag[]> {
    return request<MobileFeatureFlag[]>(`${API_PREFIX}/mobile/features`);
  }

  async updateFeature(key: string, input: UpdateMobileFeatureFlagRequest): Promise<MobileFeatureFlag> {
    return request<MobileFeatureFlag>(`${API_PREFIX}/mobile/features/${key}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async getNavigation(): Promise<MobileNavigationItem[]> {
    return request<MobileNavigationItem[]>(`${API_PREFIX}/mobile/navigation`);
  }

  async updateNavigation(items: MobileNavigationItem[]): Promise<MobileNavigationItem[]> {
    return request<MobileNavigationItem[]>(`${API_PREFIX}/mobile/navigation`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  }

  async getHome(): Promise<MobileHomeSection[]> {
    return request<MobileHomeSection[]>(`${API_PREFIX}/mobile/home`);
  }

  async updateHome(sections: MobileHomeSection[]): Promise<MobileHomeSection[]> {
    return request<MobileHomeSection[]>(`${API_PREFIX}/mobile/home`, {
      method: 'PUT',
      body: JSON.stringify({ sections }),
    });
  }

  async getVersions(): Promise<MobileAppVersion[]> {
    return request<MobileAppVersion[]>(`${API_PREFIX}/mobile/versions`);
  }

  async updateVersion(platform: string, input: UpdateMobileAppVersionRequest): Promise<MobileAppVersion> {
    return request<MobileAppVersion>(`${API_PREFIX}/mobile/versions/${platform}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async getAnnouncements(): Promise<MobileAnnouncement[]> {
    return request<MobileAnnouncement[]>(`${API_PREFIX}/mobile/announcements`);
  }

  async createAnnouncement(input: CreateMobileAnnouncementRequest): Promise<MobileAnnouncement> {
    return request<MobileAnnouncement>(`${API_PREFIX}/mobile/announcements`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateAnnouncement(id: string, input: Partial<CreateMobileAnnouncementRequest>): Promise<MobileAnnouncement> {
    return request<MobileAnnouncement>(`${API_PREFIX}/mobile/announcements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await request(`${API_PREFIX}/mobile/announcements/${id}`, {
      method: 'DELETE',
    });
  }

  async getAuditLogs(): Promise<MobileAuditLogResponse[]> {
    return request<MobileAuditLogResponse[]>(`${API_PREFIX}/mobile/audit-logs`);
  }

  clearAdminCache(): void {
    localStorage.removeItem(TOKEN_KEY);
    const legacyKeys = [
      'dp_admin_dev_users_v2',
      'dp_admin_dev_domains_v2',
      'dp_admin_dev_servers_v2',
      'dp_admin_dev_config',
      'dp_admin_dev_features',
      'dp_admin_dev_navigation',
      'dp_admin_dev_home',
      'dp_admin_dev_versions',
      'dp_admin_dev_announcements',
      'dp_admin_dev_audit_logs',
    ];
    legacyKeys.forEach((key) => localStorage.removeItem(key));
  }
}

export const adminClient = new AdminClient();
export const mobileAdminClient = adminClient;
