import React from 'react';
import { DomainSummaryMetrics } from '../domains.types';

interface DomainSummaryStripProps {
  summary: DomainSummaryMetrics;
}

export const DomainSummaryStrip: React.FC<DomainSummaryStripProps> = ({ summary }) => {
  return (
    <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm p-unit-md flex flex-wrap items-center justify-between gap-y-unit-sm divide-y lg:divide-y-0 lg:divide-x divide-outline-variant/30 border border-outline-variant/40">
      {/* 1. Total Domains */}
      <div className="flex items-center gap-unit-md px-unit-md py-unit-xs flex-1 min-w-[140px]">
        <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
          <span className="material-symbols-outlined text-[20px]">domain</span>
        </div>
        <div className="flex flex-col">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Total Domains
          </span>
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold font-label-mono">
            {summary.totalCount}
          </span>
        </div>
      </div>

      {/* 2. Healthy Status */}
      <div className="flex items-center gap-unit-md px-unit-md py-unit-xs flex-1 min-w-[140px]">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
        </div>
        <div className="flex flex-col">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Healthy
          </span>
          <div className="flex items-center gap-unit-xs">
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold font-label-mono">
              {summary.healthyCount}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-caption-xs font-label-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {summary.healthyPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. Warning Status (<30d) */}
      <div className="flex items-center gap-unit-md px-unit-md py-unit-xs flex-1 min-w-[140px]">
        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
          <span className="material-symbols-outlined text-[20px]">warning</span>
        </div>
        <div className="flex flex-col">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Warning (&lt;30d)
          </span>
          <div className="flex items-center gap-unit-xs">
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold font-label-mono">
              {summary.warningCount}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-caption-xs font-label-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Review
            </span>
          </div>
        </div>
      </div>

      {/* 4. Critical Status (<7d) */}
      <div className="flex items-center gap-unit-md px-unit-md py-unit-xs flex-1 min-w-[140px]">
        <div className="w-9 h-9 rounded-lg bg-error-container/40 flex items-center justify-center text-error shrink-0">
          <span className="material-symbols-outlined text-[20px]">alarm</span>
        </div>
        <div className="flex flex-col">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Critical (&lt;7d)
          </span>
          <div className="flex items-center gap-unit-xs">
            <span className="font-headline-sm text-headline-sm text-error font-semibold font-label-mono">
              {summary.criticalCount}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container text-caption-xs font-label-mono font-bold animate-pulse">
              Action Req
            </span>
          </div>
        </div>
      </div>

      {/* 5. Auto-Renew */}
      <div className="flex items-center gap-unit-md px-unit-md py-unit-xs flex-1 min-w-[140px]">
        <div className="w-9 h-9 rounded-lg bg-secondary-container/50 flex items-center justify-center text-primary-container shrink-0">
          <span className="material-symbols-outlined text-[20px]">autorenew</span>
        </div>
        <div className="flex flex-col">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Auto-Renew
          </span>
          <div className="flex items-center gap-unit-xs">
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold font-label-mono">
              {summary.autoRenewCount}
            </span>
            <span className="text-caption-xs text-secondary font-label-mono">
              / {summary.totalCount} on
            </span>
          </div>
        </div>
      </div>

      {/* 6. Annual Cost Run */}
      <div className="flex items-center gap-unit-md px-unit-md py-unit-xs flex-1 min-w-[180px]">
        <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
          <span className="material-symbols-outlined text-[20px]">payments</span>
        </div>
        <div className="flex flex-col">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Annual Cost Run
          </span>
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold font-label-mono text-primary">
            {summary.totalAnnualCostFormatted}
          </span>
        </div>
      </div>
    </div>
  );
};
