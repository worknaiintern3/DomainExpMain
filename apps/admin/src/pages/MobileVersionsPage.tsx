import React, { useEffect, useState } from 'react';
import type { MobileAppVersion } from '@domainpulse/contracts';
import { mobileAdminClient } from '../api/mobile-admin.client';

export const MobileVersionsPage: React.FC = () => {
  const [versions, setVersions] = useState<MobileAppVersion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    mobileAdminClient
      .getVersions()
      .then(setVersions)
      .catch(() => {
        setVersions([
          {
            platform: 'all',
            minimumVersion: '1.0.0',
            latestVersion: '1.0.0',
            forceUpdate: false,
            updateUrl: null,
            releaseNotes: 'Initial production build',
          },
        ]);
      })
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
      await mobileAdminClient.updateVersion(platform, {
        minimumVersion: v.minimumVersion,
        latestVersion: v.latestVersion,
        forceUpdate: v.forceUpdate,
        updateUrl: v.updateUrl || null,
        releaseNotes: v.releaseNotes || null,
      });
      setToast(`✅ Version policies saved for ${platform}`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast(`❌ Failed to save version policies for ${platform}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading version policies...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">App Version Policy & Forced Updates</h2>
        <p className="text-sm text-slate-400 mt-1">
          Enforce minimum app version thresholds and notify or block outdated mobile clients.
        </p>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="space-y-4">
        {versions.map((ver, idx) => (
          <div
            key={ver.platform}
            className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base capitalize">
                  Platform: {ver.platform}
                </span>
                <span className="text-xs text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Global Rules
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-300 font-semibold cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ver.forceUpdate}
                    onChange={(e) => updateVersionField(idx, 'forceUpdate', e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span>Enforce Hard Update Block</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Minimum Required App Version
                </label>
                <input
                  type="text"
                  value={ver.minimumVersion}
                  onChange={(e) => updateVersionField(idx, 'minimumVersion', e.target.value)}
                  placeholder="1.0.0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Clients older than this version will be forced to upgrade.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Latest Published App Version
                </label>
                <input
                  type="text"
                  value={ver.latestVersion}
                  onChange={(e) => updateVersionField(idx, 'latestVersion', e.target.value)}
                  placeholder="1.1.0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Target version shown in upgrade prompts.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Store / Download URL (Optional)
              </label>
              <input
                type="url"
                value={ver.updateUrl || ''}
                onChange={(e) => updateVersionField(idx, 'updateUrl', e.target.value || null)}
                placeholder="https://apps.apple.com/... or https://play.google.com/..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Release Notes
              </label>
              <textarea
                value={ver.releaseNotes || ''}
                onChange={(e) => updateVersionField(idx, 'releaseNotes', e.target.value || null)}
                placeholder="What's new in this release..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => handleSave(ver.platform, ver)}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Apply Version Policies'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
