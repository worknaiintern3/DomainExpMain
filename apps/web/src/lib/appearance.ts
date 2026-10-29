import { useSyncExternalStore } from 'react';

import type {
  AppearanceSettings,
  InterfaceFontOption,
  MonoFontOption,
} from '@/features/settings/settings.types';
import { DEFAULT_SETTINGS } from '@/features/settings/settings.reference';

/**
 * Interface density, sidebar, table rows, fonts and motion. A UI preference only:
 * stored in localStorage (never credentials) and applied via data attributes
 * and CSS variables on <html> (see index.css) plus a subscribed collapsed flag
 * for the sidebar. Theme lives separately in lib/theme.ts.
 */

const STORAGE_KEY = 'domainpulse.appearance';
const MANUAL_SIDEBAR_KEY = 'domainpulse.sidebar-collapsed';
const EVENT_NAME = 'domainpulse:appearance';

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined') {
    window.addEventListener(EVENT_NAME, listener);
    window.addEventListener('storage', listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener(EVENT_NAME, listener);
      window.removeEventListener('storage', listener);
    }
  };
}

export const INTERFACE_FONT_FAMILIES: Record<InterfaceFontOption, string> = {
  Inter: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Roboto: "'Roboto', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  Outfit: "'Outfit', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'Plus Jakarta Sans': "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'System Sans': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export const MONO_FONT_FAMILIES: Record<MonoFontOption, string> = {
  'JetBrains Mono': "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  'Fira Code': "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  'Roboto Mono': "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  'Source Code Pro': "'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const VALID_INTERFACE_FONTS: readonly InterfaceFontOption[] = [
  'Inter',
  'Roboto',
  'Outfit',
  'Plus Jakarta Sans',
  'System Sans',
];

const VALID_MONO_FONTS: readonly MonoFontOption[] = [
  'JetBrains Mono',
  'Fira Code',
  'Roboto Mono',
  'Source Code Pro',
];

export function defaultAppearancePreferences(): AppearanceSettings {
  return { ...DEFAULT_SETTINGS.appearance };
}

function parseStored(raw: string | null): AppearanceSettings {
  const fallback = defaultAppearancePreferences();
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const record = parsed as Record<string, unknown>;

    const interfaceFont =
      typeof record.interfaceFont === 'string' &&
      VALID_INTERFACE_FONTS.includes(record.interfaceFont as InterfaceFontOption)
        ? (record.interfaceFont as InterfaceFontOption)
        : fallback.interfaceFont;

    const monoDataFont =
      typeof record.monoDataFont === 'string' &&
      VALID_MONO_FONTS.includes(record.monoDataFont as MonoFontOption)
        ? (record.monoDataFont as MonoFontOption)
        : fallback.monoDataFont;

    return {
      theme: fallback.theme,
      density: record.density === 'comfortable' ? 'comfortable' : 'compact',
      sidebar:
        record.sidebar === 'collapsed' || record.sidebar === 'remember'
          ? record.sidebar
          : 'expanded',
      tableRowDensity: record.tableRowDensity === 'standard' ? 'standard' : 'compact',
      monoDataFont,
      interfaceFont,
      microInteractions:
        typeof record.microInteractions === 'boolean'
          ? record.microInteractions
          : fallback.microInteractions,
      respectReducedMotion:
        typeof record.respectReducedMotion === 'boolean'
          ? record.respectReducedMotion
          : fallback.respectReducedMotion,
    };
  } catch {
    return fallback;
  }
}

export function loadAppearancePreferences(): AppearanceSettings {
  try {
    return parseStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultAppearancePreferences();
  }
}

export function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** True when animations/transitions should be suppressed. */
export function motionReducedFor(
  prefs: Pick<AppearanceSettings, 'microInteractions' | 'respectReducedMotion'>,
): boolean {
  if (!prefs.microInteractions) return true;
  return prefs.respectReducedMotion && systemPrefersReducedMotion();
}

