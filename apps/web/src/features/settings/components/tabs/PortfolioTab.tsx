import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { PortfolioSettings } from '../../settings.types';
import {
  fetchDomainsList,
  fetchServersList,
  fetchWebsitesList,
  fetchApplicationsList,
} from '@/services/portfolioService';

interface PortfolioTabProps {
  settings: PortfolioSettings;
  onChange: (updated: Partial<PortfolioSettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

const SOURCES: Array<{
  key: keyof PortfolioSettings['metadataSources'];
  label: string;
  badge: string;
  icon: string;
  purpose: string;
  details: string;
}> = [
  {
    key: 'rdap',
    label: 'RDAP / WHOIS',
    badge: 'Registry Sync',
    icon: 'badge',
    purpose: 'Registration, expiry dates, registrar lock & contacts',
    details: 'Pings authoritative TLD registries to monitor domain ownership status, registration dates, and renewal requirements.',
  },
  {
    key: 'dns',
    label: 'DNS Resolution',
    badge: 'Zone Health',
    icon: 'dns',
    purpose: 'Nameserver verification & record propagation',
    details: 'Verifies nameserver responsiveness, A/AAAA records, MX routing, and flags unauthorized DNS alterations.',
  },
  {
    key: 'tls',
    label: 'TLS / SSL Certificates',
    badge: 'Security',
    icon: 'shield',
    purpose: 'Certificate authority, cipher validity & expiry',
    details: 'Inspects SSL/TLS certificates across active endpoints to catch impending expirations before browsers display security warnings.',
  },
  {
    key: 'http',
    label: 'HTTP Web Probing',
    badge: 'Availability',
    icon: 'http',
    purpose: 'HTTP response codes, redirects & latency',
    details: 'Monitors web response codes (200 OK, redirects, 404/500 errors) and measures endpoint latency.',
  },
  {
    key: 'infra',
    label: 'Infrastructure & Cloud',
    badge: 'Host Telemetry',
    icon: 'cloud',
    purpose: 'Host IP allocation, reverse DNS & server mapping',
    details: 'Resolves IP assignments and maps servers to hosted domains for unified infrastructure visibility.',
  },
];

const segmentClass = (active: boolean) =>
  `px-3.5 py-1.5 font-label-md text-label-md rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
    active
      ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/30'
      : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
  }`;

const numberInputClass =
  'h-9 px-3 mt-1.5 rounded-lg bg-surface-container-low text-on-surface font-label-mono text-label-md border border-outline-variant/40 focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest focus:outline-none w-full shadow-inner';

export const PortfolioTab: React.FC<PortfolioTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  const [assetCounts, setAssetCounts] = useState<{
    domains: number;
    servers: number;
    websites: number;
    apps: number;
  }>({
    domains: 19,
    servers: 4,
    websites: 51,
    apps: 26,
  });

  useEffect(() => {
    void Promise.allSettled([
      fetchDomainsList(),
      fetchServersList(),
      fetchWebsitesList(),
      fetchApplicationsList(),
    ]).then(([d, s, w, a]) => {
      setAssetCounts({
        domains: d.status === 'fulfilled' ? d.value.length : 19,
        servers: s.status === 'fulfilled' ? s.value.length : 4,
        websites: w.status === 'fulfilled' ? w.value.length : 51,
        apps: a.status === 'fulfilled' ? a.value.length : 26,
      });
    });
  }, []);

  const enabledCount = Object.values(settings.metadataSources).filter(Boolean).length;
  const thresholdsValid =
    Number.isInteger(settings.criticalThresholdDays) &&
    Number.isInteger(settings.warningThresholdDays) &&
    settings.criticalThresholdDays >= 1 &&
    settings.criticalThresholdDays <= 365 &&
    settings.warningThresholdDays > settings.criticalThresholdDays &&
    settings.warningThresholdDays <= 730;

  const parseDays = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  return (
    <section className="flex flex-col gap-unit-lg pb-unit-2xl">
      {/* 1. Portfolio Definition & Purpose Card */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-surface-container-lowest to-surface-container-low/50 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <span className="material-symbols-outlined text-[28px]">folder_special</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                  Portfolio Scope &amp; Automation Policy
                </h3>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary border border-primary/20">
                  CENTRAL ASSET REGISTRY
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary mt-1.5 max-w-3xl leading-relaxed">
                The <strong>Portfolio</strong> is DomainPulse&apos;s unified operational registry for all organizational web infrastructure.
                Configuring this section sets the global risk classification horizons, automated health check frequencies, and metadata discovery rules across your domains, servers, websites, and applications.
              </p>
            </div>
          </div>
        </div>

        {/* Live Footprint Metric Badges */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-outline-variant/30 pt-4">
          <Link
            to="/domains"
            className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 transition hover:border-primary/50"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Domains</p>
              <p className="font-mono text-xl font-bold text-on-surface mt-0.5">{assetCounts.domains}</p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-primary">language</span>
          </Link>

          <Link
            to="/servers"
            className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 transition hover:border-primary/50"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Cloud Servers</p>
              <p className="font-mono text-xl font-bold text-on-surface mt-0.5">{assetCounts.servers}</p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-sky-600">dns</span>
          </Link>

          <Link
            to="/websites"
            className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 transition hover:border-primary/50"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Websites</p>
              <p className="font-mono text-xl font-bold text-on-surface mt-0.5">{assetCounts.websites}</p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-indigo-600">web</span>
          </Link>

          <Link
            to="/websites?tab=apps"
            className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 transition hover:border-primary/50"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Mobile Apps</p>
              <p className="font-mono text-xl font-bold text-on-surface mt-0.5">{assetCounts.apps}</p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-emerald-600">phone_android</span>
          </Link>
        </div>
      </div>

      {/* 2. Core Purpose & Pillars of DomainPulse Portfolio */}
      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/30">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-[20px] text-primary">account_tree</span>
          <h4 className="font-title-md text-title-md text-on-surface font-semibold">
            How Portfolio Management Functions
          </h4>
        </div>
        <p className="font-body-sm text-body-sm text-secondary mb-4">
          Every asset in your workspace is categorized into one of four core pillars, each governed by the policies configured below:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low/40 p-4">
            <span className="material-symbols-outlined text-[24px] text-primary shrink-0 mt-0.5">language</span>
            <div>
              <h5 className="font-semibold text-on-surface text-sm">1. Domain Lifecycle &amp; Registry Monitoring</h5>
              <p className="text-caption-xs text-secondary mt-1 leading-relaxed">
                Tracks registration and expiry dates across all registrars (Hostinger, Namecheap, GoDaddy, etc.). Prevents accidental domain drop and registry deletion using the risk horizons below.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low/40 p-4">
            <span className="material-symbols-outlined text-[24px] text-sky-600 shrink-0 mt-0.5">dns</span>
            <div>
              <h5 className="font-semibold text-on-surface text-sm">2. Cloud Infrastructure &amp; VPS Telemetry</h5>
              <p className="text-caption-xs text-secondary mt-1 leading-relaxed">
                Monitors host status, CPU/memory performance, SSH port security, and maps which domains route to each server IP.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low/40 p-4">
            <span className="material-symbols-outlined text-[24px] text-indigo-600 shrink-0 mt-0.5">web</span>
            <div>
              <h5 className="font-semibold text-on-surface text-sm">3. Web Endpoints &amp; SSL Certificates</h5>
              <p className="text-caption-xs text-secondary mt-1 leading-relaxed">
                Verifies public URL availability, HTTP status codes, and tracks SSL/TLS certificate validity to prevent browser security warnings.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low/40 p-4">
            <span className="material-symbols-outlined text-[24px] text-emerald-600 shrink-0 mt-0.5">phone_android</span>
            <div>
              <h5 className="font-semibold text-on-surface text-sm">4. Mobile Applications &amp; Release Tracks</h5>
              <p className="text-caption-xs text-secondary mt-1 leading-relaxed">
                Synchronizes Android app packages from Google Play Console, tracking production tracks, versioning, and developer account connectivity.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Expiry Risk Classification Horizons */}
      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/30">
        <div className="flex flex-col pb-4 border-b border-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-amber-600">hourglass_top</span>
            <h4 className="font-title-md text-title-md text-on-surface font-semibold">
              Expiry Risk Classification Policy
            </h4>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Defines the threshold days used to categorize domain and SSL certificate health across the Overview, My Domains, Alerts, and Notification Reminders.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          {/* Critical Horizon */}
          <div className="p-4 rounded-xl bg-error/5 border border-error/25 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md font-semibold text-error flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  Critical Risk
                </span>
                <span className="px-2 py-0.5 rounded-full bg-error/15 text-error font-mono text-[11px] font-bold">
                  &le; {settings.criticalThresholdDays} days
                </span>
              </div>
              <p className="text-caption-xs text-secondary mt-2 leading-relaxed">
                Triggers critical red alerts across all views. Assets within this window require immediate renewal to avoid service disruption or registry deletion.
              </p>
            </div>
            <div className="mt-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-secondary block">
                Critical Threshold (Days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={settings.criticalThresholdDays}
                onChange={(event) =>
                  onChange({ criticalThresholdDays: parseDays(event.target.value, settings.criticalThresholdDays) })
                }
                aria-label="Critical threshold in days"
                className={numberInputClass}
              />
            </div>
          </div>

          {/* Warning Horizon */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/25 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  Early Warning
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono text-[11px] font-bold">
                  &le; {settings.warningThresholdDays} days
                </span>
              </div>
              <p className="text-caption-xs text-secondary mt-2 leading-relaxed">
                Marks assets in amber. Indicates renewal review is recommended before entering the critical danger zone.
              </p>
            </div>
            <div className="mt-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-secondary block">
                Warning Threshold (Days)
              </label>
              <input
                type="number"
                min={2}
                max={730}
                value={settings.warningThresholdDays}
                onChange={(event) =>
                  onChange({ warningThresholdDays: parseDays(event.target.value, settings.warningThresholdDays) })
                }
                aria-label="Warning threshold in days"
                className={numberInputClass}
              />
            </div>
          </div>

          {/* Healthy Horizon */}
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/25 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  Healthy / Monitored
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-bold">
                  &gt; {settings.warningThresholdDays} days
                </span>
              </div>
              <p className="text-caption-xs text-secondary mt-2 leading-relaxed">
                Assets with sufficient registration validity. Monitored periodically without triggering priority alerts.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-500/20">
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                Active safe buffer: {settings.warningThresholdDays}+ days
              </span>
            </div>
          </div>
        </div>

        {!thresholdsValid && (
          <p role="alert" className="mt-3 font-caption-xs text-caption-xs text-error font-medium">
            Threshold error: Critical must be between 1 and 365 days, and Warning must be greater than Critical (up to 730 days).
          </p>
        )}
      </div>

      {/* 4. Automated Metadata Probing Sources */}
      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/30">
        <div className="flex flex-col pb-4 border-b border-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">network_ping</span>
            <h4 className="font-title-md text-title-md text-on-surface font-semibold">
              Live Probing &amp; Metadata Verification Sources
            </h4>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Choose which verification checks DomainPulse runs when probing your portfolio assets. At least one source must remain active.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
          {SOURCES.map((source) => {
            const checked = settings.metadataSources[source.key];
            const isLastEnabled = checked && enabledCount === 1;

            return (
              <label
                key={source.key}
                className={`flex flex-col justify-between p-4 rounded-xl border transition ${
                  checked
                    ? 'border-primary/40 bg-surface-container-lowest hover:border-primary shadow-sm'
                    : 'border-outline-variant/30 bg-surface-container-low/40 opacity-70 hover:opacity-100'
                } ${isLastEnabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-primary">{source.icon}</span>
                      <span className="font-semibold text-on-surface text-sm">{source.label}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isLastEnabled}
                      onChange={(event) =>
                        onChange({
                          metadataSources: { ...settings.metadataSources, [source.key]: event.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-primary"
                    />
                  </div>
                  <span className="inline-block mt-1.5 rounded bg-surface-container-high px-2 py-0.5 text-[10px] font-mono font-semibold text-secondary">
                    {source.badge}
                  </span>
                  <p className="mt-2 text-caption-xs text-secondary leading-relaxed">
                    {source.details}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* 5. Automation & Provisioning Policies */}
      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/30">
        <div className="flex flex-col pb-4 border-b border-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
            <h4 className="font-title-md text-title-md text-on-surface font-semibold">
              Sync Automation &amp; Provisioning Defaults
            </h4>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Controls background retrieval schedules and default settings when adding new assets to your portfolio.
          </p>
        </div>

        <div className="flex flex-col gap-4 mt-5">
          {/* Metadata Refresh Schedule */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/25">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Automatic Refresh Schedule
              </span>
              <span className="text-caption-xs text-secondary mt-0.5 max-w-xl">
                When set to <strong>When Opened</strong>, DomainPulse automatically refreshes WHOIS, DNS, and TLS metadata if it has not been refreshed in the last 24 hours. Choose <strong>Manual Only</strong> to conserve external API quotas.
              </span>
            </div>
            <div className="flex p-1 bg-surface-container rounded-xl shrink-0 border border-outline-variant/30">
              <button
                type="button"
                onClick={() => onChange({ automaticMetadataRefresh: 'on-open' })}
                className={segmentClass(settings.automaticMetadataRefresh === 'on-open')}
              >
                When Opened
              </button>
              <button
                type="button"
                onClick={() => onChange({ automaticMetadataRefresh: 'manual' })}
                className={segmentClass(settings.automaticMetadataRefresh === 'manual')}
              >
                Manual Only
              </button>
            </div>
          </div>

          {/* Auto-fetch on creation */}
          <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/25 cursor-pointer hover:bg-surface-container-low transition">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Instant Discovery on Asset Creation
              </span>
              <span className="text-caption-xs text-secondary mt-0.5 max-w-xl">
                Immediately dispatch background WHOIS and DNS probes as soon as a new domain or server is added to your portfolio.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoFetchMetadataOnCreation}
              onChange={(event) => onChange({ autoFetchMetadataOnCreation: event.target.checked })}
              className="w-5 h-5 accent-primary shrink-0"
            />
          </label>

          {/* Default Auto-Renew for new domains */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/25">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Default Auto-Renew Policy for Added Domains
              </span>
              <span className="text-caption-xs text-secondary mt-0.5 max-w-xl">
                Initial auto-renew flag assigned when new domains are imported or manually registered. Domains with auto-renew disabled receive prioritized renewal notifications.
              </span>
            </div>
            <div className="flex p-1 bg-surface-container rounded-xl shrink-0 border border-outline-variant/30">
              {(['on', 'off', 'unknown'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ defaultAutoRenew: value })}
                  className={segmentClass(settings.defaultAutoRenew === value)}
                >
                  {value === 'on' ? 'Enabled (On)' : value === 'off' ? 'Disabled (Off)' : 'Unspecified'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 pt-4 border-t border-surface-container-low flex items-center justify-between">
          <p className="text-caption-xs text-secondary">
            Changes apply across all portfolio views, risk filters, and scheduled monitoring checks.
          </p>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !thresholdsValid}
            className="h-10 px-6 rounded-xl bg-primary text-on-primary font-label-md text-sm font-semibold hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>{isSaving ? 'Saving Policy...' : 'Save Portfolio Policy & Settings'}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
