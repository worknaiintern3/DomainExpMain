import React from 'react';
import { OverviewMetrics } from '../overview.types';

interface OverviewMetricCardsProps {
  metrics: OverviewMetrics;
}

export const OverviewMetricCards: React.FC<OverviewMetricCardsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-md">
      {/* Card 1: Total Assets */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border border-outline-variant/40">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-primary/5 group-hover:scale-125 transition-transform pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Total Assets
          </span>
          <span className="material-symbols-outlined text-primary text-[18px]">dns</span>
        </div>
        <div className="flex items-baseline justify-between mt-unit-xs">
          <div className="font-display-lg text-display-lg text-on-surface tracking-tight font-semibold">
            {metrics.totalAssets.count}
          </div>
          <div className="flex items-center gap-unit-2xs text-tertiary font-label-md text-label-md bg-secondary-container/40 px-unit-xs py-0.5 rounded font-medium">
            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
            <span>{metrics.totalAssets.trend}</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-unit-sm pt-unit-xs border-t border-surface-container-high/40">
          <span className="font-caption-xs text-caption-xs text-secondary">Domains Tracked</span>
          <span className="font-label-mono text-label-mono text-on-surface font-medium">
            {metrics.totalAssets.trackedRatio}
          </span>
        </div>
      </div>

      {/* Card 2: Expiring Soon */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border border-outline-variant/40">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-secondary-container/30 group-hover:scale-125 transition-transform pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Expiring (30d)
          </span>
          <span className="material-symbols-outlined text-on-secondary-container text-[18px]">schedule</span>
        </div>
        <div className="flex items-baseline justify-between mt-unit-xs">
          <div className="font-display-lg text-display-lg text-on-surface tracking-tight font-semibold">
            {metrics.expiringSoon.count}
          </div>
          <span className="font-caption-xs text-caption-xs bg-secondary-container text-on-secondary-container px-unit-xs py-0.5 rounded font-medium">
            {metrics.expiringSoon.percentage}
          </span>
        </div>
        <div className="flex items-center justify-between mt-unit-sm pt-unit-xs border-t border-surface-container-high/40">
          <span className="font-caption-xs text-caption-xs text-secondary">Attention Window</span>
          <span className="font-label-mono text-label-mono text-on-surface font-medium">
            {metrics.expiringSoon.cutoffDate}
          </span>
        </div>
      </div>

      {/* Card 3: Critical Renewals */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border border-outline-variant/40">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-error-container/40 group-hover:scale-125 transition-transform pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-error font-semibold">
            Critical (≤ 7d)
          </span>
          <span className="material-symbols-outlined text-error text-[18px]">emergency_home</span>
        </div>
        <div className="flex items-baseline justify-between mt-unit-xs">
          <div className="font-display-lg text-display-lg text-error tracking-tight font-semibold">
            {metrics.criticalRenewals.count}
          </div>
          <span className="font-caption-xs text-caption-xs bg-error-container text-on-error-container px-unit-xs py-0.5 rounded font-medium animate-pulse">
            {metrics.criticalRenewals.statusText}
          </span>
        </div>
        <div className="flex items-center justify-between mt-unit-sm pt-unit-xs border-t border-surface-container-high/40">
          <span className="font-caption-xs text-caption-xs text-secondary">Next Expiry</span>
          <span className="font-label-mono text-label-mono text-error font-bold">
            {metrics.criticalRenewals.nextExpiryDomain} ({metrics.criticalRenewals.nextExpiryDays}d)
          </span>
        </div>
      </div>

      {/* Card 4: Annual Run-Rate */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border border-outline-variant/40">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-surface-container group-hover:scale-125 transition-transform pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Annual Run-Rate
          </span>
          <span className="material-symbols-outlined text-primary-container text-[18px]">account_balance_wallet</span>
        </div>
        <div className="flex items-baseline justify-between mt-unit-xs">
          <div className="font-display-lg text-display-lg text-on-surface tracking-tight font-semibold">
            {metrics.annualRunRate.totalCostFormatted}
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary font-label-mono font-medium">
            {metrics.annualRunRate.monthlyAvgFormatted}
          </span>
        </div>
        <div className="flex items-center justify-between mt-unit-sm pt-unit-xs border-t border-surface-container-high/40">
          <span className="font-caption-xs text-caption-xs text-secondary">Projected 30d Burn</span>
          <span className="font-label-mono text-label-mono text-on-surface font-semibold">
            {metrics.annualRunRate.projected30dBurnFormatted}
          </span>
        </div>
      </div>
    </div>
  );
};
