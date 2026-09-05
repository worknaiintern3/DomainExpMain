import React from 'react';
import { WebsiteFilterState, WebsiteFilterOptions } from '../websites.types';

interface WebsiteFilterToolbarProps {
  filterState: WebsiteFilterState;
  onFilterChange: (key: keyof WebsiteFilterState, value: string) => void;
  onSelectChipPreset: (chip: 'prod' | 'attention' | 'nextjs') => void;
  onResetFilters: () => void;
  filterOptions: WebsiteFilterOptions;
}

export const WebsiteFilterToolbar: React.FC<WebsiteFilterToolbarProps> = ({
  filterState,
  onFilterChange,
  onSelectChipPreset,
  onResetFilters,
  filterOptions,
}) => {
  return (
    <div className="p-unit-md bg-surface-container-lowest flex flex-col gap-unit-sm border-b border-outline-variant/30">
      {/* Top Search & Dropdown Filter Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-unit-sm">
        {/* Search input */}
        <div className="relative flex-1 min-w-[280px]">
          <span className="material-symbols-outlined absolute left-unit-sm top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={filterState.searchQuery}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            placeholder="Search websites, domains, servers, tech stack or project..."
            className="h-9 w-full pl-9 pr-14 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30 shadow-sm transition-all"
          />
          <span className="absolute right-unit-xs top-1/2 -translate-y-1/2 font-caption-xs text-caption-xs text-outline px-unit-xs py-unit-2xs rounded bg-surface-container font-label-mono text-label-mono pointer-events-none">
            ⌘F
          </span>
        </div>

        {/* Dropdown Filters Strip */}
        <div className="flex flex-wrap items-center gap-unit-xs">
          {/* Environment */}
          <div className="relative">
            <select
              value={filterState.environment}
              onChange={(e) => onFilterChange('environment', e.target.value)}
              className="h-9 pl-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md appearance-none hover:bg-surface-container cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            >
              {filterOptions.environments.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-secondary text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Server */}
          <div className="relative">
            <select
              value={filterState.server}
              onChange={(e) => onFilterChange('server', e.target.value)}
              className="h-9 pl-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md appearance-none hover:bg-surface-container cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            >
              {filterOptions.servers.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-secondary text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Tech Stack */}
          <div className="relative">
            <select
              value={filterState.techStack}
              onChange={(e) => onFilterChange('techStack', e.target.value)}
              className="h-9 pl-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md appearance-none hover:bg-surface-container cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            >
              {filterOptions.techStacks.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-secondary text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>

          {/* SSL Status */}
          <div className="relative">
            <select
              value={filterState.sslStatus}
              onChange={(e) => onFilterChange('sslStatus', e.target.value)}
              className="h-9 pl-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md appearance-none hover:bg-surface-container cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            >
              {filterOptions.sslStatuses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-secondary text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Project */}
          <div className="relative">
            <select
              value={filterState.project}
              onChange={(e) => onFilterChange('project', e.target.value)}
              className="h-9 pl-unit-sm pr-7 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md appearance-none hover:bg-surface-container cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            >
              {filterOptions.projects.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-secondary text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* Quick Filter Chips Strip */}
      <div className="flex items-center gap-unit-xs pt-unit-xs overflow-x-auto">
        <span className="font-caption-xs text-caption-xs text-secondary uppercase font-mono tracking-wider shrink-0">
          Presets:
        </span>

        <button
          onClick={() => onSelectChipPreset('prod')}
          className={`px-unit-sm py-unit-2xs rounded-full font-caption-xs text-caption-xs font-medium transition-colors flex items-center gap-unit-2xs border border-outline-variant/30 ${
            filterState.activeChip === 'prod' || filterState.environment === 'production'
              ? 'bg-primary text-on-primary font-semibold'
              : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
          }`}
          type="button"
        >
          <span>Production Only</span>
          <span className={filterState.activeChip === 'prod' ? 'text-primary-fixed-dim font-mono' : 'text-secondary font-mono'}>
            (12)
          </span>
        </button>

        <button
          onClick={() => onSelectChipPreset('attention')}
          className={`px-unit-sm py-unit-2xs rounded-full font-caption-xs text-caption-xs font-medium transition-colors flex items-center gap-unit-2xs border border-outline-variant/30 ${
            filterState.activeChip === 'attention' || filterState.sslStatus === 'warning'
              ? 'bg-error text-on-error font-semibold'
              : 'bg-error-container text-on-error-container hover:bg-error-container/80'
          }`}
          type="button"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-error" />
          <span>Needs Attention</span>
          <span className="font-mono font-bold">(2)</span>
        </button>

        <button
          onClick={() => onSelectChipPreset('nextjs')}
          className={`px-unit-sm py-unit-2xs rounded-full font-caption-xs text-caption-xs font-medium transition-colors flex items-center gap-unit-2xs border border-outline-variant/30 ${
            filterState.activeChip === 'nextjs' || filterState.techStack === 'next'
              ? 'bg-primary text-on-primary font-semibold'
              : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
          }`}
          type="button"
        >
          <span>Next.js Stack</span>
          <span className={filterState.activeChip === 'nextjs' ? 'text-primary-fixed-dim font-mono' : 'text-secondary font-mono'}>
            (4)
          </span>
        </button>

        <button
          onClick={onResetFilters}
          className="ml-auto text-secondary hover:text-primary font-caption-xs text-caption-xs font-mono transition-colors cursor-pointer"
          type="button"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
};
