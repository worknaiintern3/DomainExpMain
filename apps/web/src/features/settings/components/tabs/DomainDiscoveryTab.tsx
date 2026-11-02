import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { SUPPORTED_TLDS } from '@/features/find-domain';
import {
  clearRecentSearches,
  readRecentSearches,
  RECENT_SEARCHES_CHANGED_EVENT,
} from '@/lib/recentSearches';

import type { DomainDiscoverySettings } from '../../settings.types';

interface DomainDiscoveryTabProps {
  settings: DomainDiscoverySettings;
  onChange: (updated: Partial<DomainDiscoverySettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

interface TldMeta {
  tld: string;
  category: 'Commercial' | 'Tech & AI' | 'Regional' | 'Infrastructure' | 'Non-Profit';
  badge: string;
  description: string;
}

const TLD_METADATA: Record<string, TldMeta> = {
  '.com': { tld: '.com', category: 'Commercial', badge: 'Global Standard', description: "World's premier commercial namespace" },
  '.in': { tld: '.in', category: 'Regional', badge: 'India National (NIXI)', description: 'Official country-code registry for India' },
  '.co.in': { tld: '.co.in', category: 'Regional', badge: 'India Enterprise', description: 'Commercial sub-domain registry for Indian businesses' },
  '.ai': { tld: '.ai', category: 'Tech & AI', badge: 'Artificial Intelligence', description: 'Leading namespace for AI models and machine intelligence' },
  '.io': { tld: '.io', category: 'Tech & AI', badge: 'Developer & SaaS', description: 'De-facto standard for developer tooling and SaaS platforms' },
  '.co': { tld: '.co', category: 'Commercial', badge: 'Global Commercial', description: 'Modern, agile alternative for tech startups and brands' },
  '.dev': { tld: '.dev', category: 'Tech & AI', badge: 'Google Dev Registry', description: 'Secure namespace with built-in HSTS encryption enforcement' },
  '.app': { tld: '.app', category: 'Tech & AI', badge: 'App Ecosystem', description: 'Dedicated namespace for mobile, desktop, and web applications' },
  '.tech': { tld: '.tech', category: 'Tech & AI', badge: 'Tech Startups', description: 'Brandable extension for engineering companies and builders' },
  '.net': { tld: '.net', category: 'Infrastructure', badge: 'Network Systems', description: 'Classic top-level domain for networking and infrastructure' },
  '.org': { tld: '.org', category: 'Non-Profit', badge: 'Organizations', description: 'Trusted namespace for foundations, non-profits, and communities' },
};

const SORT_OPTIONS: Array<{
  value: DomainDiscoverySettings['defaultSearchSort'];
  label: string;
  icon: string;
  hint: string;
  detail: string;
}> = [
  {
    value: 'availability',
    label: 'Availability First',
    icon: 'verified',
    hint: 'Available domains and premium opportunities first',
    detail: 'Ranks directly available and unregistered extensions above taken or guarded domains.',
  },
  {
    value: 'price',
    label: 'Lowest First-Year Price',
    icon: 'payments',
    hint: 'Cheapest initial registration fee first',
    detail: 'Orders candidate domains from lowest first-year promotional rate to highest.',
  },
  {
    value: 'tld',
    label: 'Alphabetical by TLD',
    icon: 'sort_by_alpha',
    hint: 'A–Z extension ordering',
    detail: 'Arranges extensions alphabetically from .ai to .tech for standardized navigation.',
  },
  {
    value: 'match',
    label: 'Registry Priority Order',
    icon: 'format_list_numbered',
    hint: 'Curated standard sequence',
    detail: 'Maintains DomainPulse’s default hierarchical TLD ranking (.com, .in, .ai, .io...).',
  },
];

const PRESET_GROUPS: Array<{
  label: string;
  icon: string;
  tlds: string[];
}> = [
  {
    label: 'Commercial & Brand',
    icon: 'storefront',
    tlds: ['.com', '.net', '.org', '.co'],
  },
  {
    label: 'Tech & AI Pioneers',
    icon: 'psychology',
    tlds: ['.ai', '.io', '.dev', '.app', '.tech'],
  },
  {
    label: 'India & Regional',
    icon: 'flag',
    tlds: ['.in', '.co.in'],
  },
  {
    label: 'Select All 11',
    icon: 'done_all',
    tlds: SUPPORTED_TLDS,
  },
  {
    label: 'Recommended Default (8)',
    icon: 'restart_alt',
    tlds: ['.com', '.in', '.co.in', '.ai', '.io', '.dev', '.app', '.tech'],
  },
];

export const DomainDiscoveryTab: React.FC<DomainDiscoveryTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  const [historyCount, setHistoryCount] = useState(() => readRecentSearches().length);
  const [historyClearedMessage, setHistoryClearedMessage] = useState(false);
  const [previewKeyword, setPreviewKeyword] = useState('brandpulse');

  const checked = useMemo(() => new Set(settings.defaultCheckedTlds), [settings.defaultCheckedTlds]);

  useEffect(() => {
    const refreshCount = () => setHistoryCount(readRecentSearches().length);
    window.addEventListener('storage', refreshCount);
    window.addEventListener(RECENT_SEARCHES_CHANGED_EVENT, refreshCount);
    return () => {
      window.removeEventListener('storage', refreshCount);
      window.removeEventListener(RECENT_SEARCHES_CHANGED_EVENT, refreshCount);
    };
  }, []);

  const toggleTld = (tld: string) => {
    const next = checked.has(tld)
      ? settings.defaultCheckedTlds.filter((entry) => entry !== tld)
      : [...settings.defaultCheckedTlds, tld];
    if (next.length === 0) return; // Enforce minimum 1 extension
    onChange({ defaultCheckedTlds: SUPPORTED_TLDS.filter((entry) => next.includes(entry)) });
  };

  const applyPreset = (tlds: string[]) => {
    onChange({ defaultCheckedTlds: SUPPORTED_TLDS.filter((entry) => tlds.includes(entry)) });
  };

  const handleClearHistory = () => {
    clearRecentSearches();
    setHistoryCount(0);
    setHistoryClearedMessage(true);
    setTimeout(() => setHistoryClearedMessage(false), 3000);
  };

  // Preview generated domains based on current settings
  const previewDomains = useMemo(() => {
    const clean = previewKeyword.trim().toLowerCase().replace(/[^a-z0-9-]/gu, '') || 'brandpulse';
    const activeTlds = settings.availabilityCheckMode === 'all' ? SUPPORTED_TLDS : settings.defaultCheckedTlds;
    return activeTlds.map((tld) => `${clean}${tld}`);
  }, [previewKeyword, settings.availabilityCheckMode, settings.defaultCheckedTlds]);

  return (
    <section className="flex flex-col gap-unit-lg pb-unit-2xl">
      {/* 1. Definition & Purpose Header Card */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-surface-container-lowest to-surface-container-low/50 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <span className="material-symbols-outlined text-[28px]">travel_explore</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                  Domain Discovery &amp; Search Engine
                </h3>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary border border-primary/20">
                  REGISTRY &amp; PRICING INTELLIGENCE
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary mt-1.5 max-w-3xl leading-relaxed">
                <strong>Domain Discovery</strong> is DomainPulse&apos;s real-time scanning engine that queries ICANN and national ccTLD registries concurrently.
                Configuring this section controls your pre-selected extensions, availability probe policies, multi-registrar price comparison rankings, and client-side privacy defaults across the <strong>Find Domain</strong> page.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/find-domain"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-label-md font-semibold text-on-primary shadow-micro hover:bg-primary/90 transition"
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
              <span>Launch Find Domain</span>
            </Link>
          </div>
        </div>

        {/* Live Footprint Metric Badges */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-outline-variant/30 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Supported TLDs</p>
              <p className="font-mono text-xl font-bold text-on-surface mt-0.5">{SUPPORTED_TLDS.length} Extensions</p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-primary">public</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Active Default Probes</p>
              <p className="font-mono text-xl font-bold text-on-surface mt-0.5">{checked.size} Selected</p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-indigo-600">checklist</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Probe Mode</p>
              <p className="font-mono text-sm font-bold text-on-surface mt-1 truncate">
                {settings.availabilityCheckMode === 'all' ? 'All 11 Extensions' : 'Selected Only'}
              </p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-emerald-600">
              {settings.availabilityCheckMode === 'all' ? 'hub' : 'filter_list'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Search History</p>
              <p className="font-mono text-xl font-bold text-on-surface mt-0.5">
                {settings.savedSearchHistory ? `${historyCount} Queries` : 'Disabled'}
              </p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-amber-600">history</span>
          </div>
        </div>
      </div>

      {/* 2. Architectural Pillars: How Domain Discovery Operates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-unit-md">
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-micro flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-label-md">
              <span className="material-symbols-outlined text-[20px]">bolt</span>
              <span>Concurrent Probing</span>
            </div>
            <p className="font-caption-xs text-caption-xs text-secondary mt-2 leading-relaxed">
              Dispatches parallel RDAP and DNS WHOIS queries to authoritative registries with sub-300ms target response times.
            </p>
          </div>
          <span className="mt-3 inline-block font-mono text-[11px] text-primary/80 font-medium bg-primary/5 px-2 py-0.5 rounded w-fit">
            Parallel Query Pipeline
          </span>
        </div>

        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-micro flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-label-md">
              <span className="material-symbols-outlined text-[20px]">security</span>
              <span>Brand Defense</span>
            </div>
            <p className="font-caption-xs text-caption-xs text-secondary mt-2 leading-relaxed">
              Scans alternative ccTLDs and tech extensions simultaneously to detect typo-squatting and protect brand equity.
            </p>
          </div>
          <span className="mt-3 inline-block font-mono text-[11px] text-indigo-600 font-medium bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded w-fit">
            Trademark Perimeter
          </span>
        </div>

        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-micro flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-label-md">
              <span className="material-symbols-outlined text-[20px]">paid</span>
              <span>Registrar Arbitrage</span>
            </div>
            <p className="font-caption-xs text-caption-xs text-secondary mt-2 leading-relaxed">
              Aggregates live first-year and renewal pricing across GoDaddy, Namecheap, Cloudflare, Dynadot, and Porkbun.
            </p>
          </div>
          <span className="mt-3 inline-block font-mono text-[11px] text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded w-fit">
            Best Cost Benchmark
          </span>
        </div>

        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-micro flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-600 font-semibold text-label-md">
              <span className="material-symbols-outlined text-[20px]">lock</span>
              <span>Zero-Telemetry Privacy</span>
            </div>
            <p className="font-caption-xs text-caption-xs text-secondary mt-2 leading-relaxed">
              Search history is stored exclusively on this local device and is never uploaded, tracked, or monetized.
            </p>
          </div>
          <span className="mt-3 inline-block font-mono text-[11px] text-amber-600 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded w-fit">
            Local Storage Only
          </span>
        </div>
      </div>

      {/* 3. Default Extensions Management with Smart Presets */}
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30 flex flex-col gap-unit-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-unit-sm border-b border-surface-container-low gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Default Extensions Scoping
              </h4>
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary">
                {checked.size} of {SUPPORTED_TLDS.length} Active
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mt-1">
              Select which extensions are checked by default on the Find Domain page. At least one extension must remain selected.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider mr-1">Presets:</span>
            {PRESET_GROUPS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.tlds)}
                className="px-2.5 py-1 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container hover:text-on-surface text-secondary text-caption-xs font-medium transition flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Extension Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-unit-sm">
          {SUPPORTED_TLDS.map((tld) => {
            const meta = TLD_METADATA[tld] ?? {
              tld,
              category: 'Commercial',
              badge: 'Top-Level Domain',
              description: 'Standard registry namespace',
            };
            const active = checked.has(tld);
            const isLast = active && checked.size === 1;

            return (
              <button
                key={tld}
                type="button"
                aria-pressed={active}
                disabled={isLast}
                onClick={() => toggleTld(tld)}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2.5 ${
                  active
                    ? 'bg-primary/5 border-primary/40 shadow-sm'
                    : 'bg-surface-container-low/50 border-outline-variant/30 hover:border-outline-variant/60 opacity-75 hover:opacity-100'
                } ${isLast ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-on-surface">{tld}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                        active
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-surface-container-high text-secondary border border-outline-variant/30'
                      }`}
                    >
                      {meta.category}
                    </span>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                      active ? 'bg-primary text-on-primary' : 'border border-outline-variant/60 bg-surface-container-lowest'
                    }`}
                  >
                    {active && <span className="material-symbols-outlined text-[14px]">check</span>}
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-on-surface truncate">{meta.badge}</span>
                  <span className="text-[11px] text-secondary line-clamp-1 mt-0.5">{meta.description}</span>
                </div>
              </button>
            );
          })}
        </div>

        {checked.size === 1 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-caption-xs text-amber-700 dark:text-amber-300">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span>You have selected the minimum of 1 extension. DomainPulse requires at least one default extension to execute search queries.</span>
          </div>
        )}
      </div>

      {/* 4. Availability Check Mode Engine */}
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30 flex flex-col gap-unit-md">
        <div className="flex flex-col pb-unit-sm border-b border-surface-container-low">
          <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Availability Probe Policy
          </h4>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Choose whether the discovery engine restricts queries to your selected extensions or probes all 11 supported extensions for complete coverage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
          {/* Option A: Selected only */}
          <button
            type="button"
            onClick={() => onChange({ availabilityCheckMode: 'selected' })}
            className={`p-4 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
              settings.availabilityCheckMode === 'selected'
                ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20'
                : 'bg-surface-container-low border-outline-variant/30 hover:border-outline-variant/60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[20px]">filter_list</span>
                  </div>
                  <span className="font-label-lg text-label-lg font-semibold text-on-surface">
                    Selected Extensions Only
                  </span>
                </div>
                {settings.availabilityCheckMode === 'selected' && (
                  <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-secondary mt-3 leading-relaxed">
                Only queries the {checked.size} active extensions checked above. Fastest search speed, lower quota consumption, and ideal for targeted acquisition research.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center gap-1.5 font-mono text-[11px] text-primary font-medium">
              <span className="material-symbols-outlined text-[14px]">speed</span>
              <span>Optimal response speed (sub-250ms)</span>
            </div>
          </button>

          {/* Option B: All supported */}
          <button
            type="button"
            onClick={() => onChange({ availabilityCheckMode: 'all' })}
            className={`p-4 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
              settings.availabilityCheckMode === 'all'
                ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20'
                : 'bg-surface-container-low border-outline-variant/30 hover:border-outline-variant/60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <span className="material-symbols-outlined text-[20px]">hub</span>
                  </div>
                  <span className="font-label-lg text-label-lg font-semibold text-on-surface">
                    All 11 Supported Extensions
                  </span>
                </div>
                {settings.availabilityCheckMode === 'all' && (
                  <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-secondary mt-3 leading-relaxed">
                Probes every single supported extension (.com, .in, .ai, .io, .tech, .dev, etc.) on every search, regardless of individual page selections. Recommended for thorough trademark defense.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center gap-1.5 font-mono text-[11px] text-indigo-600 font-medium">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              <span>Comprehensive brand defense</span>
            </div>
          </button>
        </div>
      </div>

      {/* 5. Default Result Sorting Heuristics */}
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30 flex flex-col gap-unit-md">
        <div className="flex flex-col pb-unit-sm border-b border-surface-container-low">
          <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Default Result Ranking &amp; Sorting
          </h4>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Specify how candidate domain rows are ordered when search results populate on the Find Domain page.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-sm">
          {SORT_OPTIONS.map((option) => {
            const active = settings.defaultSearchSort === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ defaultSearchSort: option.value })}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                  active
                    ? 'bg-primary/5 border-primary/50 shadow-sm ring-1 ring-primary/20'
                    : 'bg-surface-container-low border-outline-variant/30 hover:border-outline-variant/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[20px] ${active ? 'text-primary' : 'text-secondary'}`}>
                        {option.icon}
                      </span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        {option.label}
                      </span>
                    </div>
                    {active && <span className="material-symbols-outlined text-primary text-[18px]">check</span>}
                  </div>
                  <p className="text-[12px] font-medium text-secondary mt-2">{option.hint}</p>
                </div>
                <p className="font-caption-xs text-caption-xs text-secondary/80 mt-3 pt-2 border-t border-outline-variant/20 line-clamp-2">
                  {option.detail}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Search History & Privacy Controls */}
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30 flex flex-col gap-unit-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-md p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/30">
          <label className="flex items-start gap-unit-md cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.savedSearchHistory}
              onChange={(e) => onChange({ savedSearchHistory: e.target.checked })}
              className="w-5 h-5 accent-primary shrink-0 mt-0.5 rounded cursor-pointer"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Remember Recent Searches on this Device
                </span>
                <span className="font-mono text-[10px] font-semibold px-2 py-0.2 rounded bg-surface-container-high text-secondary border border-outline-variant/30">
                  {historyCount} STORED
                </span>
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary mt-1 max-w-2xl leading-relaxed">
                Stores your most recent search queries locally in your browser&apos;s localStorage for fast autocomplete. Queries are never synchronized to external servers or used for marketing telemetry. Disabling this option and saving immediately clears existing history.
              </span>
            </div>
          </label>

          <div className="flex items-center gap-2 shrink-0">
            {historyClearedMessage && (
              <span className="text-caption-xs text-emerald-600 font-medium animate-pulse">
                History cleared!
              </span>
            )}
            <button
              type="button"
              disabled={historyCount === 0}
              onClick={handleClearHistory}
              className="h-9 px-3 rounded-lg border border-outline-variant/50 text-label-md text-secondary hover:text-on-surface hover:bg-surface-container-lowest transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span>Clear history{historyCount > 0 ? ` (${historyCount})` : ''}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7. Interactive Test Search Sandbox & Preview */}
      <div className="rounded-xl bg-gradient-to-r from-primary/5 via-surface-container-lowest to-surface-container-low p-unit-lg shadow-micro border border-primary/20 flex flex-col gap-unit-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-unit-sm border-b border-surface-container-low gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">preview</span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Live Configuration Sandbox
              </h4>
              <p className="font-caption-xs text-caption-xs text-secondary">
                Simulate how queries will resolve with your current discovery settings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-secondary">Test Keyword:</span>
            <input
              type="text"
              value={previewKeyword}
              onChange={(e) => setPreviewKeyword(e.target.value)}
              placeholder="e.g. brandpulse"
              className="h-8 px-2.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-mono text-label-md focus:outline-none focus:ring-1 focus:ring-primary w-40"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-caption-xs text-secondary">
            <span>
              Generated Search Targets ({previewDomains.length} domains to probe):
            </span>
            <span className="font-mono text-[11px] text-primary">
              Policy: {settings.availabilityCheckMode === 'all' ? 'All 11 Extensions' : 'Selected Extensions Only'} · Sort: {SORT_OPTIONS.find((s) => s.value === settings.defaultSearchSort)?.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
            {previewDomains.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary/80"></span>
                <span>{domain}</span>
              </span>
            ))}
          </div>

          <div className="flex justify-end mt-1">
            <Link
              to={`/find-domain?q=${encodeURIComponent(previewKeyword.trim() || 'brandpulse')}`}
              className="inline-flex items-center gap-1.5 text-label-md font-semibold text-primary hover:underline text-xs"
            >
              <span>Test Live in Find Domain</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 8. Save & Action Bar */}
      <div className="rounded-xl bg-surface-container-lowest p-unit-md shadow-micro border border-outline-variant/30 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-caption-xs text-secondary">
          <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
          <span>Changes will apply immediately across your active session and persist across visits.</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onChange({
                availabilityCheckMode: 'selected',
                defaultCheckedTlds: ['.com', '.in', '.co.in', '.ai', '.io', '.dev', '.app', '.tech'],
                defaultSearchSort: 'availability',
                savedSearchHistory: true,
              });
            }}
            className="h-9 px-4 rounded-lg border border-outline-variant/50 text-secondary hover:text-on-surface hover:bg-surface-container-low font-label-md text-label-md transition cursor-pointer"
          >
            Reset Defaults
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 px-5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary/90 transition shadow-micro cursor-pointer font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>Save Discovery Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
};
