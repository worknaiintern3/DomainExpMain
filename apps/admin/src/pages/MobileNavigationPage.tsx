import React, { useEffect, useState } from 'react';
import type { MobileNavigationItem } from '@domainpulse/contracts';
import { adminClient } from '../api/admin.client';
import { IconCheckCircle, IconNavigation } from '../components/Icons';

export const MobileNavigationPage: React.FC = () => {
  const [items, setItems] = useState<MobileNavigationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    adminClient
      .getNavigation()
      .then((data) => {
        setItems([...data].sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    const itemA = next[index - 1];
    const itemB = next[index];
    if (!itemA || !itemB) return;
    const tempOrder = itemA.sortOrder;
    itemA.sortOrder = itemB.sortOrder;
    itemB.sortOrder = tempOrder;
    next[index - 1] = itemB;
    next[index] = itemA;
    setItems(next);
  };

  const moveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const next = [...items];
    const itemA = next[index];
    const itemB = next[index + 1];
    if (!itemA || !itemB) return;
    const tempOrder = itemA.sortOrder;
    itemA.sortOrder = itemB.sortOrder;
    itemB.sortOrder = tempOrder;
    next[index] = itemB;
    next[index + 1] = itemA;
    setItems(next);
  };

  const toggleItem = (index: number) => {
    const next = [...items];
    const target = next[index];
    if (!target) return;
    target.enabled = !target.enabled;
    setItems(next);
  };

  const updateLabel = (index: number, newLabel: string) => {
    const next = [...items];
    const target = next[index];
    if (!target) return;
    target.label = newLabel;
    setItems(next);
  };

  const updateBadge = (index: number, badge: string) => {
    const next = [...items];
    const target = next[index];
    if (!target) return;
    target.badge = badge.trim() ? badge : null;
    setItems(next);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = items.map((item, idx) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
        route: item.route,
        sortOrder: idx + 1,
        enabled: item.enabled,
        badge: item.badge ?? null,
      }));
      const updated = await adminClient.updateNavigation(payload);
      setItems([...updated].sort((a, b) => a.sortOrder - b.sortOrder));
      setToast('Navigation tabs configuration successfully saved');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to save navigation tabs');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading mobile navigation tabs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <IconNavigation size={24} className="text-blue-500" />
            Mobile Bottom Navigation Tabs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure mobile tab bar routes, badge counters, and order dynamically.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Updating Tabs...' : 'Save Navigation Bar'}
        </button>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <IconCheckCircle size={16} />
          {toast}
        </div>
      )}

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={item.key}
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
              item.enabled
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                : 'bg-slate-100/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 opacity-60'
            }`}
          >
            <div className="flex items-center gap-4 flex-1">
              <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-500 dark:text-slate-400">
                #{idx + 1}
              </span>

              <div className="w-48">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateLabel(idx, e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <span className="font-mono text-[11px] text-slate-400">
                route: {item.route}
              </span>

              <div className="flex items-center gap-1.5 ml-4">
                <span className="text-[11px] text-slate-400">Badge:</span>
                <input
                  type="text"
                  value={item.badge || ''}
                  placeholder="e.g. 3 or NEW"
                  onChange={(e) => updateBadge(idx, e.target.value)}
                  className="w-20 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-1 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 text-xs font-bold"
                title="Move Up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveDown(idx)}
                disabled={idx === items.length - 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 text-xs font-bold"
                title="Move Down"
              >
                ▼
              </button>

              <button
                type="button"
                onClick={() => toggleItem(idx)}
                className={`ml-3 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  item.enabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                }`}
              >
                {item.enabled ? 'VISIBLE' : 'HIDDEN'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
