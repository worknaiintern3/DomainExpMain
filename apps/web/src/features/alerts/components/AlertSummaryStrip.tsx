import React from 'react';
import { AlertSummaryMetrics } from '../alerts.types';

interface AlertSummaryStripProps {
  metrics: AlertSummaryMetrics;
  onSelectSeverity?: (severity: 'CRITICAL' | 'WARNING' | 'UPCOMING' | 'RESOLVED' | 'ALL') => void;
}

export const AlertSummaryStrip: React.FC<AlertSummaryStripProps> = ({
  metrics,
  onSelectSeverity,
}) => {
  return (
    <div className="flex flex-col gap-unit-xs">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-unit-sm">
        {/* 1. Critical */}
        <div
          onClick={() => onSelectSeverity && onSelectSeverity('CRITICAL')}
          className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between hover:shadow-md transition-all border border-outline-variant/30 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-rose-700">
              Critical
            </span>
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-rose-800">
                error
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-rose-700 font-bold">
              {metrics.criticalCount}
            </span>
            <span className="font-caption-xs text-caption-xs text-rose-700 font-medium">
              Require action
            </span>
          </div>
        </div>

        {/* 2. Warning */}
        <div
          onClick={() => onSelectSeverity && onSelectSeverity('WARNING')}
          className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between hover:shadow-md transition-all border border-outline-variant/30 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-secondary">
              Warning
            </span>
            <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-tertiary">
                warning
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              {metrics.warningCount}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              12-29d window
            </span>
          </div>
        </div>

        {/* 3. Upcoming */}
        <div
          onClick={() => onSelectSeverity && onSelectSeverity('UPCOMING')}
          className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between hover:shadow-md transition-all border border-outline-variant/30 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-secondary">
              Upcoming
            </span>
            <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-primary">
                schedule
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-primary font-semibold">
              {metrics.upcomingCount}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              Upcoming window
            </span>
          </div>
        </div>

        {/* 4. Resolved */}
        <div
          onClick={() => onSelectSeverity && onSelectSeverity('RESOLVED')}
          className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between hover:shadow-md transition-all border border-outline-variant/30 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-secondary">
              Resolved
            </span>
            <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-secondary">
                check_circle
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              {metrics.resolvedCount}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              Reference history
            </span>
          </div>
        </div>

        {/* 5. Unread */}
        <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between hover:shadow-md transition-all border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-primary">
              Unread
            </span>
            <div className="w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-primary">
                mark_chat_unread
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-primary font-bold">
              {metrics.unreadCount}
            </span>
            <span className="font-caption-xs text-caption-xs text-primary font-medium">
              Pending review
            </span>
          </div>
        </div>

        {/* 6. Tracked Domains */}
        <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between hover:shadow-md transition-all border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-secondary">
              Tracked Domains
            </span>
            <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-on-surface-variant">
                dns
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              {metrics.trackedDomainsCount}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              Portfolio records
            </span>
          </div>
        </div>
      </div>

      {/* Notification Delivery Provenance Sub-strip */}
      <div className="px-unit-base py-1.5 rounded-lg bg-surface-container-low text-secondary font-caption-xs text-caption-xs flex flex-wrap items-center justify-between gap-2 border border-outline-variant/20">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-primary">info</span>
          <span>
            Alert triggers are calculated from stored portfolio records. Background probes &amp; live polling are not connected in this preview.
          </span>
        </div>
        <span className="font-label-mono text-[11px] text-secondary font-medium shrink-0">
          Notification Delivery: <span className="text-on-surface font-semibold">Configuration Only</span>
        </span>
      </div>
    </div>
  );
};
