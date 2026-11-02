import React, { useEffect, useState } from 'react';
import type { MobileAppVersion } from '@domainpulse/contracts';
import { adminClient } from '../api/admin.client';
import { IconCheckCircle, IconGitBranch } from '../components/Icons';

export const MobileVersionsPage: React.FC = () => {
  const [versions, setVersions] = useState<MobileAppVersion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    adminClient
      .getVersions()
      .then(setVersions)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const updateVersionField = (
    index: number,
    field: keyof MobileAppVersion,
    value: unknown,
  ) => {
    const next = [...versions];
    const target = next[index];
    if (!target) return;
    (target as any)[field] = value;
    setVersions(next);
  };

  const handleSave = async (platform: string, v: MobileAppVersion) => {
    try {
      setIsSaving(true);
      await adminClient.updateVersion(platform, {
        minimumVersion: v.minimumVersion,
        latestVersion: v.latestVersion,
        forceUpdate: v.forceUpdate,
        updateUrl: v.updateUrl || null,
        releaseNotes: v.releaseNotes || null,
      });
      setToast(`Version policies updated for ${platform.toUpperCase()}`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast(`Failed to save version policies for ${platform}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading app version controls...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <IconGitBranch size={24} className="text-blue-500" />
          Mobile App Versions & Force Update Policy
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Enforce minimum versions, configure latest store releases, and trigger blocking force-update screens on iOS & Android.
        </p>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <IconCheckCircle size={16} />
          {toast}
        </div>
      )}

      <div className="space-y-6">
        {versions.map((v, idx) => (
          <div
            key={v.platform}
            className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span>Platform:</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 font-mono">
                  {v.platform}
                </span>
              </span>

              <button
                type="button"
                onClick={() => handleSave(v.platform, v)}
                disabled={isSaving}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Policy'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Minimum Version Allowed
                </label>
                <input
                  type="text"
                  value={v.minimumVersion}
                  onChange={(e) => updateVersionField(idx, 'minimumVersion', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Latest Version in Store
                </label>
                <input
                  type="text"
                  value={v.latestVersion}
                  onChange={(e) => updateVersionField(idx, 'latestVersion', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Store Update Deep Link
                </label>
                <input
                  type="url"
                  value={v.updateUrl || ''}
                  onChange={(e) => updateVersionField(idx, 'updateUrl', e.target.value)}
                  placeholder="https://apps.apple.com/... or https://play.google.com/..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Release Notes Copy
                </label>
                <input
                  type="text"
                  value={v.releaseNotes || ''}
                  onChange={(e) => updateVersionField(idx, 'releaseNotes', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={v.forceUpdate}
                    onChange={(e) => updateVersionField(idx, 'forceUpdate', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Force Update (Blocking Modal)
                  </span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
