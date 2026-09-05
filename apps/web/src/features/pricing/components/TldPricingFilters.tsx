import React from 'react';
import { SUPPORTED_PRICING_TLDS } from '../pricing.reference';
import { PricingSortOption } from '../pricing.types';

interface TldPricingFiltersProps {
  selectedTld: string;
  onSelectTld: (tld: string) => void;
  sortOption: PricingSortOption;
  onSortChange: (sort: PricingSortOption) => void;
  filterText: string;
  onFilterTextChange: (text: string) => void;
  requirePrivacy: boolean;
  onTogglePrivacy: () => void;
  requireDnssec: boolean;
  onToggleDnssec: () => void;
}

export const TldPricingFilters: React.FC<TldPricingFiltersProps> = ({
  selectedTld,
  onSelectTld,
  sortOption,
  onSortChange,
  filterText,
  onFilterTextChange,
  requirePrivacy,
  onTogglePrivacy,
  requireDnssec,
  onToggleDnssec,
}) => {
  return (
    <div className="flex flex-col gap-unit-sm p-unit-base rounded-lg bg-surface-container-lowest shadow-micro border border-outline-variant/30">
      {/* TLD Row */}
      <div className="flex items-center justify-between gap-unit-base overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 shrink-0">
          {SUPPORTED_PRICING_TLDS.map((tld) => {
            const isSelected = selectedTld === tld;
            return (
              <button
                key={tld}
                type="button"
                onClick={() => onSelectTld(tld)}
                className={`px-unit-md py-1 rounded-full font-label-mono text-[12px] font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-on-primary shadow-sm font-semibold'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                }`}
              >
                {tld}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-unit-xs text-secondary font-caption-xs text-caption-xs shrink-0">
          <span className="material-symbols-outlined text-[16px] text-tertiary">analytics</span>
          <span>Illustrative Benchmark Dataset</span>
        </div>
      </div>

      {/* Secondary Filters Strip */}
      <div className="flex flex-wrap items-center justify-between gap-unit-sm pt-unit-xs border-t border-surface-container/50">
        <div className="flex flex-wrap items-center gap-unit-md">
          {/* Currency badge */}
          <div className="h-8 px-unit-sm rounded bg-surface-container text-on-surface font-label-mono text-label-mono flex items-center gap-1">
            <span className="text-secondary font-sans text-caption-xs">Currency:</span>
            <span className="font-semibold text-primary">INR (₹)</span>
          </div>

          {/* Sort Select */}
          <div className="relative flex items-center">
            <select
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as PricingSortOption)}
              className="h-8 pl-unit-sm pr-7 rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
            >
              <option value="best-value">Sort: Best Long-Term Value</option>
              <option value="lowest-first-year">Lowest First Year</option>
              <option value="lowest-renewal">Lowest Renewal</option>
              <option value="lowest-transfer">Lowest Transfer</option>
              <option value="lowest-5yr">Lowest 5-Year Ownership</option>
            </select>
            <span className="material-symbols-outlined absolute right-1.5 text-on-surface-variant text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Checkbox Filters */}
          <label className="flex items-center gap-unit-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requirePrivacy}
              onChange={onTogglePrivacy}
              className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
            />
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Include WHOIS Privacy
            </span>
          </label>
          <label className="flex items-center gap-unit-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requireDnssec}
              onChange={onToggleDnssec}
              className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
            />
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Free DNSSEC
            </span>
          </label>
        </div>

        {/* Quick Filter Input */}
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-2 text-outline text-[16px] pointer-events-none">
            filter_list
          </span>
          <input
            type="text"
            value={filterText}
            onChange={(e) => onFilterTextChange(e.target.value)}
            placeholder="Filter providers..."
            className="h-8 pl-7 pr-3 rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary w-48 border border-outline-variant/30"
          />
        </div>
      </div>
    </div>
  );
};
