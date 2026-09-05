import React from 'react';
import { ServerFilterState, ServerFilterOptions } from '../servers.types';

interface ServerFilterToolbarProps {
  filterState: ServerFilterState;
  onFilterChange: (key: keyof ServerFilterState, value: string) => void;
  onClearFilters: () => void;
  filterOptions: ServerFilterOptions;
  filteredCount: number;
  totalCount: number;
}

export const ServerFilterToolbar: React.FC<ServerFilterToolbarProps> = ({
  filterState,
  onFilterChange,
  onClearFilters,
  filterOptions,
  filteredCount,
  totalCount,
}) => {
  return (
    <div className="bg-surface-container-lowest p-unit-sm rounded-xl shadow-sm flex flex-col gap-unit-sm border border-outline-variant/30">
      {/* Top Search & Sort Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-unit-sm">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-unit-sm top-1/2 -translate-y-1/2 text-secondary text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={filterState.searchQuery}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            placeholder="Search servers, provider, email, IP or website..."
            className="h-9 w-full pl-9 pr-unit-md rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm placeholder:text-secondary focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-sm border border-outline-variant/30 transition-all"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-unit-xs self-end md:self-auto shrink-0">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
            Sort:
          </span>
          <div className="relative">
            <select
              value={filterState.sortBy}
              onChange={(e) => onFilterChange('sortBy', e.target.value)}
              className="h-9 pl-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.sortOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-unit-xs top-1/2 -translate-y-1/2 text-secondary text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* Filter Pill Carousel & Reset */}
      <div className="flex items-center justify-between flex-wrap gap-unit-xs pt-unit-2xs border-t border-surface-container">
        <div className="flex items-center flex-wrap gap-unit-xs min-w-0">
          {/* Status Pill Filter Group */}
          <div className="flex items-center bg-surface-container-low p-unit-2xs rounded-lg border border-outline-variant/30">
            <button
              onClick={() => onFilterChange('status', 'All')}
              className={`px-unit-sm py-unit-2xs rounded font-caption-xs text-caption-xs transition-all ${
                filterState.status === 'All'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                  : 'text-secondary hover:text-on-surface'
              }`}
              type="button"
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => onFilterChange('status', 'Active')}
              className={`px-unit-sm py-unit-2xs rounded font-caption-xs text-caption-xs transition-all ${
                filterState.status === 'Active'
                  ? 'bg-surface-container-lowest text-emerald-800 shadow-sm font-semibold'
                  : 'text-secondary hover:text-on-surface'
              }`}
              type="button"
            >
              Active (5)
            </button>
            <button
              onClick={() => onFilterChange('status', 'Attention')}
              className={`px-unit-sm py-unit-2xs rounded font-caption-xs text-caption-xs transition-all ${
                filterState.status === 'Attention'
                  ? 'bg-surface-container-lowest text-amber-800 shadow-sm font-semibold'
                  : 'text-amber-700 hover:text-amber-900'
              }`}
              type="button"
            >
              Attention (1)
            </button>
          </div>

          {/* Provider Dropdown Pill */}
          <div className="relative">
            <select
              value={filterState.provider}
              onChange={(e) => onFilterChange('provider', e.target.value)}
              className="h-7 pl-unit-sm pr-6 rounded-lg bg-surface-container-low text-on-surface font-caption-xs text-caption-xs font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[14px] text-secondary pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Region Dropdown Pill */}
          <div className="relative">
            <select
              value={filterState.region}
              onChange={(e) => onFilterChange('region', e.target.value)}
              className="h-7 pl-unit-sm pr-6 rounded-lg bg-surface-container-low text-on-surface font-caption-xs text-caption-xs font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[14px] text-secondary pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Account Email Dropdown Pill */}
          <div className="relative">
            <select
              value={filterState.accountEmail}
              onChange={(e) => onFilterChange('accountEmail', e.target.value)}
              className="h-7 pl-unit-sm pr-6 rounded-lg bg-surface-container-low text-on-surface font-caption-xs text-caption-xs font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.accountEmails.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[14px] text-secondary pointer-events-none">
              expand_more
            </span>
          </div>

          {/* OS Dropdown Pill */}
          <div className="relative">
            <select
              value={filterState.os}
              onChange={(e) => onFilterChange('os', e.target.value)}
              className="h-7 pl-unit-sm pr-6 rounded-lg bg-surface-container-low text-on-surface font-caption-xs text-caption-xs font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer border border-outline-variant/30"
            >
              {filterOptions.osList.map((os) => (
                <option key={os} value={os}>
                  {os}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[14px] text-secondary pointer-events-none">
              expand_more
            </span>
          </div>
        </div>

        {/* Count & Reset */}
        <div className="flex items-center gap-unit-sm shrink-0">
          <span className="font-label-mono text-caption-xs text-secondary">
            Showing {filteredCount} of {totalCount} servers
          </span>
          <button
            onClick={onClearFilters}
            className="font-caption-xs text-caption-xs text-primary hover:text-tertiary font-semibold transition-colors"
            type="button"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
};
