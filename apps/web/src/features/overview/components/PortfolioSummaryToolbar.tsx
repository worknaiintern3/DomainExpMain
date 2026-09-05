import React from 'react';

export const PortfolioSummaryToolbar: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-unit-sm bg-surface-container-lowest p-unit-md rounded-xl shadow-sm border border-outline-variant/40">
      <div className="flex items-center gap-unit-md min-w-0">
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
        <div className="flex items-baseline gap-unit-xs truncate">
          <span className="font-label-mono text-label-mono text-on-surface font-semibold">
            PORTFOLIO SUMMARY
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">
            • Based on stored domain records
          </span>
        </div>
      </div>
      <div className="flex items-center gap-unit-sm shrink-0 flex-wrap">
        <div className="flex items-center gap-unit-2xs bg-surface-container-low px-unit-sm py-unit-2xs rounded-lg border border-outline-variant/30">
          <span className="material-symbols-outlined text-secondary text-[16px]">currency_rupee</span>
          <span className="font-label-mono text-label-mono text-on-surface font-medium">INR (₹)</span>
        </div>
        <button
          className="h-8 px-unit-sm bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg flex items-center gap-unit-xs transition-colors border border-outline-variant/30 text-caption-xs font-semibold"
          type="button"
          title="Display Density: Compact"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">tune</span>
          <span>Density: Compact</span>
        </button>
        <button
          className="h-8 px-unit-sm bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg flex items-center gap-unit-xs transition-colors border border-outline-variant/30 text-caption-xs font-semibold"
          type="button"
          title="Export CSV"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">file_download</span>
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
};
