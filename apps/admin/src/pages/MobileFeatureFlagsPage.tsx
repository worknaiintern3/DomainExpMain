import React, { useEffect, useState } from 'react';
import type { MobileFeatureFlag } from '@domainpulse/contracts';
import { adminClient } from '../api/admin.client';
import { IconCheckCircle, IconFlag, IconRefresh } from '../components/Icons';

export const MobileFeatureFlagsPage: React.FC = () => {
  const [flags, setFlags] = useState<MobileFeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadFlags = async () => {
    try {
      setIsLoading(true);
      const data = await adminClient.getFeatures();
      setFlags(data);
    } catch {
      // Handled in client fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    try {
      setUpdatingKey(key);
      const updated = await adminClient.updateFeature(key, {
        enabled: !currentEnabled,
      });
      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled: updated.enabled } : f)),
      );
      setToast(`Feature flag '${key}' turned ${updated.enabled ? 'ON' : 'OFF'}`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast(`Failed to update feature '${key}'`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUpdatingKey(null);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading mobile feature flags...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <IconFlag size={24} className="text-blue-500" />
            Mobile Feature Flags Control
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Toggle modules and capabilities dynamically on iOS & Android apps without republishing to app stores.
          </p>
        </div>

        <button
          onClick={loadFlags}
          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm"
        >
          <IconRefresh size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <IconCheckCircle size={16} />
          {toast}
        </div>
      )}

      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
        {flags.map((flag) => {
          const isBusy = updatingKey === flag.key;
          return (
            <div
              key={flag.key}
              className="p-5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="space-y-1 pr-6">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">{flag.name}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {flag.key}
                  </span>
                  {flag.minAppVersion && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30">
                      Min v{flag.minAppVersion}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{flag.description}</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={`text-xs font-bold ${
                    flag.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {flag.enabled ? 'ENABLED' : 'DISABLED'}
                </span>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleToggle(flag.key, flag.enabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    flag.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  } ${isBusy ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      flag.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
