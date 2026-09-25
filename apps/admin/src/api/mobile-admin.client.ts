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

const API_PREFIX = '/api/v1/admin/mobile';
const TOKEN_KEY = 'domainpulse_admin_token';

// Local storage keys for development / offline state
const STORAGE_KEYS = {
  config: 'dp_admin_dev_config',
  features: 'dp_admin_dev_features',
  navigation: 'dp_admin_dev_navigation',
  home: 'dp_admin_dev_home',
  versions: 'dp_admin_dev_versions',
  announcements: 'dp_admin_dev_announcements',
  auditLogs: 'dp_admin_dev_audit_logs',
};

const DEFAULT_APP_CONFIG: MobileAppConfig = {
  appName: 'DomainPulse',
  logoUrl: null,
  primaryColor: '#00E5FF',
  secondaryColor: '#0D222E',
  maintenanceMode: false,
  maintenanceMessage: null,
};

const DEFAULT_FEATURE_FLAGS: MobileFeatureFlag[] = [
  { key: 'domains', name: 'Domains', description: 'Domain Portfolio Management', enabled: true, minAppVersion: null },
  { key: 'servers', name: 'Servers', description: 'Infrastructure & VPS Tracking', enabled: true, minAppVersion: null },
  { key: 'websites', name: 'Websites', description: 'Web Applications', enabled: true, minAppVersion: null },
  { key: 'alerts', name: 'Alerts', description: 'Domain & SSL Expiry Alerts', enabled: true, minAppVersion: null },
  { key: 'providers', name: 'Providers', description: 'Connected Registrar Accounts', enabled: true, minAppVersion: null },
  { key: 'infrastructureMap', name: 'Infrastructure Map', description: 'Full Visual Graph', enabled: true, minAppVersion: null },
  { key: 'aiDomainFinder', name: 'AI Domain Finder', description: 'Smart Search & Suggestions', enabled: true, minAppVersion: null },
];

const DEFAULT_NAVIGATION: MobileNavigationItem[] = [
  { key: 'home', label: 'Home', icon: 'home', route: '/home', sortOrder: 1, enabled: true, badge: null },
  { key: 'domains', label: 'Domains', icon: 'globe', route: '/domains', sortOrder: 2, enabled: true, badge: null },
  { key: 'alerts', label: 'Alerts', icon: 'bell', route: '/alerts', sortOrder: 3, enabled: true, badge: null },
  { key: 'settings', label: 'Settings', icon: 'settings', route: '/settings', sortOrder: 4, enabled: true, badge: null },
];

const DEFAULT_HOME_SECTIONS: MobileHomeSection[] = [
  { sectionKey: 'banner', title: 'Announcements', sortOrder: 1, enabled: true, configJson: null },
  { sectionKey: 'stats', title: 'Portfolio Overview', sortOrder: 2, enabled: true, configJson: null },
  { sectionKey: 'quickActions', title: 'Quick Actions', sortOrder: 3, enabled: true, configJson: null },
  { sectionKey: 'alerts', title: 'Urgent Alerts', sortOrder: 4, enabled: true, configJson: null },
  { sectionKey: 'domains', title: 'Expiring Domains', sortOrder: 5, enabled: true, configJson: null },
  { sectionKey: 'servers', title: 'Active Servers', sortOrder: 6, enabled: true, configJson: null },
];

const DEFAULT_VERSIONS: MobileAppVersion[] = [
  {
    platform: 'all',
    minimumVersion: '1.0.0',
    latestVersion: '1.0.0',
    forceUpdate: false,
    updateUrl: null,
    releaseNotes: 'Welcome to DomainPulse Mobile',
  },
];

function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    throw new Error('401: Authentication required (No admin token)');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'API request failed';
    try {
      const body = await response.json();
      errorDetail = body.detail || body.message || response.statusText;
    } catch {
      // fallback
    }
    throw new Error(`${response.status}: ${errorDetail}`);
  }

  return (await response.json()) as T;
}

