/**
 * Light / dark / system theme. A UI preference only: it is stored in
 * localStorage (never credentials) and applied by toggling the `dark` class on
 * <html>, which switches the CSS colour variables defined in index.css.
 * The same logic is inlined in index.html so the first paint has no flash.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'domainpulse.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'system' || value === 'light' ? value : 'light';
  } catch {
    return 'light';
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function applyTheme(preference: ThemePreference): void {
  const dark = preference === 'dark' || (preference === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // A blocked store just means the choice is not remembered next visit.
  }
  applyTheme(preference);
}

/** Persist a Settings draft on Save; unlike preview, storage failures reach the caller. */
export function saveThemePreference(preference: ThemePreference): void {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyTheme(preference);
}

/** Applies the stored preference and follows OS changes while it is 'system'. */
export function initTheme(): void {
  applyTheme(readThemePreference());
  if (typeof window.matchMedia !== 'function') return;
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (readThemePreference() === 'system') applyTheme('system');
  });
}
