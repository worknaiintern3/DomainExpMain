import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { getItem, setItem } from '../services/storage';
import { getEffectiveApiUrl } from '../services/api';

const REMOTE_CONFIG_CACHE_KEY = '@domainpulse_mobile_remote_config';
const CURRENT_APP_VERSION = '1.0.4';

export interface RemoteAppConfig {
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
}

export interface RemoteFeatureFlag {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  minAppVersion?: string | null;
}

export interface RemoteNavigationItem {
  key: string;
  label: string;
  icon: string;
  route: string;
  sortOrder: number;
  enabled: boolean;
  badge?: string | null;
}

export interface RemoteHomeSection {
  sectionKey: string;
  title: string;
  sortOrder: number;
  enabled: boolean;
  isVisible?: boolean;
  configJson?: Record<string, unknown> | null;
}

export interface RemoteAppVersion {
  platform: 'ios' | 'android' | 'all';
  minimumVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  updateUrl: string | null;
  releaseNotes: string | null;
}

export interface RemoteAnnouncement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'promo';
  actionUrl?: string | null;
  actionLabel?: string | null;
  actionText?: string | null;
  isActive: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
}

export interface RemoteBootstrapConfig {
  app: RemoteAppConfig;
  features: Record<string, boolean>;
  featureFlags: RemoteFeatureFlag[];
  navigation: RemoteNavigationItem[];
  homeSections: RemoteHomeSection[];
  version: RemoteAppVersion;
  announcements: RemoteAnnouncement[];
}

const DEFAULT_CONFIG: RemoteBootstrapConfig = {
  app: {
    appName: 'DomainPulse',
    logoUrl: null,
    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
    maintenanceMode: false,
    maintenanceMessage: null,
  },
  features: {
    domains: true,
    servers: true,
    websites: true,
    alerts: true,
    providers: true,
    infrastructureMap: true,
    aiDomainFinder: true,
  },
  featureFlags: [
    { key: 'domains', name: 'Domains', description: 'Domain portfolio tracking & DNS management', enabled: true },
    { key: 'servers', name: 'Servers', description: 'Cloud servers, VPS & infrastructure telemetry', enabled: true },
    { key: 'websites', name: 'Websites', description: 'Web applications and hosted website monitoring', enabled: true },
    { key: 'alerts', name: 'Alerts', description: 'Domain and SSL expiry push notifications', enabled: true },
    { key: 'providers', name: 'Providers', description: 'Connected registrar & cloud accounts sync', enabled: true },
    { key: 'infrastructureMap', name: 'Infrastructure Map', description: 'Interactive visual architecture topology graph', enabled: true },
    { key: 'aiDomainFinder', name: 'AI Domain Finder', description: 'AI brand generator & availability search', enabled: true },
  ],
  navigation: [
    { key: 'home', label: 'Home', icon: 'home', route: '/home', sortOrder: 1, enabled: true },
    { key: 'domains', label: 'Domains', icon: 'globe', route: '/domains', sortOrder: 2, enabled: true },
    { key: 'servers', label: 'Servers', icon: 'server', route: '/servers', sortOrder: 3, enabled: true },
    { key: 'applications', label: 'Apps', icon: 'grid', route: '/applications', sortOrder: 4, enabled: true },
    { key: 'more', label: 'More', icon: 'settings', route: '/settings', sortOrder: 5, enabled: true },
  ],
  homeSections: [
    { sectionKey: 'banner', title: 'Announcements', sortOrder: 1, enabled: true },
    { sectionKey: 'stats', title: 'Portfolio Overview', sortOrder: 2, enabled: true },
    { sectionKey: 'quickActions', title: 'Quick Connect', sortOrder: 3, enabled: true },
    { sectionKey: 'alerts', title: 'Recent Activity', sortOrder: 4, enabled: true },
  ],
  version: {
    platform: 'all',
    minimumVersion: '1.0.0',
    latestVersion: '1.0.4',
    forceUpdate: false,
    updateUrl: 'https://play.google.com/store/apps/details?id=com.domainpulse.mobile',
    releaseNotes: 'Welcome to DomainPulse Mobile v1.0.4.',
  },
  announcements: [],
};

interface RemoteConfigContextType {
  config: RemoteBootstrapConfig;
  features: Record<string, boolean>;
  isFeatureEnabled: (key: string) => boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  announcements: RemoteAnnouncement[];
  homeSections: RemoteHomeSection[];
  navigationItems: RemoteNavigationItem[];
  versionPolicy: RemoteAppVersion;
  isUpdateRequired: boolean;
  appBranding: RemoteAppConfig;
  isLoading: boolean;
  refreshConfig: () => Promise<void>;
}

const RemoteConfigContext = createContext<RemoteConfigContextType | undefined>(undefined);

function compareSemanticVersions(a: string, b: string): number {
  const partsA = a.split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = b.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const valA = partsA[i] || 0;
    const valB = partsB[i] || 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }
  return 0;
}

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<RemoteBootstrapConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRemoteConfig = useCallback(async () => {
    try {
      const baseUrl = getEffectiveApiUrl();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${baseUrl}/mobile/config`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as RemoteBootstrapConfig;
        if (data && data.app && data.features) {
          setConfig(data);
          // Persist to local cache for instant boot next time
          setItem(REMOTE_CONFIG_CACHE_KEY, JSON.stringify(data)).catch(() => {});
          return;
        }
      }
    } catch {
      // Offline or network error -> fallback to cache or defaults
    }

    // Try loading cached config
    try {
      const cached = await getItem(REMOTE_CONFIG_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as RemoteBootstrapConfig;
        if (parsed?.app && parsed?.features) {
          setConfig(parsed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchRemoteConfig().finally(() => setIsLoading(false));
  }, [fetchRemoteConfig]);

  const isFeatureEnabled = useCallback(
    (key: string): boolean => {
      if (config.features && typeof config.features[key] === 'boolean') {
        return config.features[key];
      }
      const flag = config.featureFlags?.find((f) => f.key === key);
      return flag ? flag.enabled : true;
    },
    [config.features, config.featureFlags],
  );

  const isUpdateRequired = useMemo(() => {
    if (!config.version?.forceUpdate) return false;
    const minVer = config.version.minimumVersion || '1.0.0';
    return compareSemanticVersions(CURRENT_APP_VERSION, minVer) < 0;
  }, [config.version]);

  const value = useMemo(
    () => ({
      config,
      features: config.features || DEFAULT_CONFIG.features,
      isFeatureEnabled,
      maintenanceMode: Boolean(config.app?.maintenanceMode),
      maintenanceMessage: config.app?.maintenanceMessage || null,
      announcements: (config.announcements || []).filter((a) => a.isActive),
      homeSections: (config.homeSections || DEFAULT_CONFIG.homeSections).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
      navigationItems: (config.navigation || DEFAULT_CONFIG.navigation).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
      versionPolicy: config.version || DEFAULT_CONFIG.version,
      isUpdateRequired,
      appBranding: config.app || DEFAULT_CONFIG.app,
      isLoading,
      refreshConfig: fetchRemoteConfig,
    }),
    [config, isFeatureEnabled, isUpdateRequired, isLoading, fetchRemoteConfig],
  );

  return (
    <RemoteConfigContext.Provider value={value}>
      {children}
    </RemoteConfigContext.Provider>
  );
}

export function useRemoteConfig(): RemoteConfigContextType {
  const context = useContext(RemoteConfigContext);
  if (!context) {
    throw new Error('useRemoteConfig must be used within a RemoteConfigProvider');
  }
  return context;
}
