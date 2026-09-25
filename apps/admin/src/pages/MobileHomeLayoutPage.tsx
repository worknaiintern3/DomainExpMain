import React, { useEffect, useState } from 'react';
import type { MobileHomeSection } from '@domainpulse/contracts';
import { mobileAdminClient } from '../api/mobile-admin.client';

export const MobileHomeLayoutPage: React.FC = () => {
  const [sections, setSections] = useState<MobileHomeSection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    mobileAdminClient
      .getHomeConfig()
      .then((data) => {
        setSections([...data].sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(() => {
        setSections([
          { sectionKey: 'banner', title: 'Announcements', sortOrder: 1, enabled: true },
          { sectionKey: 'stats', title: 'Portfolio Overview', sortOrder: 2, enabled: true },
          { sectionKey: 'quickActions', title: 'Quick Actions', sortOrder: 3, enabled: true },
          { sectionKey: 'alerts', title: 'Urgent Alerts', sortOrder: 4, enabled: true },
          { sectionKey: 'domains', title: 'Expiring Domains', sortOrder: 5, enabled: true },
          { sectionKey: 'servers', title: 'Active Servers', sortOrder: 6, enabled: true },
        ]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...sections];
    const itemA = next[index - 1];
    const itemB = next[index];
    if (!itemA || !itemB) return;
    const tempOrder = itemA.sortOrder;
    itemA.sortOrder = itemB.sortOrder;
    itemB.sortOrder = tempOrder;
    next[index - 1] = itemB;
    next[index] = itemA;
    setSections(next);
  };

  const moveDown = (index: number) => {
    if (index >= sections.length - 1) return;
    const next = [...sections];
    const itemA = next[index];
    const itemB = next[index + 1];
    if (!itemA || !itemB) return;
    const tempOrder = itemA.sortOrder;
    itemA.sortOrder = itemB.sortOrder;
    itemB.sortOrder = tempOrder;
    next[index] = itemB;
    next[index + 1] = itemA;
    setSections(next);
  };

  const toggleSection = (index: number) => {
    const next = [...sections];
    const target = next[index];
    if (!target) return;
    target.enabled = !target.enabled;
    setSections(next);
  };

  const updateTitle = (index: number, newTitle: string) => {
    const next = [...sections];
    const target = next[index];
    if (!target) return;
    target.title = newTitle;
    setSections(next);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updated = await mobileAdminClient.updateHomeConfig(sections);
      setSections([...updated].sort((a, b) => a.sortOrder - b.sortOrder));
      setToast('✅ Home layout ordering and visibility saved');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('❌ Failed to save home layout');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading home screen configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Home Screen Layout</h2>
          <p className="text-sm text-slate-400 mt-1">
            Reorder, rename, or toggle visibility of components on the mobile home dashboard.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          {isSaving ? 'Saving Layout...' : 'Save Layout Changes'}
        </button>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-800">
          {sections.map((section, idx) => (
            <div key={section.sectionKey} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-xs font-mono font-bold text-slate-500">
                  #{idx + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateTitle(idx, e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {section.sectionKey}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSection(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    section.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {section.enabled ? 'VISIBLE' : 'HIDDEN'}
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
                    disabled={idx === sections.length - 1}
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
