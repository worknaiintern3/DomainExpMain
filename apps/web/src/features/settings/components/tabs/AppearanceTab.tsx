import React from 'react';
import { AppearanceSettings } from '../../settings.types';

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
  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Interface &amp; Appearance
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Theme modes, layout density options, typography specs, and visual interaction behaviors.
          </p>
        </div>

        <div className="flex flex-col gap-unit-md mt-unit-md">
          {/* Theme Mode Cards */}
          <div className="flex flex-col gap-unit-xs">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Theme Mode
            </label>
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
                <div className="h-16 rounded-lg bg-surface flex items-center justify-center p-2 border border-outline-variant/30">
                  <div className="w-full h-full rounded bg-surface-container-lowest shadow-micro flex items-center px-2">
                    <span className="w-4 h-2 rounded-sm bg-primary"></span>
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
                <div className="h-16 rounded-lg bg-inverse-surface flex items-center justify-center p-2 border border-outline-variant/30">
                  <div className="w-full h-full rounded bg-inverse-surface/80 flex items-center px-2">
                    <span className="w-4 h-2 rounded-sm bg-primary-fixed-dim"></span>
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
                <div className="h-16 rounded-lg bg-gradient-to-r from-surface to-inverse-surface flex items-center justify-center p-2 border border-outline-variant/30">
                  <div className="w-full h-full rounded bg-surface-container-high/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px] text-on-surface">
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

          {/* Interface Density & Sidebar Behavior */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md pt-unit-xs">
            {/* Density */}
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Interface Density
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ density: 'compact' })}
                  className={`p-unit-sm rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                    settings.density === 'compact'
                      ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
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
                      ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  <span>Comfortable</span>
                  {settings.density === 'comfortable' && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Concept C compact table row standard (44px target).
              </span>
            </div>

            {/* Sidebar Behavior */}
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Sidebar Behavior
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'expanded', label: 'Expanded' },
                  { id: 'collapsed', label: 'Collapsed' },
                  { id: 'remember', label: 'Remember' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChange({ sidebar: s.id as any })}
                    className={`py-2 px-1 text-center rounded-lg font-label-md text-label-md flex items-center justify-center border cursor-pointer transition-colors ${
                      settings.sidebar === s.id
                        ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                        : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
                    }`}
                  >
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Navigation rail state across workspaces.
              </span>
            </div>
          </div>

          {/* Table Row Density */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Table Row Density
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Control vertical padding across domain and server tables.
              </span>
            </div>
            <div className="inline-flex p-1 bg-surface-container-high rounded-lg border border-outline-variant/30">
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

          {/* Typography Preview Specs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md pt-unit-xs">
            <div className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Interface Font
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  UI labels, headings, body text
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-surface-container-lowest text-primary font-semibold text-label-md shadow-micro border border-outline-variant/30">
                Inter
              </span>
            </div>

            <div className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Mono Data Font
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Domain names, IPs, ports, currencies
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-surface-container-lowest text-primary font-label-mono font-semibold text-label-mono shadow-micro border border-outline-variant/30">
                JetBrains Mono
              </span>
            </div>
          </div>

          {/* Accessibility & Motion Switches */}
          <div className="space-y-unit-sm pt-unit-xs">
            <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Micro-Interactions &amp; Transitions
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Smooth animated tabs, pills, and state transitions.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.microInteractions}
                  onChange={(e) => onChange({ microInteractions: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 peer-checked:bg-primary transition-all"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Respect Reduced Motion
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Adheres directly to OS system-level prefers-reduced-motion settings.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.respectReducedMotion}
                  onChange={(e) => onChange({ respectReducedMotion: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 peer-checked:bg-primary transition-all"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-unit-lg pt-unit-md border-t border-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Appearance Settings'}
          </button>
        </div>
      </div>
    </section>
  );
};
