import React, { createContext, useContext, useEffect, useState } from 'react';
import { getUserItem, setUserItem, STORAGE_KEYS } from '../services/storage';

export interface AppSettings {
  currency: string;
  currencySymbol: string;
  pushAlerts: boolean;
  expiryReminders: boolean;
  weeklyDigest: boolean;
}

interface SettingsContextValue extends AppSettings {
  setCurrency: (curr: string) => Promise<void>;
  setPushAlerts: (val: boolean) => Promise<void>;
  setExpiryReminders: (val: boolean) => Promise<void>;
  setWeeklyDigest: (val: boolean) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  currency: '₹ (INR)',
  currencySymbol: '₹',
  pushAlerts: true,
  expiryReminders: true,
  weeklyDigest: false,
};

function getSymbol(currencyString: string): string {
  if (currencyString.includes('₹') || currencyString.includes('INR')) return '₹';
  if (currencyString.includes('€') || currencyString.includes('EUR')) return '€';
  if (currencyString.includes('£') || currencyString.includes('GBP')) return '£';
  if (currencyString.includes('$') || currencyString.includes('USD')) return '$';
  return '₹';
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    async function loadSettings() {
      try {
        const raw = await getUserItem(STORAGE_KEYS.SETTINGS);
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings({
            currency: parsed.currency || DEFAULT_SETTINGS.currency,
            currencySymbol: getSymbol(parsed.currency || DEFAULT_SETTINGS.currency),
            pushAlerts: parsed.pushAlerts !== undefined ? parsed.pushAlerts : DEFAULT_SETTINGS.pushAlerts,
            expiryReminders: parsed.expiryReminders !== undefined ? parsed.expiryReminders : DEFAULT_SETTINGS.expiryReminders,
            weeklyDigest: parsed.weeklyDigest !== undefined ? parsed.weeklyDigest : DEFAULT_SETTINGS.weeklyDigest,
          });
        }
      } catch {
        // ignore
      }
    }
    loadSettings();
  }, []);

  const saveSettings = async (next: Partial<AppSettings>) => {
    const updated: AppSettings = {
      ...settings,
      ...next,
      currencySymbol: next.currency ? getSymbol(next.currency) : settings.currencySymbol,
    };
    setSettings(updated);
    try {
      await setUserItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const setCurrency = async (curr: string) => {
    await saveSettings({ currency: curr });
  };

  const setPushAlerts = async (val: boolean) => {
    await saveSettings({ pushAlerts: val });
  };

  const setExpiryReminders = async (val: boolean) => {
    await saveSettings({ expiryReminders: val });
  };

  const setWeeklyDigest = async (val: boolean) => {
    await saveSettings({ weeklyDigest: val });
  };

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        setCurrency,
        setPushAlerts,
        setExpiryReminders,
        setWeeklyDigest,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      ...DEFAULT_SETTINGS,
      setCurrency: async () => {},
      setPushAlerts: async () => {},
      setExpiryReminders: async () => {},
      setWeeklyDigest: async () => {},
    };
  }
  return context;
}
