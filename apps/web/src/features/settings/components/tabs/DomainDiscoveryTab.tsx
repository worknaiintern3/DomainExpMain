import React, { useEffect, useState } from 'react';

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

const SORT_OPTIONS: Array<{ value: DomainDiscoverySettings['defaultSearchSort']; label: string; hint: string }> = [
  { value: 'availability', label: 'Availability', hint: 'Available domains first' },
  { value: 'price', label: 'Lowest price', hint: 'Cheapest first year first (same currency only)' },
  { value: 'tld', label: 'TLD (A–Z)', hint: 'Alphabetical by extension' },
  { value: 'match', label: 'As listed', hint: 'Order of the TLD list' },
];

const segmentClass = (active: boolean) =>
  `p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
    active
      ? 'bg-primary/5 border-primary/40 text-primary font-semibold'
      : 'bg-surface-container-low border-outline-variant/30 text-secondary hover:text-on-surface'
  }`;

export const DomainDiscoveryTab: React.FC<DomainDiscoveryTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  const [historyCount, setHistoryCount] = useState(() => readRecentSearches().length);
  const checked = new Set(settings.defaultCheckedTlds);

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
    // Keep the saved order identical to the supported list so it stays predictable.
    onChange({ defaultCheckedTlds: SUPPORTED_TLDS.filter((entry) => next.includes(entry)) });
  };

  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Domain Discovery Defaults
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            How the Find Domain page starts: which extensions are checked, how results are ordered, and whether recent searches are remembered.
          </p>
        </div>

        <div className="flex flex-col gap-unit-md mt-unit-md">
          {/* Default TLDs */}
          <div className="flex flex-col gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Default Extensions
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Pre-selected on the Find Domain page. At least one must stay selected.
              </span>
            </div>
            <div className="flex flex-wrap gap-unit-xs">
              {SUPPORTED_TLDS.map((tld) => {
                const active = checked.has(tld);
                const isLast = active && checked.size === 1;
                return (
                  <button
                    key={tld}
                    type="button"
                    aria-pressed={active}
                    disabled={isLast}
                    onClick={() => toggleTld(tld)}
                    className={`px-3 py-1.5 rounded-full border font-label-mono text-label-mono transition-colors ${
                      active
                        ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                        : 'bg-surface-container-lowest border-outline-variant/40 text-secondary hover:text-on-surface'
                    } ${isLast ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                  >
                    {tld}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Check mode */}
          <div className="flex flex-col gap-unit-xs">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Availability Check
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-unit-sm">
              <button
                type="button"
                onClick={() => onChange({ availabilityCheckMode: 'selected' })}
                className={segmentClass(settings.availabilityCheckMode === 'selected')}
              >
                <span>Selected extensions only</span>
                {settings.availabilityCheckMode === 'selected' && (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onChange({ availabilityCheckMode: 'all' })}
                className={segmentClass(settings.availabilityCheckMode === 'all')}
              >
                <span>All supported extensions</span>
                {settings.availabilityCheckMode === 'all' && (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                )}
              </button>
            </div>
            <span className="font-caption-xs text-caption-xs text-secondary">
              &quot;All&quot; checks every supported extension on each search, regardless of the selection on the page.
            </span>
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-unit-xs">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Default Result Order
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-unit-sm">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ defaultSearchSort: option.value })}
                  className={segmentClass(settings.defaultSearchSort === option.value)}
                  title={option.hint}
                >
                  <span>{option.label}</span>
                  {settings.defaultSearchSort === option.value && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
              ))}
            </div>
            <span className="font-caption-xs text-caption-xs text-secondary">
              {SORT_OPTIONS.find((option) => option.value === settings.defaultSearchSort)?.hint}.
            </span>
          </div>

          {/* History */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <label className="flex items-center gap-unit-sm cursor-pointer">
              <input
                type="checkbox"
                checked={settings.savedSearchHistory}
                onChange={(event) => onChange({ savedSearchHistory: event.target.checked })}
                className="w-5 h-5 accent-primary shrink-0"
              />
              <span className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Remember Recent Searches
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Shows your last searches on the Find Domain page. Stored on this device only;
                  turning this off and saving clears the existing history.
                </span>
              </span>
            </label>
            <button
              type="button"
              disabled={historyCount === 0}
              onClick={() => {
                clearRecentSearches();
                setHistoryCount(0);
              }}
              className="h-8 px-3 rounded-lg border border-outline-variant/50 text-label-md text-secondary hover:text-on-surface disabled:opacity-50 shrink-0"
            >
              Clear history{historyCount > 0 ? ` (${historyCount})` : ''}
            </button>
          </div>
        </div>

        <div className="mt-unit-lg pt-unit-md border-t border-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Discovery Settings'}
          </button>
        </div>
      </div>
    </section>
  );
};
