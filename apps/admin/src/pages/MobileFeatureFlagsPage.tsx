import React, { useEffect, useState } from 'react';
import type { MobileFeatureFlag } from '@domainpulse/contracts';
import { mobileAdminClient } from '../api/mobile-admin.client';

export const MobileFeatureFlagsPage: React.FC = () => {
  const [flags, setFlags] = useState<MobileFeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadFlags = async () => {
    try {
      setIsLoading(true);
      const data = await mobileAdminClient.getFeatures();
      setFlags(data);
    } catch {
      // Fallback
      setFlags([
        { key: 'domains', name: 'Domains', description: 'Domain portfolio tracking', enabled: true },
        { key: 'servers', name: 'Servers', description: 'Infrastructure & VPS inventory', enabled: true },
        { key: 'websites', name: 'Websites', description: 'Web applications and hosted sites', enabled: true },
        { key: 'alerts', name: 'Alerts', description: 'Domain and SSL expiry push notifications', enabled: true },
        { key: 'providers', name: 'Providers', description: 'Connected registrar accounts and sync', enabled: true },
        { key: 'infrastructureMap', name: 'Infrastructure Map', description: 'Interactive visual topology graph', enabled: true },
        { key: 'aiDomainFinder', name: 'AI Domain Finder', description: 'AI brand generator & multi-TLD availability', enabled: true },
      ]);
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
      const updated = await mobileAdminClient.updateFeature(key, {
        enabled: !currentEnabled,
      });
      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled: updated.enabled } : f)),
      );
      setToast(`Feature '${key}' ${updated.enabled ? 'enabled' : 'disabled'} successfully`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast(`Failed to update feature '${key}'`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUpdatingKey(null);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading mobile feature flags...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Mobile Feature Flags</h2>
        <p className="text-sm text-slate-400 mt-1">
          Turn features on or off remotely for all connected mobile devices without pushing an app store update.
        </p>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-800">
          {flags.map((flag) => (
            <div key={flag.key} className="p-5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{flag.name}</span>
                  <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {flag.key}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{flag.description}</p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    flag.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {flag.enabled ? 'ACTIVE' : 'DISABLED'}
                </span>

                <button
                  onClick={() => handleToggle(flag.key, flag.enabled)}
                  disabled={updatingKey === flag.key}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    flag.enabled
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                  } disabled:opacity-50`}
                >
                  {updatingKey === flag.key ? 'Saving...' : flag.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
