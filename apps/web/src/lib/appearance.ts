import { useSyncExternalStore } from 'react';

import type { AppearanceSettings } from '@/features/settings/settings.types';
import { DEFAULT_SETTINGS } from '@/features/settings/settings.reference';

/**
 * Interface density, sidebar, table rows and motion. A UI preference only:
 * stored in localStorage (never credentials) and applied via data attributes
 * on <html> (see index.css) plus a subscribed collapsed flag for the sidebar.
 * Theme lives separately in lib/theme.ts.
 */

const STORAGE_KEY = 'domainpulse.appearance';
const MANUAL_SIDEBAR_KEY = 'domainpulse.sidebar-collapsed';
const EVENT_NAME = 'domainpulse:appearance';

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
  window.dispatchEvent(new Event(EVENT_NAME));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener('storage', listener);
  };
}

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
    return {
      theme: fallback.theme,
      density: record.density === 'comfortable' ? 'comfortable' : 'compact',
      sidebar:
        record.sidebar === 'collapsed' || record.sidebar === 'remember'
          ? record.sidebar
          : 'expanded',
      tableRowDensity: record.tableRowDensity === 'standard' ? 'standard' : 'compact',
      monoDataFont: 'JetBrains Mono',
      interfaceFont: 'Inter',
      microInteractions: typeof record.microInteractions === 'boolean' ? record.microInteractions : fallback.microInteractions,
      respectReducedMotion:
        typeof record.respectReducedMotion === 'boolean' ? record.respectReducedMotion : fallback.respectReducedMotion,
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

function systemPrefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** True when animations/transitions should be suppressed. */
export function motionReducedFor(prefs: Pick<AppearanceSettings, 'microInteractions' | 'respectReducedMotion'>): boolean {
  if (!prefs.microInteractions) return true;
  return prefs.respectReducedMotion && systemPrefersReducedMotion();
}

export function applyAppearancePreferences(
  prefs: Pick<
    AppearanceSettings,
    'density' | 'sidebar' | 'tableRowDensity' | 'microInteractions' | 'respectReducedMotion'
  >,
): void {
  const root = document.documentElement;
  root.dataset.density = prefs.density;
  root.dataset.tableDensity = prefs.tableRowDensity;
  root.dataset.motion = motionReducedFor(prefs) ? 'reduced' : 'full';
  root.dataset.sidebar = resolveSidebarCollapsed(prefs) ? 'collapsed' : 'expanded';
}

export function saveAppearancePreferences(prefs: AppearanceSettings): void {
  const { theme: _theme, ...rest } = prefs;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
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
  applyAppearancePreferences(loadAppearancePreferences());
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
  const prefs = parseStored(key);
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

/** Applies the stored appearance once per load (call next to initTheme). */
export function initAppearance(): void {
  applyAppearancePreferences(loadAppearancePreferences());
}
