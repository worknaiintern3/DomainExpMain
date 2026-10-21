import { beforeEach, describe, expect, it } from 'vitest';

import {
  THEME_STORAGE_KEY,
  applyTheme,
  readThemePreference,
  setThemePreference,
} from '@/lib/theme';

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light when nothing is stored or the value is invalid', () => {
    expect(readThemePreference()).toBe('light');
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readThemePreference()).toBe('light');
  });

  it('dark adds the dark class, light removes it, and the choice is remembered', () => {
    setThemePreference('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(readThemePreference()).toBe('dark');

    setThemePreference('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(readThemePreference()).toBe('light');
  });

  it('system follows the OS preference', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      addEventListener: () => undefined,
      matches: query.includes('dark'),
      media: query,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    try {
      applyTheme('system');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });
});
