import React, { useEffect, useState } from 'react';
import type { MobileNavigationItem } from '@domainpulse/contracts';
import { mobileAdminClient } from '../api/mobile-admin.client';

export const MobileNavigationPage: React.FC = () => {
  const [items, setItems] = useState<MobileNavigationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    mobileAdminClient
      .getNavigation()
      .then((data) => {
        setItems([...data].sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(() => {
        setItems([
          { key: 'home', label: 'Home', icon: 'home', route: '/home', sortOrder: 1, enabled: true, badge: null },
          { key: 'domains', label: 'Domains', icon: 'globe', route: '/domains', sortOrder: 2, enabled: true, badge: null },
          { key: 'alerts', label: 'Alerts', icon: 'bell', route: '/alerts', sortOrder: 3, enabled: true, badge: null },
          { key: 'settings', label: 'Settings', icon: 'settings', route: '/settings', sortOrder: 4, enabled: true, badge: null },
        ]);
      })
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

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updated = await mobileAdminClient.updateNavigation(items);
      setItems([...updated].sort((a, b) => a.sortOrder - b.sortOrder));
      setToast('✅ Navigation tabs ordering saved');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('❌ Failed to save navigation tabs');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading navigation configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Navigation Tabs</h2>
          <p className="text-sm text-slate-400 mt-1">
            Reorder and customize the bottom navigation bar displayed in the mobile client.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          {isSaving ? 'Saving Navigation...' : 'Save Navigation'}
        </button>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-800">
          {items.map((tab, idx) => (
            <div key={tab.key} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-xs font-mono font-bold text-slate-500">
                  #{idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tab.label}
                    onChange={(e) => updateLabel(idx, e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {tab.route}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleItem(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    tab.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {tab.enabled ? 'ENABLED' : 'DISABLED'}
                </button>

                <div className="flex items-center gap-1 border border-slate-800 rounded-lg bg-slate-950 p-1">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === items.length - 1}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
