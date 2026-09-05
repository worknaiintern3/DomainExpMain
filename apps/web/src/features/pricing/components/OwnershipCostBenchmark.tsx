import React from 'react';
import { OwnershipCostItem, HorizonYears } from '../pricing.types';

interface OwnershipCostBenchmarkProps {
  items: OwnershipCostItem[];
  horizon: HorizonYears;
  onHorizonChange: (h: HorizonYears) => void;
  tld: string;
}

export const OwnershipCostBenchmark: React.FC<OwnershipCostBenchmarkProps> = ({
  items,
  horizon,
  onHorizonChange,
  tld,
}) => {
  // Compute savings between best value provider and highest renewal provider
  const bestItem = items.find((i) => i.isBestValue) || items[0];
  const highestItem = [...items].sort(
    (a, b) => b.calculatedTotalCost - a.calculatedTotalCost
  )[0];

  const savingsAmount =
    highestItem && bestItem
      ? Math.max(0, highestItem.calculatedTotalCost - bestItem.calculatedTotalCost)
      : 0;

  const savingsPercent =
    highestItem && highestItem.calculatedTotalCost > 0
      ? Math.round((savingsAmount / highestItem.calculatedTotalCost) * 1000) / 10
      : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-unit-md">
      {/* Horizon Benchmark Card (Left 5 Cols) */}
      <div className="xl:col-span-5 p-unit-base rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30">
        <div>
          <div className="flex items-center justify-between mb-unit-sm">
            <div className="flex items-center gap-unit-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">insights</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Ownership Cost Benchmark
              </h3>
            </div>

            {/* Horizon Selector */}
            <div className="flex items-center p-0.5 bg-surface-container rounded-md border border-outline-variant/20">
              <button
                type="button"
                onClick={() => onHorizonChange(1)}
                className={`px-2 py-0.5 rounded text-caption-xs font-caption-xs cursor-pointer transition-all ${
                  horizon === 1
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                1 Year
              </button>
              <button
                type="button"
                onClick={() => onHorizonChange(3)}
                className={`px-2 py-0.5 rounded text-caption-xs font-caption-xs cursor-pointer transition-all ${
                  horizon === 3
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                3 Years
              </button>
              <button
                type="button"
                onClick={() => onHorizonChange(5)}
                className={`px-2 py-0.5 rounded text-caption-xs font-caption-xs cursor-pointer transition-all ${
                  horizon === 5
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                5 Years
              </button>
            </div>
          </div>

          <p className="font-caption-xs text-caption-xs text-secondary mb-unit-sm">
            First-year discounts mask high recurring charges. Benchmark calculated over a {horizon}-year rolling cycle for {tld}.{' '}
            <span className="block mt-1 text-[11px] text-outline">
              Estimated ownership cost based on reference pricing and assumes renewal rates remain unchanged.
            </span>
          </p>

          {/* Comparative Preview List */}
          <div className="flex flex-col gap-unit-xs">
            {items.map((item) => (
              <div
                key={item.registrarId}
                className={`p-unit-sm rounded-lg flex items-center justify-between border transition-all ${
                  item.isMarkupSpike
                    ? 'bg-rose-50/60 border-rose-200/50'
                    : item.isBestValue
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-surface-container-low border-outline-variant/20'
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`font-label-md text-label-md font-semibold ${
                        item.isMarkupSpike
                          ? 'text-rose-900'
                          : item.isBestValue
                          ? 'text-primary'
                          : 'text-on-surface'
                      }`}
                    >
                      {item.registrarName}
                    </span>
                    {item.badge && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full font-caption-xs text-[10px] font-semibold ${
                          item.badgeVariant === 'best'
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="font-caption-xs text-[11px] text-secondary truncate mt-0.5">
                    {item.tagline}
                  </span>
                </div>

                <div className="flex flex-col items-end shrink-0 ml-unit-sm">
                  <span
                    className={`font-label-mono text-label-mono font-bold ${
                      item.isMarkupSpike
                        ? 'text-rose-700'
                        : item.isBestValue
                        ? 'text-primary'
                        : 'text-on-surface'
                    }`}
                  >
                    {item.calculatedTotalFormatted}
                  </span>
                  <span className="font-caption-xs text-[11px] text-secondary">
                    {item.year1Formatted}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5-Year Ownership Cost Bar Chart Visualization (Right 7 Cols) */}
      <div className="xl:col-span-7 p-unit-base rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30">
        <div>
          <div className="flex items-center justify-between mb-unit-xs flex-wrap gap-2">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                {horizon}-Year Cumulative Cost Trajectory
              </h3>
              <p className="font-caption-xs text-caption-xs text-secondary">
                Registration promo vs. {horizon > 1 ? `${horizon - 1}-year cumulative renewal load` : 'initial year only'}
              </p>
            </div>
            <div className="flex items-center gap-unit-md text-caption-xs font-caption-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-primary"></span>
                <span className="text-on-surface-variant">Year 1 Promo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-secondary-container"></span>
                <span className="text-on-surface-variant">Years 2-{horizon} Renewals</span>
              </div>
            </div>
          </div>

          {/* Custom Horizontal Stacked Bar Charts */}
          <div className="flex flex-col gap-unit-sm my-unit-xs">
            {items.map((item) => {
              const maxCost = Math.max(...items.map((i) => i.calculatedTotalCost));
              const relativeBarWidth = maxCost > 0 ? (item.calculatedTotalCost / maxCost) * 100 : 100;
              const yr1Share = (item.year1Cost / item.calculatedTotalCost) * 100;
              const renShare = 100 - yr1Share;

              return (
                <div key={item.registrarId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between font-label-md text-label-md">
                    <span className="font-medium text-on-surface flex items-center gap-1">
                      {item.registrarName}{' '}
                      <span className="text-caption-xs text-secondary font-normal">
                        ({item.isBestValue ? 'At-cost' : item.isMarkupSpike ? 'Promotional Spike' : 'Standard'})
                      </span>
                    </span>
                    <span
                      className={`font-label-mono text-label-mono font-bold ${
                        item.isMarkupSpike
                          ? 'text-rose-700'
                          : item.isBestValue
                          ? 'text-primary'
                          : 'text-on-surface'
                      }`}
                    >
                      {item.calculatedTotalFormatted} Total
                    </span>
                  </div>

                  <div className="w-full h-5 bg-surface-container rounded-md overflow-hidden flex">
                    <div
                      className="bg-primary h-full transition-all duration-500"
                      style={{ width: `${(relativeBarWidth * yr1Share) / 100}%` }}
                      title={`Year 1: ₹${item.year1Cost.toLocaleString('en-IN')}`}
                    ></div>
                    <div
                      className={`h-full transition-all duration-500 ${
                        item.isMarkupSpike ? 'bg-rose-400' : 'bg-secondary-fixed-dim'
                      }`}
                      style={{ width: `${(relativeBarWidth * renShare) / 100}%` }}
                      title={`Years 2-${horizon}: ₹${(item.calculatedTotalCost - item.year1Cost).toLocaleString('en-IN')}`}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Savings callout bar */}
        <div className="mt-unit-xs px-unit-sm py-unit-xs rounded bg-surface-container text-on-surface-variant flex items-center justify-between text-caption-xs font-caption-xs border border-outline-variant/20">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">savings</span>
            <span>
              Estimated ₹{savingsAmount.toLocaleString('en-IN')} savings ({savingsPercent}% estimated reduction over {horizon} years). Based on reference pricing dataset.
            </span>
          </div>
          <span className="font-semibold text-primary shrink-0 ml-2">
            {savingsPercent}% Est. Reduction
          </span>
        </div>
      </div>
    </div>
  );
};
