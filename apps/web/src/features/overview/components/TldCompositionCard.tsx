import React from 'react';
import { TldCompositionData } from '../overview.types';

interface TldCompositionCardProps {
  data: TldCompositionData;
}

export const TldCompositionCard: React.FC<TldCompositionCardProps> = ({ data }) => {
  return (
    <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/40">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            TLD Composition
          </span>
          <div className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            {data.extensionCount} Extensions
          </div>
        </div>
        <span className="material-symbols-outlined text-secondary text-[18px]">pie_chart</span>
      </div>

      <div className="flex flex-col gap-unit-xs mt-unit-sm">
        {data.items.map((item) => (
          <div key={item.tld} className="flex flex-col gap-0.5">
            <div className="flex justify-between font-caption-xs text-caption-xs">
              <span className="font-label-mono text-label-mono font-semibold text-on-surface">
                {item.tld}
              </span>
              <span className="font-label-mono text-label-mono text-secondary">
                {item.count} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div
                className={`h-full ${item.colorClass} rounded-full transition-all`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-unit-xs flex items-center justify-between font-caption-xs text-caption-xs text-secondary border-t border-surface-container mt-unit-xs">
        <span>
          Highest valuation: <strong className="text-on-surface font-semibold">{data.highestValuationTld}</strong>
        </span>
        <span className="font-label-mono text-label-mono text-on-surface font-medium">
          {data.averageAnnualCostFormatted}
        </span>
      </div>
    </div>
  );
};
