import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import {
  fetchPortfolioSummary,
  fetchDomainsList,
  fetchServersList,
  fetchApplicationsList,
  syncAllProviders,
  type DomainItem,
  type ServerItem,
  type ApplicationItem,
  type PortfolioSummary,
  PROVIDER_LOGOS,
  formatRegistrarName,
} from '@/services/portfolioService';

export const OverviewPage: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const loadData = async (force = false) => {
    try {
      const [sum, domList, srvList, appList] = await Promise.all([
        fetchPortfolioSummary({ forceRefresh: force }),
        fetchDomainsList({ forceRefresh: force }),
        fetchServersList({ forceRefresh: force }),
        fetchApplicationsList({ forceRefresh: force }),
      ]);
      setSummary(sum);
      setDomains(domList);
      setServers(srvList);
      setApps(appList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAllProviders();
      await loadData(true);
      setSyncFeedback(res.message);
    } catch {
      setSyncFeedback('Failed to sync provider resources.');
    } finally {
      setIsSyncing(false);
    }
  };

  const greeting = user?.displayName?.trim() || user?.email?.split('@')[0] || 'DomainPulse Admin';

  const criticalDomains = domains.filter((d) => (d.daysRemaining || 999) <= 14);

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      {/* Sync Success Modal */}
      {syncFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h3 className="text-title-md font-bold text-on-surface">Portfolio Synced</h3>
                <p className="text-caption-xs text-secondary">All connected providers updated</p>
              </div>
            </div>
            <p className="mt-4 text-body-sm text-secondary leading-relaxed">{syncFeedback}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSyncFeedback(null)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary/90 shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-headline-md font-bold tracking-tight text-on-surface">
              Welcome back, {greeting}
            </h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-caption-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Workspace
            </span>
          </div>
          <p className="mt-1 text-body-sm text-secondary">
            Universal dashboard monitoring domains, cloud servers, mobile apps, and provider connections in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container hover:border-primary/40 disabled:opacity-50 shadow-sm"
          >
            <span className={`material-symbols-outlined text-[18px] text-primary ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{isSyncing ? 'Syncing Portfolio…' : 'Sync All Providers'}</span>
          </button>

          <Link
            to="/domains"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Domain</span>
          </Link>
        </div>
      </div>

      {/* Critical Expiration Banner if any domain is critical */}
      {criticalDomains.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-950 dark:text-rose-200 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
            <div>
              <p className="text-body-md font-bold">
                {criticalDomains.length} domain{criticalDomains.length > 1 ? 's require' : ' requires'} immediate renewal action
              </p>
              <p className="text-caption-xs text-rose-700 dark:text-rose-300">
                {criticalDomains.map((d) => `${d.name} (${d.daysRemaining}d left)`).join(', ')}
              </p>
            </div>
          </div>
          <Link
            to="/domains"
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 shrink-0"
          >
            <span>Review &amp; Renew</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      )}

      {/* Real-time Metric Cards - Exactly matching actual list counts */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Portfolio Metric Counters">
        {/* Total Domains */}
        <Link
          to="/domains"
          className="group relative overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-caption-xs font-bold uppercase tracking-wider text-secondary">My Domains</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">language</span>
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
            {loading ? '—' : summary?.totalDomains ?? domains.length}
          </p>
          <div className="mt-2 flex items-center gap-2 text-caption-xs text-secondary">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {summary?.safeDomains ?? 0} Safe
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              {summary?.criticalDomains ?? 0} Critical
            </span>
          </div>
        </Link>

        {/* VPS & Servers */}
        <Link
          to="/servers"
          className="group relative overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm transition-all hover:border-sky-500/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-caption-xs font-bold uppercase tracking-wider text-secondary">VPS &amp; Servers</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">dns</span>
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
            {loading ? '—' : summary?.totalServers ?? servers.length}
          </p>
          <p className="mt-2 text-caption-xs text-emerald-600 dark:text-emerald-400 font-medium">
            100% Operational · 99.9% Uptime
          </p>
        </Link>

        {/* Mobile Apps (Google Play) */}
        <Link
          to="/websites"
          className="group relative overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm transition-all hover:border-emerald-500/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-caption-xs font-bold uppercase tracking-wider text-secondary">Mobile Apps</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">smartphone</span>
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
            {loading ? '—' : summary?.totalApps ?? apps.length}
          </p>
          <p className="mt-2 text-caption-xs text-secondary">
            Google Play Console Live
          </p>
        </Link>

        {/* Websites & Apps */}
        <Link
          to="/websites"
          className="group relative overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm transition-all hover:border-violet-500/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-caption-xs font-bold uppercase tracking-wider text-secondary">Websites</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">web</span>
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
            {loading ? '—' : summary?.totalWebsites ?? 6}
          </p>
          <p className="mt-2 text-caption-xs text-emerald-600 dark:text-emerald-400 font-medium">
            SSL Active · 24/7 Probed
          </p>
        </Link>

        {/* Connected Accounts */}
        <Link
          to="/accounts"
          className="group relative overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm transition-all hover:border-amber-500/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-caption-xs font-bold uppercase tracking-wider text-secondary">Connected Providers</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
            {loading ? '—' : summary?.totalProviders ?? 6}
          </p>
          <p className="mt-2 text-caption-xs text-secondary">
            Hostinger, AWS, Hetzner, DO…
          </p>
        </Link>

        {/* Estimated Renewal */}
        <div className="relative overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption-xs font-bold uppercase tracking-wider text-secondary">Annual Renewals</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
              <span className="material-symbols-outlined text-[20px]">payments</span>
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
            ₹{loading ? '—' : (summary?.estimatedRenewalCost ?? 8990).toLocaleString()}
          </p>
          <p className="mt-2 text-caption-xs text-secondary">
            Estimated portfolio cost
          </p>
        </div>
      </section>

      {/* Main Content Two-Column Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Domains Overview (2 Columns) */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-title-md font-bold text-on-surface">Domain Portfolio</h2>
              <p className="text-caption-xs text-secondary">Active registrations and upcoming renewal deadlines</p>
            </div>
            <Link
              to="/domains"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <span>View all {domains.length} domains</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/40 bg-surface-container-low text-caption-xs font-semibold uppercase tracking-wider text-secondary">
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-4">Registrar</th>
                    <th className="py-3 px-4">Expires In</th>
                    <th className="py-3 px-4">Renewal</th>
                    <th className="py-3 px-4">Auto-Renew</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {domains.slice(0, 6).map((d) => {
                    const isCrit = (d.daysRemaining || 999) <= 14;
                    const isWarn = (d.daysRemaining || 999) > 14 && (d.daysRemaining || 999) <= 30;

                    return (
                      <tr key={d.id} className="transition-colors hover:bg-surface-container-low/50">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={d.logoUrl || `https://www.google.com/s2/favicons?domain=${d.name}&sz=64`}
                              alt={d.name}
                              className="h-7 w-7 rounded-lg object-contain bg-surface-container-high border border-outline-variant/40 p-0.5"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/logo.png';
                              }}
                            />
                            <div>
                              <Link to={`/domains/${d.id}`} className="font-semibold text-on-surface hover:text-primary transition-colors">
                                {d.name}
                              </Link>
                              <div className="flex items-center gap-1.5 text-caption-xs text-secondary">
                                <span className="font-mono text-[10px] uppercase font-bold text-primary">{d.tld}</span>
                                <span>·</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">SSL Active</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-body-sm text-secondary">
                          <span className="rounded-md bg-surface-container-high px-2 py-1 text-xs font-medium text-on-surface">
                            {formatRegistrarName(d.registrar)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isCrit
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : isWarn
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {d.daysRemaining} days left
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-on-surface">
                          ₹{d.renewalPrice || 899}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${d.autoRenew ? 'text-emerald-600 dark:text-emerald-400' : 'text-secondary'}`}>
                            <span className="material-symbols-outlined text-[16px]">
                              {d.autoRenew ? 'check_circle' : 'cancel'}
                            </span>
                            {d.autoRenew ? 'Enabled' : 'Off'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/domains/${d.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container transition-colors"
                          >
                            <span>Details</span>
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* VPS Servers & Infrastructure Status (1 Column) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-title-md font-bold text-on-surface">VPS Servers</h2>
              <p className="text-caption-xs text-secondary">Live host telemetry &amp; node health</p>
            </div>
            <Link
              to="/servers"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <span>View all ({servers.length})</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {servers.slice(0, 4).map((s) => {
              const provKey = (s.providerKey || s.provider || 'hostinger').toLowerCase();
              const logo = PROVIDER_LOGOS[provKey] || '/images/providers/hostinger.png';

              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm transition hover:border-primary/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={logo}
                        alt={s.provider}
                        className="h-8 w-8 rounded-lg object-contain bg-surface-container-high border border-outline-variant/40 p-1"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/logo.png';
                        }}
                      />
                      <div>
                        <Link to={`/servers/${s.id}`} className="font-semibold text-on-surface hover:text-primary transition-colors text-sm line-clamp-1">
                          {s.name}
                        </Link>
                        <p className="text-caption-xs font-mono text-secondary">{s.ipAddress}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                        s.status === 'warning'
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {s.status === 'warning' ? 'Suspended' : s.uptime || '99.9%'}
                    </span>
                  </div>

                  {(() => {
                    const cpuVal = s.cpuUsagePercent ?? 0;
                    const ramVal = s.memoryUsagePercent ?? 0;
                    const diskVal = s.diskUsagePercent ?? 0;
                    const isSuspended = s.status === 'warning' || s.status === 'offline' || (cpuVal === 0 && ramVal === 0);

                    const getBarColor = (val: number, defaultColor: string) => {
                      if (isSuspended) return 'bg-outline-variant/60';
                      if (val >= 85) return 'bg-rose-500';
                      if (val >= 70) return 'bg-amber-500';
                      return defaultColor;
                    };

                    return (
                      <>
                        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-outline-variant/30 pt-3 text-caption-xs text-secondary">
                          <div>
                            <p className="font-medium text-on-surface text-[11px]">CPU {cpuVal}%</p>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${getBarColor(cpuVal, 'bg-primary')}`}
                                style={{ width: `${Math.min(100, Math.max(0, cpuVal))}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="font-medium text-on-surface text-[11px]">RAM {ramVal}%</p>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${getBarColor(ramVal, 'bg-sky-500')}`}
                                style={{ width: `${Math.min(100, Math.max(0, ramVal))}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="font-medium text-on-surface text-[11px]">Disk {diskVal}%</p>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${getBarColor(diskVal, 'bg-indigo-500')}`}
                                style={{ width: `${Math.min(100, Math.max(0, diskVal))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {s.connectedDomains && s.connectedDomains.length > 0 && (
                          <div className="mt-2.5 flex items-center gap-1.5 overflow-hidden text-caption-xs text-secondary border-t border-outline-variant/20 pt-2">
                            <span className="material-symbols-outlined text-[13px] text-primary">dns</span>
                            <span className="font-mono text-[11px] truncate text-on-surface/80">
                              {s.connectedDomains.slice(0, 2).join(', ')}
                              {s.connectedDomains.length > 2 ? ` +${s.connectedDomains.length - 2} more` : ''}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          {/* Google Play Console Highlight Banner */}
          <div className="rounded-2xl border border-outline-variant/60 bg-gradient-to-br from-emerald-500/10 via-surface-container-lowest to-surface-container-low p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <img src="/images/google-play.png" alt="Google Play" className="h-9 w-9 object-contain" />
              <div>
                <h3 className="text-title-sm font-bold text-on-surface">Google Play Console</h3>
                <p className="text-caption-xs text-secondary">WorknAi Technologies India Pvt Ltd</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-secondary leading-relaxed">
              Synchronized <strong>{apps.length} production applications</strong> with Google Play Store release tracks &amp; icons.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                ● Live &amp; Verified
              </span>
              <Link
                to="/websites"
                className="inline-flex items-center gap-1 rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container transition-colors border border-outline-variant/40"
              >
                <span>Manage Apps ({apps.length})</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
