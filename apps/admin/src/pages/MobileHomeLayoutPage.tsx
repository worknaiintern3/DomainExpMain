import React, { useEffect, useState, useCallback } from 'react';
import type { MobileHomeSection } from '@domainpulse/contracts';
import { adminClient } from '../api/admin.client';
import {
  IconCheckCircle,
  IconLayout,
  IconAlertTriangle,
  IconRefresh,
  IconMegaphone,
  IconActivity,
  IconGlobe,
  IconServer,
  IconLayers,
  IconShield,
  IconSun,
} from '../components/Icons';

const DEFAULT_SECTIONS: MobileHomeSection[] = [
  { sectionKey: 'hero', title: 'Greeting & Status', sortOrder: 1, enabled: true, configJson: null },
  { sectionKey: 'banner', title: 'Announcements', sortOrder: 2, enabled: true, configJson: null },
  { sectionKey: 'stats', title: 'Overview Metrics', sortOrder: 3, enabled: true, configJson: null },
  { sectionKey: 'quickActions', title: 'Quick Actions', sortOrder: 4, enabled: true, configJson: null },
  { sectionKey: 'alerts', title: 'Urgent Alerts', sortOrder: 5, enabled: true, configJson: null },
  { sectionKey: 'domains', title: 'Expiring Domains', sortOrder: 6, enabled: true, configJson: null },
  { sectionKey: 'servers', title: 'Monitored Infrastructure', sortOrder: 7, enabled: true, configJson: null },
];

const SECTION_METADATA: Record<string, { label: string; icon: React.ReactNode; hint: string }> = {
  hero: {
    label: 'Welcome Hero Card',
    icon: <IconSun size={16} className="text-amber-500" />,
    hint: 'Good Morning / Evening greeting, active counts, and system status pill',
  },
  banner: {
    label: 'Announcements Banner',
    icon: <IconMegaphone size={16} className="text-blue-500" />,
    hint: 'Broadcast message banners and critical platform alerts',
  },
  stats: {
    label: 'Overview Metrics Grid',
    icon: <IconLayers size={16} className="text-blue-500" />,
    hint: 'Total counts of Domains, Servers, Websites, and Apps',
  },
  quickActions: {
    label: 'Quick Actions Carousel',
    icon: <IconActivity size={16} className="text-emerald-500" />,
    hint: 'Shortcuts to Google Play Console, AWS, Hetzner, etc.',
  },
  alerts: {
    label: 'Urgent Alerts Stream',
    icon: <IconShield size={16} className="text-rose-500" />,
    hint: 'Recent event stream, active alarms, and system notices',
  },
  domains: {
    label: 'Expiring Domains Watchlist',
    icon: <IconGlobe size={16} className="text-cyan-500" />,
    hint: 'Upcoming expiring domain list with countdown badges',
  },
  servers: {
    label: 'Monitored Infrastructure Nodes',
    icon: <IconServer size={16} className="text-violet-500" />,
    hint: 'Monitored VPS and server telemetry status indicators',
  },
};

