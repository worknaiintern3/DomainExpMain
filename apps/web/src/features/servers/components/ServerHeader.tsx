import React from 'react';

interface ServerHeaderProps {
  totalCount: number;
  viewMode: 'fleet' | 'empty';
  onToggleViewMode: (mode: 'fleet' | 'empty') => void;
  onOpenAddModal: () => void;
  onExport: () => void;
}

export const ServerHeader: React.FC<ServerHeaderProps> = ({
  totalCount,
  viewMode,
  onToggleViewMode,
  onOpenAddModal,
  onExport,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-unit-md mb-unit-lg">
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-unit-xs">
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
            VPS &amp; Servers
          </h1>
          <span className="px-unit-xs py-unit-2xs rounded bg-surface-container-high text-primary font-label-mono text-caption-xs font-semibold border border-outline-variant/30">
            {totalCount} NODES
          </span>
        </div>
        <p className="font-body-md text-body-md text-secondary mt-unit-2xs">
          Manage VPS, cloud servers, provider accounts, hosted websites, costs and renewals.
        </p>
      </div>

      <div className="flex items-center gap-unit-sm self-start lg:self-center shrink-0 flex-wrap">
        {/* Toggle for Server Fleet vs Empty State Preview */}
        <div className="flex items-center bg-surface-container-high p-unit-2xs rounded-lg text-caption-xs font-label-md mr-unit-xs border border-outline-variant/30">
          <button
            onClick={() => onToggleViewMode('fleet')}
            className={`px-unit-sm py-1 rounded transition-all ${
              viewMode === 'fleet'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
            type="button"
          >
            Server Fleet ({totalCount})
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
          onClick={onExport}
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-label-md shadow-sm transition-colors border border-outline-variant/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">file_download</span>
          <span>Export</span>
        </button>

        <button
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-label-md shadow-sm transition-colors border border-outline-variant/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">file_upload</span>
          <span>Import</span>
        </button>

        <button
          onClick={onOpenAddModal}
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add Server</span>
        </button>
      </div>
    </div>
  );
};
