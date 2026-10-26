import React from 'react';
import { PRICING_TLD_SHORTCUTS } from '../pricing.calc';
import { PricingSortOption } from '../pricing.types';

interface PricingSearchBarProps {
  domainInput: string;
  onDomainInputChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  activeTld: string | null;
  onSelectTld: (tld: string) => void;
  sortOption: PricingSortOption;
  onSortChange: (sort: PricingSortOption) => void;
  currencies: string[];
  validationMessage: string | null;
}

export const PricingSearchBar: React.FC<PricingSearchBarProps> = ({
  domainInput,
  onDomainInputChange,
  onSubmit,
  isLoading,
  activeTld,
  onSelectTld,
  sortOption,
  onSortChange,
  currencies,
  validationMessage,
}) => {
  return (
    <div className="flex flex-col gap-unit-sm p-unit-base rounded-lg bg-surface-container-lowest shadow-micro border border-outline-variant/30">
      {/* Domain entry */}
      <form
        className="flex flex-wrap items-center gap-unit-sm"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="relative flex items-center flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-2 text-outline text-[18px] pointer-events-none">
            travel_explore
          </span>
          <input
            type="text"
            value={domainInput}
            onChange={(event) => onDomainInputChange(event.target.value)}
            placeholder="Enter a domain, e.g. example.com"
            aria-label="Domain to compare"
            aria-invalid={validationMessage !== null}
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full pl-8 pr-3 rounded bg-surface-container-low text-on-surface font-label-mono text-body-sm placeholder:text-outline placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="h-10 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-tertiary transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">price_check</span>
          <span>{isLoading ? 'Comparing…' : 'Compare prices'}</span>
        </button>
      </form>
      {validationMessage && (
        <p role="alert" className="font-caption-xs text-caption-xs text-rose-700">
          {validationMessage}
        </p>
      )}

      {/* Extension shortcuts (they only complete the domain name) */}
      <div className="flex items-center justify-between gap-unit-base overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 shrink-0">
          {PRICING_TLD_SHORTCUTS.map((tld) => {
            const isSelected = activeTld === tld;
            return (
              <button
                key={tld}
                type="button"
                onClick={() => onSelectTld(tld)}
                aria-pressed={isSelected}
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
          <span className="material-symbols-outlined text-[16px] text-tertiary">bolt</span>
          <span>Queried live per search</span>
        </div>
      </div>

      {/* Secondary strip */}
      <div className="flex flex-wrap items-center justify-between gap-unit-sm pt-unit-xs border-t border-surface-container/50">
        <div className="flex flex-wrap items-center gap-unit-md">
          {/* Currency badge: purely informational, never a conversion */}
          <div className="h-8 px-unit-sm rounded bg-surface-container text-on-surface font-label-mono text-label-mono flex items-center gap-1">
            <span className="text-secondary font-sans text-caption-xs">Currency:</span>
            <span className="font-semibold text-primary">
              {currencies.length === 0
                ? 'As returned'
                : currencies.length === 1
                  ? (currencies[0] ?? '')
                  : `Mixed (${currencies.join(', ')})`}
            </span>
            <span className="text-secondary font-sans text-caption-xs">· not converted</span>
          </div>

          {/* Sort Select */}
          <div className="relative flex items-center">
            <select
              value={sortOption}
              onChange={(event) => onSortChange(event.target.value as PricingSortOption)}
              aria-label="Sort registrars"
              className="h-8 pl-unit-sm pr-7 rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
            >
              <option value="lowest-first-year">Sort: Lowest First Year</option>
              <option value="lowest-renewal">Lowest Renewal</option>
              <option value="lowest-transfer">Lowest Transfer</option>
              <option value="lowest-5yr">Lowest 5-Year Ownership</option>
            </select>
            <span className="material-symbols-outlined absolute right-1.5 text-on-surface-variant text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
