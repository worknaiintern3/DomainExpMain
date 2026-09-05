import React from 'react';
import { PricingSummaryMetrics } from '../pricing.types';

interface PricingSummaryStripProps {
  metrics: PricingSummaryMetrics;
  tld: string;
}

export const PricingSummaryStrip: React.FC<PricingSummaryStripProps> = ({
  metrics,
  tld,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-unit-sm">
      {/* 1. Lowest Registration */}
      <div className="p-unit-sm rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
          Lowest Registration
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-headline-sm text-headline-sm font-label-mono text-on-surface font-semibold">
            {metrics.lowestRegFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">/1st yr</span>
        </div>
        <span className="font-caption-xs text-caption-xs text-primary font-medium mt-1 truncate">
          {metrics.lowestRegProvider}
        </span>
      </div>

      {/* 2. Lowest Renewal */}
      <div className="p-unit-sm rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Lowest Renewal
          </span>
          <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-caption-xs text-[10px] font-semibold">
            Best Value
          </span>
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-headline-sm text-headline-sm font-label-mono text-primary font-semibold">
            {metrics.lowestRenFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">/yr recurring</span>
        </div>
        <span className="font-caption-xs text-caption-xs text-tertiary font-medium mt-1 truncate">
          {metrics.lowestRenProvider}
        </span>
      </div>

      {/* 3. Lowest Transfer */}
      <div className="p-unit-sm rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
          Lowest Transfer
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-headline-sm text-headline-sm font-label-mono text-on-surface font-semibold">
            {metrics.lowestTransFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">+1 yr included</span>
        </div>
        <span className="font-caption-xs text-caption-xs text-on-surface-variant font-medium mt-1 truncate">
          {metrics.lowestTransProvider}
        </span>
      </div>

      {/* 4. Registrars Compared */}
      <div className="p-unit-sm rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
          Registrars Compared
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-headline-sm text-headline-sm font-label-mono text-on-surface font-semibold">
            {metrics.registrarsCount}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">Providers Compared</span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary mt-1">
          Reference Sample ({tld})
        </span>
      </div>

      {/* 5. Reference Avg Renewal */}
      <div className="p-unit-sm rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
          Reference Avg Renewal
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-headline-sm text-headline-sm font-label-mono text-on-surface font-semibold">
            {metrics.industryAvgRenewalFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">/yr</span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary mt-1">
          Across {metrics.registrarsCount} registrars
        </span>
      </div>

      {/* 6. Markup Alert */}
      <div className="p-unit-sm rounded-lg bg-rose-50 text-rose-900 shadow-micro flex flex-col justify-between border border-rose-200/50">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px] text-rose-600">warning</span>
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider font-semibold text-rose-800">
            Markup Alert
          </span>
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-headline-sm text-headline-sm font-label-mono text-rose-900 font-bold">
            {metrics.markupAlertCount} of {metrics.registrarsCount}
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-rose-800 font-medium mt-1 truncate">
          {metrics.markupAlertNote}
        </span>
      </div>
    </div>
  );
};
