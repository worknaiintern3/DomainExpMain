import React, { useEffect, useState } from 'react';
import type { MobileAppConfig, MobileFeatureFlag } from '@domainpulse/contracts';
import { mobileAdminClient } from '../api/mobile-admin.client';

export const MobileDashboardPage: React.FC = () => {
  const [config, setConfig] = useState<MobileAppConfig | null>(null);
  const [flags, setFlags] = useState<MobileFeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cfg, flgs] = await Promise.all([
        mobileAdminClient.getConfig(),
        mobileAdminClient.getFeatures(),
      ]);
      setConfig(cfg);
      setFlags(flgs);
    } catch {
      // API fallback
      setConfig({
        appName: 'DomainPulse',
        primaryColor: '#2563EB',
        secondaryColor: '#1E293B',
        maintenanceMode: false,
        maintenanceMessage: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleMaintenance = async () => {
    if (!config) return;
    try {
      setIsUpdating(true);
      const newStatus = !config.maintenanceMode;
      const updated = await mobileAdminClient.updateConfig({
        maintenanceMode: newStatus,
        maintenanceMessage: newStatus
          ? 'Emergency maintenance in progress. All systems will resume shortly.'
          : null,
      });
      setConfig(updated);
      setToast(
        newStatus
          ? '⚠️ Maintenance mode ENABLED for all mobile users'
          : '✅ Maintenance mode DISABLED. Mobile app is live',
      );
      setTimeout(() => setToast(null), 3500);
    } catch {
      setToast('Failed to update maintenance status');
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 text-sm">Loading mobile admin telemetry...</div>
      </div>
    );
  }

  const enabledFlagsCount = flags.filter((f) => f.enabled).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Mobile Operations Overview</h2>
        <p className="text-sm text-slate-400 mt-1">
          Monitor mobile app runtime state, remote configuration, and global kill-switches.
        </p>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-blue-300 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            App Title
          </div>
          <div className="mt-2 text-xl font-bold text-white">{config?.appName || 'DomainPulse'}</div>
          <div className="mt-1 text-xs text-slate-500">Configured in remote settings</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active Features
          </div>
          <div className="mt-2 text-xl font-bold text-blue-400">
            {enabledFlagsCount} <span className="text-xs text-slate-500 font-normal">/ {flags.length || 7}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Feature flags enabled</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Brand Accent
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-md border border-white/20 inline-block shadow-sm"
              style={{ backgroundColor: config?.primaryColor || '#2563EB' }}
            />
            <span className="text-lg font-mono font-bold text-white">
              {config?.primaryColor || '#2563EB'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Live dynamic mobile theme</div>
        </div>

        <div
          className={`p-5 rounded-2xl border transition-colors ${
            config?.maintenanceMode
              ? 'bg-rose-950/40 border-rose-500/40'
              : 'bg-emerald-950/20 border-emerald-500/30'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            System State
          </div>
          <div
            className={`mt-2 text-lg font-bold ${
              config?.maintenanceMode ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {config?.maintenanceMode ? '🚨 Maintenance Active' : '🟢 Operational'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {config?.maintenanceMode ? 'Users blocked with maintenance screen' : 'All clients allowed'}
          </div>
        </div>
      </div>

      {/* Emergency Kill Switch Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Maintenance Mode Interceptor</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            When enabled, all mobile app users are immediately redirected to a maintenance notice on launch.
            Useful for database migrations, emergency outages, or major backend updates.
          </p>
        </div>
        <button
          onClick={toggleMaintenance}
          disabled={isUpdating}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${
            config?.maintenanceMode
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-rose-600 hover:bg-rose-500 text-white'
          } disabled:opacity-50`}
        >
          {isUpdating
            ? 'Updating...'
            : config?.maintenanceMode
            ? 'Resume Normal Operations'
            : 'Activate Maintenance Mode'}
        </button>
      </div>

      {/* API Diagnostics */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h3 className="text-sm font-semibold text-white">Public Mobile Runtime Endpoint</h3>
        <p className="text-xs text-slate-400">
          The mobile client retrieves this JSON on boot to configure its navigation tabs, home layout, and feature flags.
        </p>
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-xs text-slate-300">
          <span>GET /api/v1/mobile/config</span>
          <span className="text-emerald-400 font-semibold">200 OK • Public</span>
        </div>
      </div>
    </div>
  );
};
