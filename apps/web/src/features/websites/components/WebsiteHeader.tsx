import React from 'react';
import { Link } from 'react-router-dom';

interface WebsiteHeaderProps {
  totalCount: number;
  viewMode: 'inventory' | 'empty';
  onToggleViewMode: (mode: 'inventory' | 'empty') => void;
  onOpenAddModal: () => void;
  onExportCsv: () => void;
}

export const WebsiteHeader: React.FC<WebsiteHeaderProps> = ({
  totalCount,
  viewMode,
  onToggleViewMode,
  onOpenAddModal,
  onExportCsv,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-unit-md pt-unit-md mb-unit-lg">
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-unit-xs">
          <span className="font-caption-xs text-caption-xs text-secondary font-mono tracking-wider uppercase">
            Website &amp; Application Inventory
          </span>
        </div>
        <div className="flex items-center gap-unit-sm mt-0.5">
          <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
            Websites &amp; Apps
          </h1>
          <span className="px-unit-xs py-unit-2xs rounded bg-surface-container-high text-primary font-label-mono text-caption-xs font-semibold border border-outline-variant/30">
            {totalCount} ASSETS
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
          Track websites, applications, domains, hosting servers and runtime environments.
        </p>
      </div>

      <div className="flex items-center gap-unit-xs self-start md:self-auto shrink-0 flex-wrap">
        {/* Toggle for Inventory vs Empty State Preview */}
        <div className="flex items-center bg-surface-container-high p-unit-2xs rounded-lg text-caption-xs font-label-md mr-unit-xs border border-outline-variant/30">
          <button
            onClick={() => onToggleViewMode('inventory')}
            className={`px-unit-sm py-1 rounded transition-all ${
              viewMode === 'inventory'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
            type="button"
          >
            Inventory ({totalCount})
          </button>
          <button
            onClick={() => onToggleViewMode('empty')}
            className={`px-unit-sm py-1 rounded transition-all ${
              viewMode === 'empty'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
            type="button"
          >
            Empty State Preview
          </button>
        </div>

        <button
          onClick={onExportCsv}
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container shadow-sm transition-colors border border-outline-variant/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">file_download</span>
          <span>Export CSV</span>
        </button>

        <Link
          to="/servers"
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container shadow-sm transition-colors border border-outline-variant/30"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">alt_route</span>
          <span>Manage Mappings</span>
        </Link>

        <button
          onClick={onOpenAddModal}
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Add Website / App</span>
        </button>
      </div>
    </div>
  );
};
