import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getSettings,
  saveGeneralSettings,
  saveDiscoverySettings,
  savePortfolioSettings,
  type DiscoverySettingsPayload,
  type GeneralSettingsPayload,
  type PortfolioSettingsPayload,
} from '@/api/settings';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { configureExpiryThresholds } from '@/lib/expiry';
import { configureFormatting } from '@/lib/format';
import { clearRecentSearches } from '@/lib/recentSearches';

type LoadStatus = 'error' | 'loading' | 'ready';

export const DEFAULT_GENERAL: GeneralSettingsPayload = {
  dateFormat: 'DD MMM YYYY',
  defaultLandingPage: '/overview',
  displayName: null,
  rowsPerPage: 20,
  timezone: 'Asia/Kolkata',
  workspaceName: 'Personal workspace',
};

export const DEFAULT_PORTFOLIO: PortfolioSettingsPayload = {
  autoFetchMetadataOnCreation: true,
  automaticMetadataRefresh: 'on-open',
  criticalThresholdDays: 7,
  defaultAutoRenew: 'unknown',
  metadataSources: { dns: true, http: true, infra: true, rdap: true, tls: true },
  warningThresholdDays: 30,
};

export const DEFAULT_DISCOVERY: DiscoverySettingsPayload = {
  availabilityCheckMode: 'selected',
  defaultCheckedTlds: ['.com', '.in', '.co.in', '.ai', '.io', '.dev', '.app', '.tech'],
  defaultSearchSort: 'availability',
  savedSearchHistory: true,
};

interface PreferencesContextValue {
  discovery: DiscoverySettingsPayload;
  general: GeneralSettingsPayload;
  portfolio: PortfolioSettingsPayload;
  role: 'owner' | 'admin' | 'member' | null;
  /** Reloads from the server; used by the Settings page after errors. */
  reload(): Promise<void>;
  saveGeneral(input: GeneralSettingsPayload): Promise<void>;
  saveDiscovery(input: DiscoverySettingsPayload): Promise<void>;
  savePortfolio(input: PortfolioSettingsPayload): Promise<void>;
  status: LoadStatus;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

type SavedPreferences = {
  discovery: DiscoverySettingsPayload;
  general: GeneralSettingsPayload;
  portfolio: PortfolioSettingsPayload;
};

const storageKey = (userId: string) => `domainpulse:preferences:${userId}`;

function readDevicePreferences(userId: string, displayName: string | null): SavedPreferences {
  let saved: Partial<SavedPreferences> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      saved = parsed as Partial<SavedPreferences>;
    }
  } catch {
    // Use defaults when local storage is unavailable or contains invalid data.
  }
  return {
    discovery: { ...DEFAULT_DISCOVERY, ...saved.discovery },
    general: { ...DEFAULT_GENERAL, displayName, ...saved.general },
    portfolio: {
      ...DEFAULT_PORTFOLIO,
      ...saved.portfolio,
      metadataSources: { ...DEFAULT_PORTFOLIO.metadataSources, ...saved.portfolio?.metadataSources },
    },
  };
}

function writeDevicePreferences(userId: string, preferences: SavedPreferences): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(preferences));
}

function applyAll(general: GeneralSettingsPayload, portfolio: PortfolioSettingsPayload): void {
  configureFormatting({
    dateFormat: general.dateFormat,
    timeZone: general.timezone,
  });
  configureExpiryThresholds({
    criticalDays: portfolio.criticalThresholdDays,
    warningDays: portfolio.warningThresholdDays,
  });
}

/** Loads the signed-in user's saved Settings once per session and exposes them app-wide. */
export const PreferencesProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { status: authStatus, sessionScopeKey, user } = useAuth();
  const userId = user?.id;
  const userDisplayName = user?.displayName ?? null;
  const [general, setGeneral] = useState<GeneralSettingsPayload>(DEFAULT_GENERAL);
  const [portfolio, setPortfolio] = useState<PortfolioSettingsPayload>(DEFAULT_PORTFOLIO);
  const [discovery, setDiscovery] = useState<DiscoverySettingsPayload>(DEFAULT_DISCOVERY);
  const [role, setRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [deviceSettings, setDeviceSettings] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await getSettings(signal);
      applyAll(response.general, response.portfolio);
      if (!response.discovery.savedSearchHistory) clearRecentSearches();
      setGeneral(response.general);
      setPortfolio(response.portfolio);
      setDiscovery(response.discovery);
      setRole(response.role);
      setDeviceSettings(false);
      setStatus('ready');
    } catch (error) {
      if (signal?.aborted) return;
      if (error instanceof ApiError && error.status === 404 && userId) {
        const saved = readDevicePreferences(userId, userDisplayName);
        applyAll(saved.general, saved.portfolio);
        if (!saved.discovery.savedSearchHistory) clearRecentSearches();
        setGeneral(saved.general);
        setPortfolio(saved.portfolio);
        setDiscovery(saved.discovery);
        setRole(null);
        setDeviceSettings(true);
        setStatus('ready');
        return;
      }
      setStatus('error');
    }
  }, [userId, userDisplayName]);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      applyAll(DEFAULT_GENERAL, DEFAULT_PORTFOLIO);
      setGeneral(DEFAULT_GENERAL);
      setPortfolio(DEFAULT_PORTFOLIO);
      setDiscovery(DEFAULT_DISCOVERY);
      setRole(null);
      setDeviceSettings(false);
      setStatus('loading');
      return undefined;
    }

    const controller = new AbortController();
    setStatus('loading');
    setRole(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [authStatus, load, sessionScopeKey]);

  const saveGeneral = useCallback(async (input: GeneralSettingsPayload) => {
    const response = deviceSettings && userId
      ? { general: input, portfolio, discovery }
      : await saveGeneralSettings(input);
    if (deviceSettings && userId) writeDevicePreferences(userId, response);
    applyAll(response.general, response.portfolio);
    setGeneral(response.general);
    setPortfolio(response.portfolio);
    setDiscovery(response.discovery);
    setStatus('ready');
  }, [deviceSettings, userId, portfolio, discovery]);

  const savePortfolio = useCallback(async (input: PortfolioSettingsPayload) => {
    const response = deviceSettings && userId
      ? { general, portfolio: input, discovery }
      : await savePortfolioSettings(input);
    if (deviceSettings && userId) writeDevicePreferences(userId, response);
    applyAll(response.general, response.portfolio);
    setGeneral(response.general);
    setPortfolio(response.portfolio);
    setDiscovery(response.discovery);
    setStatus('ready');
  }, [deviceSettings, userId, general, discovery]);

  const saveDiscovery = useCallback(async (input: DiscoverySettingsPayload) => {
    const response = deviceSettings && userId
      ? { general, portfolio, discovery: input }
      : await saveDiscoverySettings(input);
    if (deviceSettings && userId) writeDevicePreferences(userId, response);
    applyAll(response.general, response.portfolio);
    if (!response.discovery.savedSearchHistory) clearRecentSearches();
    setGeneral(response.general);
    setPortfolio(response.portfolio);
    setDiscovery(response.discovery);
    setStatus('ready');
  }, [deviceSettings, userId, general, portfolio]);

  const reload = useCallback(async () => {
    setStatus('loading');
    setRole(null);
    await load();
  }, [load]);

  const value = useMemo<PreferencesContextValue>(
    () => ({ discovery, general, portfolio, role, reload, saveDiscovery, saveGeneral, savePortfolio, status }),
    [discovery, general, portfolio, role, reload, saveDiscovery, saveGeneral, savePortfolio, status],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider');
  return context;
}
