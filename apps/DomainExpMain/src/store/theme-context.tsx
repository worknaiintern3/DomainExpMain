import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import { Colors, type ThemeType, type ThemeMode } from '../constants/theme';
import { getItem, setItem } from '../services/storage';

const THEME_STORAGE_KEY = 'dp_theme_mode';

interface ThemeContextValue {
  theme: ThemeType;
  themeMode: ThemeMode;
  isDark: boolean;
  colors: typeof Colors.dark;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useDeviceColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    let isMounted = true;
    getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (isMounted && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setThemeModeState(saved as ThemeMode);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const theme: ThemeType = useMemo(() => {
    if (themeMode === 'system') {
      return deviceColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode === 'dark' ? 'dark' : 'light';
  }, [themeMode, deviceColorScheme]);

  const isDark = theme === 'dark';

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      const currentResolved = prev === 'system' ? (deviceColorScheme === 'dark' ? 'dark' : 'light') : prev;
      const next: ThemeMode = currentResolved === 'dark' ? 'light' : 'dark';
      setItem(THEME_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, [deviceColorScheme]);

  const colors = useMemo(() => (isDark ? Colors.dark : Colors.light), [isDark]);

  const value = useMemo(
    () => ({
      theme,
      themeMode,
      isDark,
      colors,
      setThemeMode,
      toggleTheme,
    }),
    [theme, themeMode, isDark, colors, setThemeMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
