import React from 'react';

interface DomainHeaderProps {
  totalActiveCount: number;
  viewMode: 'live' | 'empty';
  onToggleViewMode: (mode: 'live' | 'empty') => void;
  onOpenAddModal: () => void;
}

export const DomainHeader: React.FC<DomainHeaderProps> = ({
  totalActiveCount,
  viewMode,
  onToggleViewMode,
  onOpenAddModal,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-unit-md pt-unit-xs pb-unit-sm">
      <div className="flex flex-col">
        <div className="flex items-center gap-unit-sm">
          <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
            My Domains
          </h1>
          <span className="px-unit-sm py-0.5 rounded-full bg-surface-container font-label-mono text-caption-xs text-primary font-semibold">
            {totalActiveCount} DOMAINS
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
          Manage, track and organize your complete domain portfolio records.
        </p>
      </div>

      <div className="flex items-center gap-unit-sm shrink-0 flex-wrap">
        {/* Toggle for Domain Portfolio vs Empty State Preview */}
        <div className="flex items-center bg-surface-container-high p-unit-2xs rounded-lg text-caption-xs font-label-md mr-unit-xs border border-outline-variant/30">
          <button
            onClick={() => onToggleViewMode('live')}
            className={`px-unit-sm py-1 rounded transition-all ${
              viewMode === 'live'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
            type="button"
          >
            Domain Portfolio ({totalActiveCount})
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
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm border border-outline-variant/40"
          type="button"
          title="Import domain records"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">cloud_upload</span>
          <span>Import</span>
        </button>

        <button
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm border border-outline-variant/40"
          type="button"
          title="Export CSV"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">file_download</span>
          <span>Export CSV</span>
        </button>

        <button
          onClick={onOpenAddModal}
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add Domain</span>
        </button>
      </div>
    </div>
  );
};