export const MobileHomeLayoutPage: React.FC = () => {
  const [sections, setSections] = useState<MobileHomeSection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadSections = useCallback(() => {
    setIsLoading(true);
    setError(null);
    adminClient
      .getHome()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Merge with DEFAULT_SECTIONS to ensure newly added sections (e.g. domains, servers) exist
          const existingKeys = new Set(data.map((s) => s.sectionKey));
          const missing = DEFAULT_SECTIONS.filter((def) => !existingKeys.has(def.sectionKey));
          const combined = [...data, ...missing].sort((a, b) => a.sortOrder - b.sortOrder);
          setSections(combined.map((s, idx) => ({ ...s, sortOrder: idx + 1 })));
        } else {
          setSections(DEFAULT_SECTIONS);
        }
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to connect to backend layout endpoint');
        setSections(DEFAULT_SECTIONS);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const saveSections = async (updatedSections: MobileHomeSection[], toastMsg?: string) => {
    setSections(updatedSections);
    try {
      setIsSaving(true);
      const payload = updatedSections.map((sec, idx) => ({
        sectionKey: sec.sectionKey,
        title: sec.title.trim() || sec.sectionKey,
        sortOrder: idx + 1,
        enabled: sec.enabled,
        configJson: sec.configJson ?? null,
      }));
      const updated = await adminClient.updateHome(payload as any);
      if (Array.isArray(updated) && updated.length > 0) {
        setSections([...updated].sort((a, b) => a.sortOrder - b.sortOrder));
      } else {
        setSections(payload as any);
      }
      setToast({
        type: 'success',
        message: toastMsg || 'Mobile Home layout updated and saved to app!',
      });
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to save mobile home layout.',
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...sections];
    const itemToMove = next[index];
    const prevItem = next[index - 1];
    if (!itemToMove || !prevItem) return;
    next[index - 1] = itemToMove;
    next[index] = prevItem;
    const reordered = next.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
    saveSections(reordered, `Moved "${itemToMove.title}" up (saved)`);
  };

  const moveDown = (index: number) => {
    if (index >= sections.length - 1) return;
    const next = [...sections];
    const itemToMove = next[index];
    const nextItem = next[index + 1];
    if (!itemToMove || !nextItem) return;
    next[index] = nextItem;
    next[index + 1] = itemToMove;
    const reordered = next.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
    saveSections(reordered, `Moved "${itemToMove.title}" down (saved)`);
  };

  const toggleSection = (index: number) => {
    const next = sections.map((sec, idx) =>
      idx === index ? { ...sec, enabled: !sec.enabled } : sec
    );
    const target = next[index];
    const statusText = target.enabled ? 'ACTIVE' : 'HIDDEN';
    const label = SECTION_METADATA[target.sectionKey]?.label || target.title;
    saveSections(next, `"${label}" is now ${statusText} (Saved to app)`);
  };

  const updateTitle = (index: number, newTitle: string) => {
    setSections((prev) =>
      prev.map((sec, idx) => (idx === index ? { ...sec, title: newTitle } : sec))
    );
  };

  const handleResetDefaults = () => {
    const defs = DEFAULT_SECTIONS.map((s, idx) => ({ ...s, sortOrder: idx + 1 }));
    saveSections(defs, 'Layout reset to defaults and saved to mobile app!');
  };

  const handleSave = () => {
    saveSections(sections, 'Mobile Home layout order updated successfully! Changes are live for mobile clients.');
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
        <IconRefresh size={20} className="animate-spin text-blue-500" />
        <span>Loading home layout sections...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl animate-fadeIn">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <IconLayout size={24} className="text-blue-500" />
            Mobile Home Screen Section Layout
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Reorder, rename, or toggle widgets visible on the mobile app home screen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Reset Defaults
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <IconRefresh size={14} className="animate-spin" />
                <span>Pushing Layout...</span>
              </>
            ) : (
              <span>Save Layout Order</span>
            )}
          </button>
        </div>
      </div>

      {/* TOAST / NOTICE */}
      {toast && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <IconCheckCircle size={16} /> : <IconAlertTriangle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ERROR BANNER IF OFFLINE */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/40 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconAlertTriangle size={16} className="text-amber-500" />
            <span>{error}. Displaying local editable defaults.</span>
          </div>
          <button
            type="button"
            onClick={loadSections}
            className="px-2.5 py-1 rounded-lg bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* SECTIONS LIST */}
      <div className="space-y-3">
        {sections.map((section, idx) => {
          const meta = SECTION_METADATA[section.sectionKey] || {
            label: section.title,
            icon: <IconLayout size={16} className="text-slate-500" />,
            hint: `Widget key: ${section.sectionKey}`,
          };

          return (
            <div
              key={section.sectionKey}
              className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                section.enabled
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                  : 'bg-slate-100/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 opacity-60'
              }`}
            >
              {/* LEFT: SORT NUMBER & TITLE INPUT */}
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-600 dark:text-slate-300 shrink-0">
                  #{idx + 1}
                </span>

                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 shrink-0">
                  {meta.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      key: {section.sectionKey}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateTitle(idx, e.target.value)}
                    placeholder={meta.label}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">{meta.hint}</p>
                </div>
              </div>

              {/* RIGHT: REORDER & TOGGLE */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
                  title="Move Up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === sections.length - 1}
                  className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
                  title="Move Down"
                >
                  ▼
                </button>

                <button
                  type="button"
                  onClick={() => toggleSection(idx)}
                  className={`ml-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    section.enabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {section.enabled ? 'ACTIVE' : 'HIDDEN'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
