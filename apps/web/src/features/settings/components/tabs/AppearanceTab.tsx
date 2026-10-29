import React, { useEffect, useState } from 'react';
import { AppearanceSettings } from '../../settings.types';
import {
  INTERFACE_FONT_OPTIONS,
  MONO_FONT_OPTIONS,
} from '../../settings.reference';
import {
  INTERFACE_FONT_FAMILIES,
  MONO_FONT_FAMILIES,
  systemPrefersReducedMotion,
} from '@/lib/appearance';

interface AppearanceTabProps {
  settings: AppearanceSettings;
  onChange: (updated: Partial<AppearanceSettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  const [osReducedMotion, setOsReducedMotion] = useState(() => systemPrefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setOsReducedMotion(e.matches);
    try {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } catch {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        {/* Header */}
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-xs">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Interface &amp; Appearance
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-caption-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {settings.theme === 'light' ? 'Light Theme' : settings.theme === 'dark' ? 'Dark Theme' : 'System Theme'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-caption-xs font-semibold bg-surface-container text-secondary border border-outline-variant/30">
                {settings.density === 'compact' ? 'Compact UI' : 'Comfortable UI'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-caption-xs font-semibold bg-surface-container text-secondary border border-outline-variant/30">
                {settings.sidebar === 'expanded' ? 'Expanded Rail' : settings.sidebar === 'collapsed' ? 'Collapsed Rail' : 'Remember Rail'}
              </span>
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Theme modes, layout density options, selectable typography styles, and accessibility motion behaviors. Changes preview live across the entire interface.
          </p>
        </div>

        <div className="flex flex-col gap-unit-xl mt-unit-lg">
          {/* 1. Theme Mode Cards */}
          <div className="flex flex-col gap-unit-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface font-semibold">
                Theme Mode
              </label>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Select your preferred color profile
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-unit-sm">
              {/* Light */}
              <div
                onClick={() => onChange({ theme: 'light' })}
                className={`p-unit-sm rounded-xl flex flex-col gap-2 cursor-pointer transition-all border ${
                  settings.theme === 'light'
                    ? 'bg-surface-container-lowest ring-2 ring-primary border-primary/40 shadow-micro'
                    : 'bg-surface-container-low border-outline-variant/30 hover:bg-surface-container'
                }`}
              >
                <div className="h-16 rounded-lg bg-[#f8f9fc] flex items-center justify-center p-2 border border-[#e2e8f0]">
                  <div className="w-full h-full rounded bg-white shadow-micro flex items-center px-2">
                    <span className="w-4 h-2 rounded-sm bg-[#3525cd]"></span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    Light (Concept C)
                  </span>
                  {settings.theme === 'light' ? (
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      check_circle
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-outline-variant/60" />
                  )}
                </div>
              </div>

              {/* Dark */}
              <div
                onClick={() => onChange({ theme: 'dark' })}
                className={`p-unit-sm rounded-xl flex flex-col gap-2 cursor-pointer transition-all border ${
                  settings.theme === 'dark'
                    ? 'bg-surface-container-lowest ring-2 ring-primary border-primary/40 shadow-micro'
                    : 'bg-surface-container-low border-outline-variant/30 hover:bg-surface-container'
                }`}
              >
                <div className="h-16 rounded-lg bg-[#0b1120] flex items-center justify-center p-2 border border-[#243049]">
                  <div className="w-full h-full rounded bg-[#1e293b] flex items-center px-2">
                    <span className="w-4 h-2 rounded-sm bg-[#a9a5ff]"></span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    Dark
                  </span>
                  {settings.theme === 'dark' ? (
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      check_circle
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-outline-variant/60" />
                  )}
                </div>
              </div>

              {/* System */}
              <div
                onClick={() => onChange({ theme: 'system' })}
                className={`p-unit-sm rounded-xl flex flex-col gap-2 cursor-pointer transition-all border ${
                  settings.theme === 'system'
                    ? 'bg-surface-container-lowest ring-2 ring-primary border-primary/40 shadow-micro'
                    : 'bg-surface-container-low border-outline-variant/30 hover:bg-surface-container'
                }`}
              >
                <div className="h-16 rounded-lg bg-gradient-to-r from-[#f8f9fc] to-[#0b1120] flex items-center justify-center p-2 border border-[#475569]/40">
                  <div className="w-full h-full rounded bg-[#64748b]/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px] text-[#94a3b8]">
                      sync
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    System Sync
                  </span>
                  {settings.theme === 'system' ? (
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      check_circle
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-outline-variant/60" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Interface Density & Sidebar Behavior */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
            {/* Density */}
            <div className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-unit-sm">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Interface Density
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Concept C compact touch targets (44px) vs roomier controls.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => onChange({ density: 'compact' })}
                  className={`p-unit-sm rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                    settings.density === 'compact'
                      ? 'bg-surface-container-lowest text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container text-secondary border-outline-variant/30 hover:bg-surface-container-high'
                  }`}
                >
                  <span>Compact</span>
                  {settings.density === 'compact' && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ density: 'comfortable' })}
                  className={`p-unit-sm rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                    settings.density === 'comfortable'
                      ? 'bg-surface-container-lowest text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container text-secondary border-outline-variant/30 hover:bg-surface-container-high'
                  }`}
                >
                  <span>Comfortable</span>
                  {settings.density === 'comfortable' && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
              </div>
            </div>

            {/* Sidebar Behavior */}
            <div className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-unit-sm">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Sidebar Behavior
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Previews immediately in navigation rail.
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {[
                  { id: 'expanded', label: 'Expanded', icon: 'view_sidebar' },
                  { id: 'collapsed', label: 'Collapsed', icon: 'vertical_split' },
                  { id: 'remember', label: 'Remember', icon: 'history' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChange({ sidebar: s.id as any })}
                    className={`py-2 px-2 text-center rounded-lg font-label-md text-label-md flex items-center justify-center gap-1 border cursor-pointer transition-colors ${
                      settings.sidebar === s.id
                        ? 'bg-surface-container-lowest text-primary font-semibold border-primary/40 shadow-micro'
                        : 'bg-surface-container text-secondary border-outline-variant/30 hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Table Row Density with Live Interactive Mini-Preview */}
          <div className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-unit-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Table Row Density
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Controls vertical padding across domain, VPS, and cloud asset tables.
                </span>
              </div>
              <div className="inline-flex p-1 bg-surface-container-high rounded-lg border border-outline-variant/30 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => onChange({ tableRowDensity: 'compact' })}
                  className={`px-3 py-1 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                    settings.tableRowDensity === 'compact'
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-micro'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  Compact (44px)
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ tableRowDensity: 'standard' })}
                  className={`px-3 py-1 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                    settings.tableRowDensity === 'standard'
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-micro'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  Standard (52px)
                </button>
              </div>
            </div>

            {/* Live Interactive Table Preview */}
            <div className="mt-unit-xs rounded-lg border border-outline-variant/30 overflow-hidden bg-surface-container-lowest">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container/60 text-secondary font-label-md text-label-md">
                    <th className="px-unit-md font-semibold">Domain</th>
                    <th className="px-unit-md font-semibold">Registrar</th>
                    <th className="px-unit-md font-semibold">Status</th>
                    <th className="px-unit-md font-semibold text-right">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-body-sm text-body-sm">
                  <tr className="hover:bg-surface-container-low transition-colors">
                    <td className="px-unit-md font-label-mono font-medium text-on-surface">
                      domainpulse.io
                    </td>
                    <td className="px-unit-md text-secondary">Cloudflare</td>
                    <td className="px-unit-md">
                      <span className="px-2 py-0.5 rounded-full text-caption-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Healthy (342d)
                      </span>
                    </td>
                    <td className="px-unit-md font-label-mono text-secondary text-right">
                      12 Oct 2027
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low transition-colors">
                    <td className="px-unit-md font-label-mono font-medium text-on-surface">
                      api.infra-gateway.in
                    </td>
                    <td className="px-unit-md text-secondary">GoDaddy</td>
                    <td className="px-unit-md">
                      <span className="px-2 py-0.5 rounded-full text-caption-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Warning (28d)
                      </span>
                    </td>
                    <td className="px-unit-md font-label-mono text-secondary text-right">
                      26 Nov 2026
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Interface Font Options */}
          <div className="flex flex-col gap-unit-xs">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-label-md text-label-md text-on-surface font-semibold">
                  Interface Font
                </label>
                <p className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Applied to UI labels, navigation menus, headers, buttons, and body content.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-primary/10 text-primary font-semibold text-caption-xs border border-primary/20">
                Active: {settings.interfaceFont}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-unit-sm mt-1">
              {INTERFACE_FONT_OPTIONS.map((f) => {
                const isSelected = settings.interfaceFont === f.value;
                return (
                  <div
                    key={f.value}
                    onClick={() => onChange({ interfaceFont: f.value })}
                    className={`p-unit-sm rounded-xl flex flex-col gap-1 cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-surface-container-lowest ring-2 ring-primary border-primary/40 shadow-micro'
                        : 'bg-surface-container-low border-outline-variant/30 hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-semibold text-body-md text-on-surface"
                        style={{ fontFamily: f.familyCss }}
                      >
                        {f.label}
                      </span>
                      {isSelected ? (
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          check_circle
                        </span>
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-outline-variant/60" />
                      )}
                    </div>
                    <span className="font-caption-xs text-caption-xs text-secondary line-clamp-1">
                      {f.tagline}
                    </span>
                    <div
                      className="mt-1 p-2 rounded bg-surface-container text-body-sm text-on-surface border border-outline-variant/20 truncate"
                      style={{ fontFamily: f.familyCss }}
                    >
                      The quick brown fox jumps over the lazy dog 12345
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Mono Data Font Options */}
          <div className="flex flex-col gap-unit-xs">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-label-md text-label-md text-on-surface font-semibold">
                  Mono Data Font
                </label>
                <p className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Applied to domain names, IP addresses, ports, DNS records, and financial currencies.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-primary/10 text-primary font-semibold text-caption-xs border border-primary/20">
                Active: {settings.monoDataFont}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-sm mt-1">
              {MONO_FONT_OPTIONS.map((f) => {
                const isSelected = settings.monoDataFont === f.value;
                return (
                  <div
                    key={f.value}
                    onClick={() => onChange({ monoDataFont: f.value })}
                    className={`p-unit-sm rounded-xl flex flex-col gap-1 cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-surface-container-lowest ring-2 ring-primary border-primary/40 shadow-micro'
                        : 'bg-surface-container-low border-outline-variant/30 hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-semibold text-body-md text-on-surface"
                        style={{ fontFamily: f.familyCss }}
                      >
                        {f.label}
                      </span>
                      {isSelected ? (
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          check_circle
                        </span>
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-outline-variant/60" />
                      )}
                    </div>
                    <span className="font-caption-xs text-caption-xs text-secondary line-clamp-1">
                      {f.tagline}
                    </span>
                    <div
                      className="mt-1 p-2 rounded bg-surface-container text-caption-xs text-on-surface border border-outline-variant/20 truncate"
                      style={{ fontFamily: f.familyCss }}
                    >
                      192.168.1.1:443 · ₹1,499
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. Typography Live Pairing Preview Board */}
          <div className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-unit-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Typography Live Pairing Preview
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Rendered with {settings.interfaceFont} + {settings.monoDataFont}
              </span>
            </div>
            <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-micro flex flex-col sm:flex-row sm:items-center justify-between gap-unit-md">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-headline-sm font-semibold text-on-surface"
                    style={{
                      fontFamily:
                        INTERFACE_FONT_FAMILIES[settings.interfaceFont] ||
                        INTERFACE_FONT_FAMILIES.Inter,
                    }}
                  >
                    Production Cluster Ingress
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    Primary
                  </span>
                </div>
                <span
                  className="text-body-sm text-secondary"
                  style={{
                    fontFamily:
                      INTERFACE_FONT_FAMILIES[settings.interfaceFont] ||
                      INTERFACE_FONT_FAMILIES.Inter,
                  }}
                >
                  Global edge reverse proxy with SSL certificate auto-renewal.
                </span>
              </div>

              <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 shrink-0">
                <span
                  className="px-2.5 py-1 rounded bg-surface-container font-medium text-body-sm text-on-surface border border-outline-variant/30"
                  style={{
                    fontFamily:
                      MONO_FONT_FAMILIES[settings.monoDataFont] ||
                      MONO_FONT_FAMILIES['JetBrains Mono'],
                  }}
                >
                  api.production-cluster.internal
                </span>
                <div
                  className="flex items-center gap-2 text-caption-xs text-secondary"
                  style={{
                    fontFamily:
                      MONO_FONT_FAMILIES[settings.monoDataFont] ||
                      MONO_FONT_FAMILIES['JetBrains Mono'],
                  }}
                >
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    198.51.100.42:8443
                  </span>
                  <span>•</span>
                  <span>TLS 1.3</span>
                  <span>•</span>
                  <span className="font-semibold text-primary">₹1,499/yr</span>
                </div>
              </div>
            </div>
          </div>

          {/* 7. Accessibility & Motion Switches */}
          <div className="space-y-unit-sm">
            {/* Micro-Interactions */}
            <div className="flex items-center justify-between p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col pr-unit-md">
                <div className="flex items-center gap-2">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    Micro-Interactions &amp; Transitions
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      settings.microInteractions
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {settings.microInteractions ? 'Smooth Animations Active' : 'Zero-delay Snappy'}
                  </span>
                </div>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Smooth animated tabs, pills, modals, and navigation state transitions. Disable for instantaneous UI state changes.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.microInteractions}
                  onChange={(e) => onChange({ microInteractions: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Respect Reduced Motion */}
            <div className="flex items-center justify-between p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col pr-unit-md">
                <div className="flex items-center gap-2">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    Respect Reduced Motion
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container text-secondary border border-outline-variant/30">
                    OS Status: {osReducedMotion ? 'Reduced Motion Requested' : 'Standard Motion'}
                  </span>
                </div>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Adheres directly to your operating system&apos;s prefers-reduced-motion accessibility setting to minimize vestibular triggers.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.respectReducedMotion}
                  onChange={(e) => onChange({ respectReducedMotion: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="mt-unit-lg pt-unit-md border-t border-surface-container-low flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary">
            Settings are stored securely on this device and applied across all workspace pages.
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Appearance Settings'}
          </button>
        </div>
      </div>
    </section>
  );
};
