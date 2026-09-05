import React from 'react';
import { GraphFilterType } from '../infrastructureMap.types';
import { FILTER_COUNTS } from '../infrastructureMap.reference';

interface InfrastructureMapHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: GraphFilterType;
  onFilterChange: (f: GraphFilterType) => void;
  onResetLayout: () => void;
  onToggleFocusMode: () => void;
  isFocusMode: boolean;
  onExportDiagram: () => void;
  onAddRelationship: () => void;
  filterCounts?: Record<GraphFilterType, number>;
}

export const InfrastructureMapHeader: React.FC<InfrastructureMapHeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onResetLayout,
  onToggleFocusMode,
  isFocusMode,
  onExportDiagram,
  onAddRelationship,
  filterCounts = FILTER_COUNTS,
}) => {
  return (
    <div className="flex flex-col gap-unit-md mb-unit-xs">
      {/* Top Hero Bar / Operational Header */}
      <div className="flex flex-wrap items-center justify-between gap-unit-md">
        <div className="flex flex-col gap-unit-2xs">
          <div className="flex items-center gap-unit-sm">
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
              Infrastructure Map
            </h1>
            <span className="px-unit-xs py-0.5 rounded-full bg-surface-container-high text-primary font-caption-xs text-caption-xs uppercase tracking-wider font-semibold">
              STORED TOPOLOGY GRAPH
            </span>
          </div>
          <p className="font-body-md text-body-md text-secondary">
            Explore how emails, provider accounts, domains, websites and servers are mapped across stored portfolio records.
          </p>
        </div>

        {/* Action Cluster */}
        <div className="flex items-center gap-unit-sm flex-wrap">
          <button
            type="button"
            onClick={onResetLayout}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-micro font-label-md text-label-md border border-outline-variant/30 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span>Reset Layout</span>
          </button>

          <button
            type="button"
            onClick={onToggleFocusMode}
            className={`h-9 px-unit-md flex items-center gap-unit-xs rounded-lg transition-colors shadow-micro font-label-md text-label-md border cursor-pointer ${
              isFocusMode
                ? 'bg-primary text-on-primary border-primary font-semibold'
                : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container border-outline-variant/30'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">center_focus_strong</span>
            <span>Focus Mode</span>
          </button>

          <button
            type="button"
            onClick={onExportDiagram}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-micro font-label-md text-label-md border border-outline-variant/30 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">file_download</span>
            <span>Export Diagram</span>
          </button>

          <button
            type="button"
            onClick={onAddRelationship}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">add_link</span>
            <span>Add Relationship</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-unit-sm rounded-xl bg-surface-container-lowest shadow-micro border border-outline-variant/30 flex flex-col xl:flex-row xl:items-center justify-between gap-unit-md">
        <div className="flex flex-wrap items-center gap-unit-sm flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative flex items-center w-full max-w-md shrink-0">
            <span className="material-symbols-outlined absolute left-unit-sm text-secondary text-[18px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search any asset, node, email, domain or server..."
              className="h-9 pl-9 pr-unit-md w-full rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30 transition-colors"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap py-unit-2xs">
            <button
              type="button"
              onClick={() => onFilterChange('all')}
              className={`px-unit-sm h-7 rounded-full font-caption-xs text-caption-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-secondary hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              All ({filterCounts.all})
            </button>

            <button
              type="button"
              onClick={() => onFilterChange('email')}
              className={`px-unit-sm h-7 rounded-full font-caption-xs text-caption-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeFilter === 'email'
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container text-secondary hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              Emails ({filterCounts.email})
            </button>

            <button
              type="button"
              onClick={() => onFilterChange('provider')}
              className={`px-unit-sm h-7 rounded-full font-caption-xs text-caption-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeFilter === 'provider'
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container text-secondary hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              Provider Accounts ({filterCounts.provider})
            </button>

            <button
              type="button"
              onClick={() => onFilterChange('domain')}
              className={`px-unit-sm h-7 rounded-full font-caption-xs text-caption-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeFilter === 'domain'
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container text-secondary hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              Domains ({filterCounts.domain})
            </button>

            <button
              type="button"
              onClick={() => onFilterChange('website')}
              className={`px-unit-sm h-7 rounded-full font-caption-xs text-caption-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeFilter === 'website'
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container text-secondary hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              Websites / Apps ({filterCounts.website})
            </button>

            <button
              type="button"
              onClick={() => onFilterChange('server')}
              className={`px-unit-sm h-7 rounded-full font-caption-xs text-caption-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeFilter === 'server'
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container text-secondary hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              VPS / Servers ({filterCounts.server})
            </button>

            <button
              type="button"
              onClick={() => onFilterChange('project')}
              className={`px-unit-sm h-7 rounded-full font-caption-xs text-caption-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeFilter === 'project'
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container text-secondary hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              Projects ({filterCounts.project})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