export function applyAppearancePreferences(
  prefs: Pick<
    AppearanceSettings,
    'density' | 'sidebar' | 'tableRowDensity' | 'microInteractions' | 'respectReducedMotion'
  > &
    Partial<Pick<AppearanceSettings, 'interfaceFont' | 'monoDataFont'>>,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.density = prefs.density;
  root.dataset.tableDensity = prefs.tableRowDensity;
  root.dataset.motion = motionReducedFor(prefs) ? 'reduced' : 'full';
  root.dataset.sidebar = resolveSidebarCollapsed(prefs) ? 'collapsed' : 'expanded';

  const iface = prefs.interfaceFont ?? 'Inter';
  const mono = prefs.monoDataFont ?? 'JetBrains Mono';
  root.dataset.interfaceFont = iface;
  root.dataset.monoFont = mono;

  const ifaceFamily = INTERFACE_FONT_FAMILIES[iface] || INTERFACE_FONT_FAMILIES.Inter;
  const monoFamily = MONO_FONT_FAMILIES[mono] || MONO_FONT_FAMILIES['JetBrains Mono'];

  root.style.setProperty('--font-interface', ifaceFamily);
  root.style.setProperty('--font-mono-data', monoFamily);
}

let previewOverrides: AppearanceSettings | null = null;

export function previewAppearancePreferences(prefs: AppearanceSettings): void {
  previewOverrides = prefs;
  applyAppearancePreferences(prefs);
  notify();
}

export function clearAppearancePreview(): void {
  previewOverrides = null;
  applyAppearancePreferences(loadAppearancePreferences());
  notify();
}

export function saveAppearancePreferences(prefs: AppearanceSettings): void {
  const { theme: _theme, ...rest } = prefs;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {}
  previewOverrides = null;
  applyAppearancePreferences(prefs);
  notify();
}

/** Manual icon-rail toggle used only while Sidebar Behavior is 'remember'. */
export function readSidebarManuallyCollapsed(): boolean {
  try {
    return localStorage.getItem(MANUAL_SIDEBAR_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSidebarManuallyCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(MANUAL_SIDEBAR_KEY, String(collapsed));
  } catch {
    // Preview-only when storage is unavailable.
  }
  const current = previewOverrides ?? loadAppearancePreferences();
  applyAppearancePreferences(current);
  notify();
}

/** 'expanded' pins the rail open, 'collapsed' pins icon-only, 'remember' follows the manual toggle. */
export function resolveSidebarCollapsed(
  prefs: Pick<AppearanceSettings, 'sidebar'>,
  manuallyCollapsed?: boolean,
): boolean {
  if (prefs.sidebar === 'collapsed') return true;
  if (prefs.sidebar === 'expanded') return false;
  return manuallyCollapsed ?? readSidebarManuallyCollapsed();
}

function getSnapshot(): string {
  try {
    return (
      localStorage.getItem(STORAGE_KEY) ?? JSON.stringify(defaultAppearancePreferences())
    );
  } catch {
    return JSON.stringify(defaultAppearancePreferences());
  }
}

/** Live sidebar mode for chrome outside the Settings draft (Sidebar, AppShell). */
export function useSidebarCollapsed(): boolean {
  const key = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const prefs = previewOverrides ?? parseStored(key);
  const manual = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(MANUAL_SIDEBAR_KEY) ?? 'false';
      } catch {
        return 'false';
      }
    },
    () => 'false',
  );
  return resolveSidebarCollapsed(prefs, manual === 'true');
}

/** Reactive hook to read the currently active sidebar behavior ('expanded' | 'collapsed' | 'remember'). */
export function useSidebarPreference(): AppearanceSettings['sidebar'] {
  const key = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const prefs = previewOverrides ?? parseStored(key);
  return prefs.sidebar;
}

/** Applies the stored appearance once per load (call next to initTheme). */
export function initAppearance(): void {
  applyAppearancePreferences(loadAppearancePreferences());

  // Listen to OS prefers-reduced-motion changes dynamically
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      mediaQuery.addEventListener('change', () => {
        const current = previewOverrides ?? loadAppearancePreferences();
        if (current.respectReducedMotion) {
          applyAppearancePreferences(current);
          notify();
        }
      });
    } catch {}
  }
}
