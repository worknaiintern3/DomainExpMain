import React from 'react';
import { AlertViewMode } from '../alerts.types';

interface AlertsHeaderProps {
  viewMode: AlertViewMode;
  onViewModeChange: (mode: AlertViewMode) => void;
  activeAlertsCount: number;
  healthMatrixCount: number;
  unreadCount: number;
  onMarkAllRead: () => void;
  onOpenRulesModal: () => void;
}

export const AlertsHeader: React.FC<AlertsHeaderProps> = ({
  viewMode,
  onViewModeChange,
  activeAlertsCount,
  healthMatrixCount,
  unreadCount,
  onMarkAllRead,
  onOpenRulesModal,
}) => {
  return (
    <div className="flex flex-col gap-unit-md mb-unit-xs">
      {/* Top Hero Bar / Operational Header */}
      <div className="flex flex-wrap items-center justify-between gap-unit-md">
        <div className="flex items-center gap-unit-md">
          <div className="flex items-center gap-unit-sm">
            <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
              Alerts &amp; Monitoring
            </h1>
            <span className="px-unit-xs py-0.5 rounded-full bg-surface-container-high text-primary font-caption-xs text-caption-xs uppercase tracking-wider font-semibold">
              PORTFOLIO ALERTS
            </span>
          </div>
        </div>

        {/* Action Cluster */}
        <div className="flex items-center gap-unit-sm">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container shadow-micro transition-colors font-label-md text-label-md border border-outline-variant/30 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">
                done_all
              </span>
              <span>Mark All Read ({unreadCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenRulesModal}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container shadow-micro transition-colors font-label-md text-label-md border border-outline-variant/30 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">tune</span>
            <span>Configure Rules</span>
          </button>
        </div>
      </div>

      {/* Subtitle & Segmented View Controller Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-unit-sm">
        <p className="font-body-md text-body-md text-secondary">
          Review expiry, renewal, SSL, DNS and infrastructure mapping risks calculated from stored portfolio records.
        </p>

        {/* Segmented View Controller Tabs */}
        <div className="flex items-center bg-surface-container-low p-unit-2xs rounded-lg gap-unit-2xs border border-outline-variant/20 flex-wrap">
          <button
            type="button"
            onClick={() => onViewModeChange('feed')}
            className={`px-unit-sm py-1 rounded-md font-label-md text-label-md transition-all cursor-pointer ${
              viewMode === 'feed'
                ? 'text-white bg-[#4f46e5] font-semibold shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Active Alerts ({activeAlertsCount})
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('matrix')}
            className={`px-unit-sm py-1 rounded-md font-label-md text-label-md transition-all cursor-pointer ${
              viewMode === 'matrix'
                ? 'text-white bg-[#4f46e5] font-semibold shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Health Matrix ({healthMatrixCount})
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('coverage')}
            className={`px-unit-sm py-1 rounded-md font-label-md text-label-md transition-all cursor-pointer ${
              viewMode === 'coverage'
                ? 'text-white bg-[#4f46e5] font-semibold shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Monitoring Coverage
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('rules')}
            className={`px-unit-sm py-1 rounded-md font-label-md text-label-md transition-all cursor-pointer ${
              viewMode === 'rules'
                ? 'text-white bg-[#4f46e5] font-semibold shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Alert Rules
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('empty')}
            className={`px-unit-sm py-1 rounded-md font-label-md text-label-md transition-all cursor-pointer ${
              viewMode === 'empty'
                ? 'text-white bg-[#4f46e5] font-semibold shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Empty Preview
          </button>
        </div>
      </div>
    </div>
  );
};
