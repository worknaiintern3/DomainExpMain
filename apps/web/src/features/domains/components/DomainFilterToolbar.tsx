import React from 'react';
import { DomainFilterState, DomainsReferenceDataset } from '../domains.types';

interface DomainFilterToolbarProps {
  filterState: DomainFilterState;
  onFilterChange: (key: keyof DomainFilterState, value: string) => void;
  onClearFilters: () => void;
  filterOptions: DomainsReferenceDataset['filterOptions'];
  filteredCount: number;
  totalCount: number;
}

export const DomainFilterToolbar: React.FC<DomainFilterToolbarProps> = ({
  filterState,
  onFilterChange,
  onClearFilters,
  filterOptions,
  filteredCount,
  totalCount,
}) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-md flex flex-col gap-unit-md border border-outline-variant/40">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-unit-md">
        {/* Search bar with keyboard shortcut */}
        <div className="relative w-full lg:max-w-md flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-secondary text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={filterState.searchQuery}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            placeholder="Search domains, registrar, tag or client..."
            className="w-full h-10 pl-9 pr-14 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all border border-outline-variant/30"
          />
          <span className="absolute right-2 font-caption-xs text-caption-xs text-secondary px-1.5 py-0.5 rounded bg-surface-container-high font-label-mono border border-outline-variant/30">
            ⌘K
          </span>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="flex flex-wrap items-center gap-unit-xs w-full lg:w-auto">
          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={filterState.status}
              onChange={(e) => onFilterChange('status', e.target.value)}
              className="h-9 px-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.statuses.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-2 text-secondary pointer-events-none text-[18px]">
              expand_more
            </span>
          </div>

          {/* Registrar Dropdown */}
          <div className="relative">
            <select
              value={filterState.registrar}
              onChange={(e) => onFilterChange('registrar', e.target.value)}
              className="h-9 px-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.registrars.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-2 text-secondary pointer-events-none text-[18px]">
              expand_more
            </span>
          </div>

          {/* TLD Dropdown */}
          <div className="relative">
            <select
              value={filterState.tld}
              onChange={(e) => onFilterChange('tld', e.target.value)}
              className="h-9 px-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.tlds.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-2 text-secondary pointer-events-none text-[18px]">
              expand_more
            </span>
          </div>

          {/* Auto-Renew Dropdown */}
          <div className="relative">
            <select
              value={filterState.autoRenew}
              onChange={(e) => onFilterChange('autoRenew', e.target.value)}
              className="h-9 px-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.autoRenewOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-2 text-secondary pointer-events-none text-[18px]">
              expand_more
            </span>
          </div>

          {/* Tags Dropdown */}
          <div className="relative">
            <select
              value={filterState.tag}
              onChange={(e) => onFilterChange('tag', e.target.value)}
              className="h-9 px-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.tags.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-2 text-secondary pointer-events-none text-[18px]">
              expand_more
            </span>
          </div>

          <button
            onClick={onClearFilters}
            className="h-9 px-unit-sm text-secondary hover:text-on-surface font-label-md text-caption-xs transition-colors"
            type="button"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Sub-filter bar: Sort and Count */}
      <div className="flex items-center justify-between pt-unit-xs text-caption-xs text-secondary font-label-md border-t border-surface-container">
        <span className="font-label-mono">
          Showing {filteredCount} domains (Filtered from {totalCount} total)
        </span>
        <div className="flex items-center gap-unit-xs">
          <span className="text-secondary">Sort by:</span>
          <div className="relative">
            <select
              value={filterState.sortBy}
              onChange={(e) => onFilterChange('sortBy', e.target.value)}
              className="h-8 pl-2 pr-6 rounded bg-surface-container-low text-on-surface font-label-md text-caption-xs focus:outline-none appearance-none cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.sortOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1 top-1.5 text-secondary pointer-events-none text-[16px]">
              unfold_more
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
