import React, { useState } from 'react';
import { FindDomainSummary } from '../findDomain.types';
import { SUPPORTED_TLDS, RECENT_SEARCH_KEYWORDS } from '../findDomain.reference';

interface DomainSearchHeroProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: (q: string) => void;
  selectedTlds: string[];
  onToggleTld: (tld: string) => void;
  onSelectAllTlds: () => void;
  summary: FindDomainSummary;
  showSummary: boolean;
}

export const DomainSearchHero: React.FC<DomainSearchHeroProps> = ({
  query,
  onQueryChange,
  onSearch,
  selectedTlds,
  onToggleTld,
  onSelectAllTlds,
  summary,
  showSummary,
}) => {
  const [inputValue, setInputValue] = useState(query);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSearch(inputValue);
  };

  const handleClear = () => {
    setInputValue('');
    onQueryChange('');
  };

  const handleRecentClick = (keyword: string) => {
    setInputValue(keyword);
    onSearch(keyword);
  };

  return (
    <div className="flex flex-col gap-unit-base">
      {/* Primary Search Input Card */}
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm p-unit-md border border-outline-variant/30">
        <form onSubmit={handleSubmit} className="flex flex-col gap-unit-md">
          {/* Search Input Container */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                onQueryChange(e.target.value);
              }}
              placeholder="Search domains or enter project name (e.g. cloudscale, getflow, worknai)..."
              className="w-full h-11 pl-11 pr-48 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-headline-sm placeholder:text-outline placeholder:font-body-md placeholder:text-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner border border-outline-variant/30"
            />
            <div className="absolute right-2 flex items-center gap-unit-xs">
              {inputValue && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded text-secondary hover:text-on-surface transition-colors cursor-pointer"
                  title="Clear query"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
              <button
                type="submit"
                className="h-8 px-unit-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md flex items-center gap-unit-xs hover:bg-primary transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                <span>Preview Availability</span>
                <span className="ml-1 text-[10px] font-label-mono bg-on-primary/20 px-1 py-0.5 rounded text-on-primary leading-none">
                  ↵
                </span>
              </button>
            </div>
          </div>

          {/* Quick Extension Filters & TLD Pills */}
          <div className="flex flex-wrap items-center justify-between gap-unit-sm pt-unit-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-caption-xs font-caption-xs">
              <span className="text-secondary font-medium mr-1 select-none">Checked TLDs:</span>
              {SUPPORTED_TLDS.map((tld) => {
                const isChecked = selectedTlds.includes(tld);
                return (
                  <button
                    key={tld}
                    type="button"
                    onClick={() => onToggleTld(tld)}
                    className={`px-2 py-1 rounded-md font-label-mono text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-secondary-container text-on-secondary-fixed font-semibold hover:brightness-95'
                        : 'bg-surface-container text-secondary hover:bg-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span>{tld}</span>
                    {isChecked && (
                      <span className="material-symbols-outlined text-[12px] font-bold text-primary">
                        check
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="h-3 w-px bg-outline-variant mx-1"></div>
              <button
                type="button"
                onClick={onSelectAllTlds}
                className="text-primary hover:underline font-caption-xs text-caption-xs font-semibold cursor-pointer"
              >
                {selectedTlds.length === SUPPORTED_TLDS.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Recent Search Chips */}
            <div className="flex items-center gap-unit-xs text-caption-xs font-caption-xs text-secondary flex-wrap">
              <span className="uppercase tracking-wider text-[10px] text-outline font-semibold">
                DOMAIN DISCOVERY
              </span>
              {RECENT_SEARCH_KEYWORDS.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => handleRecentClick(kw)}
                  className="px-2 py-0.5 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-mono text-[11px] transition-colors border border-outline-variant/20 cursor-pointer"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>

      {/* Search Summary Metric Strip */}
      {showSummary && (
        <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm px-unit-md py-2.5 flex flex-wrap items-center justify-between gap-unit-sm border border-outline-variant/30">
          <div className="flex items-center flex-wrap gap-unit-md text-caption-xs font-caption-xs">
            <div className="flex items-center gap-unit-xs">
              <span className="text-secondary">Active Query:</span>
              <span className="font-label-mono font-semibold text-body-sm text-primary">
                {summary.activeQuery}
              </span>
            </div>
            <div className="h-3 w-px bg-outline-variant hidden sm:block"></div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-on-surface font-medium">
                {summary.extensionsCheckedCount} extensions checked
              </span>
            </div>
            <div className="h-3 w-px bg-outline-variant hidden sm:block"></div>
            <div className="flex items-center gap-unit-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption-xs font-semibold bg-emerald-50 text-emerald-800 shadow-sm border border-emerald-200/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                {summary.availableCount} Available • Reference
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption-xs font-semibold bg-surface-container text-secondary shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-1.5"></span>
                {summary.registeredCount} Registered • Reference
              </span>
            </div>
            <div className="h-3 w-px bg-outline-variant hidden md:block"></div>
            <div className="hidden md:flex items-center gap-1 text-secondary">
              <span>Lowest Reference Reg:</span>
              <span className="font-label-mono text-on-surface font-semibold text-emerald-700">
                {summary.lowestRegPriceFormatted}
              </span>
              <span className="text-outline">{summary.lowestRegDetails}</span>
            </div>
          </div>
          <span className="text-[11px] font-mono text-secondary bg-surface-container-low px-2 py-0.5 rounded">
            Search Preview
          </span>
        </div>
      )}
    </div>
  );
};