export const mobileAdminClient = {
  // Auth Helpers
  hasToken: () => Boolean(localStorage.getItem(TOKEN_KEY)),
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  login: async (email: string, pass: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!res.ok) {
      let msg = 'Authentication failed';
      try {
        const body = await res.json();
        msg = body.detail || body.message || res.statusText;
      } catch {
        // fallback
      }
      throw new Error(msg);
    }
    const data = await res.json();
    if (data?.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
    }
    return data;
  },

  // App Config
  getConfig: async (): Promise<MobileAppConfig> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileAppConfig>('/config');
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    return getStored<MobileAppConfig>(STORAGE_KEYS.config, DEFAULT_APP_CONFIG);
  },

  updateConfig: async (body: UpdateMobileAppConfigRequest): Promise<MobileAppConfig> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileAppConfig>('/config', {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    const current = getStored<MobileAppConfig>(STORAGE_KEYS.config, DEFAULT_APP_CONFIG);
    const updated: MobileAppConfig = {
      ...current,
      ...(body.appName !== undefined ? { appName: body.appName } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.primaryColor !== undefined ? { primaryColor: body.primaryColor } : {}),
      ...(body.secondaryColor !== undefined ? { secondaryColor: body.secondaryColor } : {}),
      ...(body.maintenanceMode !== undefined ? { maintenanceMode: body.maintenanceMode } : {}),
      ...(body.maintenanceMessage !== undefined ? { maintenanceMessage: body.maintenanceMessage } : {}),
    };
    setStored(STORAGE_KEYS.config, updated);
    return updated;
  },

  // Features
  getFeatures: async (): Promise<MobileFeatureFlag[]> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileFeatureFlag[]>('/features');
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    return getStored<MobileFeatureFlag[]>(STORAGE_KEYS.features, DEFAULT_FEATURE_FLAGS);
  },

  updateFeature: async (key: string, body: UpdateMobileFeatureFlagRequest): Promise<MobileFeatureFlag> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileFeatureFlag>(`/features/${key}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    const features = getStored<MobileFeatureFlag[]>(STORAGE_KEYS.features, DEFAULT_FEATURE_FLAGS);
    const idx = features.findIndex((f) => f.key === key);
    if (idx >= 0) {
      const target = features[idx];
      if (target) {
        if (body.enabled !== undefined) target.enabled = body.enabled;
        if (body.minAppVersion !== undefined) target.minAppVersion = body.minAppVersion;
        if (body.description !== undefined) target.description = body.description;
        setStored(STORAGE_KEYS.features, [...features]);
        return target;
      }
    }
    throw new Error(`Feature flag ${key} not found`);
  },

  // Navigation
  getNavigation: async (): Promise<MobileNavigationItem[]> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileNavigationItem[]>('/navigation');
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    return getStored<MobileNavigationItem[]>(STORAGE_KEYS.navigation, DEFAULT_NAVIGATION);
  },

  updateNavigation: async (items: MobileNavigationItem[]): Promise<MobileNavigationItem[]> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileNavigationItem[]>('/navigation', {
          method: 'PUT',
          body: JSON.stringify({ items }),
        });
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    setStored(STORAGE_KEYS.navigation, items);
    return items;
  },

  // Home Layout
  getHomeConfig: async (): Promise<MobileHomeSection[]> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileHomeSection[]>('/home');
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    return getStored<MobileHomeSection[]>(STORAGE_KEYS.home, DEFAULT_HOME_SECTIONS);
  },

  updateHomeConfig: async (sections: MobileHomeSection[]): Promise<MobileHomeSection[]> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileHomeSection[]>('/home', {
          method: 'PUT',
          body: JSON.stringify({ sections }),
        });
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    setStored(STORAGE_KEYS.home, sections);
    return sections;
  },

  // Versions
  getVersions: async (): Promise<MobileAppVersion[]> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileAppVersion[]>('/versions');
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    return getStored<MobileAppVersion[]>(STORAGE_KEYS.versions, DEFAULT_VERSIONS);
  },

  updateVersion: async (platform: string, body: UpdateMobileAppVersionRequest): Promise<MobileAppVersion> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileAppVersion>(`/versions/${platform}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    const versions = getStored<MobileAppVersion[]>(STORAGE_KEYS.versions, DEFAULT_VERSIONS);
    const target = versions.find((v) => v.platform === platform) || versions[0];
    if (target) {
      if (body.minimumVersion !== undefined) target.minimumVersion = body.minimumVersion;
      if (body.latestVersion !== undefined) target.latestVersion = body.latestVersion;
      if (body.forceUpdate !== undefined) target.forceUpdate = body.forceUpdate;
      if (body.updateUrl !== undefined) target.updateUrl = body.updateUrl;
      if (body.releaseNotes !== undefined) target.releaseNotes = body.releaseNotes;
      setStored(STORAGE_KEYS.versions, [...versions]);
      return target;
    }
    throw new Error(`Version config for ${platform} not found`);
  },

  // Announcements
  getAnnouncements: async (): Promise<MobileAnnouncement[]> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileAnnouncement[]>('/announcements');
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    return getStored<MobileAnnouncement[]>(STORAGE_KEYS.announcements, []);
  },

  createAnnouncement: async (body: CreateMobileAnnouncementRequest): Promise<MobileAnnouncement> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileAnnouncement>('/announcements', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    const current = getStored<MobileAnnouncement[]>(STORAGE_KEYS.announcements, []);
    const newAnnouncement: MobileAnnouncement = {
      id: `dev-announcement-${Date.now()}`,
      title: body.title,
      message: body.message,
      type: body.type || 'info',
      isActive: body.isActive ?? true,
      actionUrl: body.actionUrl || null,
      actionLabel: body.actionLabel || null,
      startsAt: body.startsAt || null,
      expiresAt: body.expiresAt || null,
    };
    setStored(STORAGE_KEYS.announcements, [newAnnouncement, ...current]);
    return newAnnouncement;
  },

  deleteAnnouncement: async (id: string): Promise<{ success: boolean }> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<{ success: boolean }>(`/announcements/${id}`, {
          method: 'DELETE',
        });
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    const current = getStored<MobileAnnouncement[]>(STORAGE_KEYS.announcements, []);
    setStored(STORAGE_KEYS.announcements, current.filter((a) => a.id !== id));
    return { success: true };
  },

  // Audit Logs
  getAuditLogs: async (): Promise<MobileAuditLogResponse[]> => {
    if (mobileAdminClient.hasToken()) {
      try {
        return await request<MobileAuditLogResponse[]>('/audit-logs');
      } catch (err: any) {
        if (!err.message?.includes('401')) throw err;
      }
    }
    return getStored<MobileAuditLogResponse[]>(STORAGE_KEYS.auditLogs, [
      {
        id: 'log-1',
        action: 'CONFIG_BOOTSTRAP',
        target: 'MOBILE_ADMIN',
        details: 'Local Development Environment Initialized',
        userId: 'dev-admin',
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
      },
    ]);
  },
};
