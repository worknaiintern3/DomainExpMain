import React from 'react';
import { formatMinorUnits, type DomainAvailabilityResult } from '@/api/domain-search';
import {
  formatTenthsPercent,
  ownershipItems,
  ownershipSavings,
  providerLabel,
} from '../pricing.calc';
import type { HorizonYears } from '../pricing.types';

interface OwnershipCostBenchmarkProps {
  results: DomainAvailabilityResult[];
  horizon: HorizonYears;
  onHorizonChange: (h: HorizonYears) => void;
  domain: string | null;
}

const HORIZONS: readonly { years: HorizonYears; label: string }[] = [
  { label: '1 Year', years: 1 },
  { label: '3 Years', years: 3 },
  { label: '5 Years', years: 5 },
];

export const OwnershipCostBenchmark: React.FC<OwnershipCostBenchmarkProps> = ({
  results,
  horizon,
  onHorizonChange,
  domain,
}) => {
  const { items, excluded } = ownershipItems(results, horizon);
  const savings = ownershipSavings(items);
  const maxByCurrency = new Map<string, number>();
  for (const item of items) {
    maxByCurrency.set(
      item.currency,
      Math.max(maxByCurrency.get(item.currency) ?? 0, item.totalMinorUnits),
    );
  }
  const mixedCurrencies = maxByCurrency.size > 1;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-unit-md">
      {/* Horizon Benchmark Card (Left 5 Cols) */}
      <div className="xl:col-span-5 p-unit-base rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30">
        <div>
          <div className="flex items-center justify-between mb-unit-sm">
            <div className="flex items-center gap-unit-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">insights</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Ownership Cost
              </h3>
            </div>

            {/* Horizon Selector */}
            <div className="flex items-center p-0.5 bg-surface-container rounded-md border border-outline-variant/20">
              {HORIZONS.map((option) => (
                <button
                  key={option.years}
                  type="button"
                  onClick={() => onHorizonChange(option.years)}
                  aria-pressed={horizon === option.years}
                  className={`px-2 py-0.5 rounded text-caption-xs font-caption-xs cursor-pointer transition-all ${
                    horizon === option.years
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <p className="font-caption-xs text-caption-xs text-secondary mb-unit-sm">
            First-year prices can mask higher recurring charges. Cost over a {horizon}-year cycle
            {domain ? ` for ${domain}` : ''} = registration + {horizon - 1} renewal
            {horizon - 1 === 1 ? '' : 's'}.{' '}
            <span className="block mt-1 text-[11px] text-outline">
              Uses the returned prices and assumes renewal prices stay unchanged. Each registrar is
              costed in its own currency.
            </span>
          </p>

          {items.length === 0 ? (
            <p className="font-caption-xs text-caption-xs text-secondary rounded-lg bg-surface-container-low p-unit-sm border border-outline-variant/20">
              Needs both a registration and a renewal price from at least one registrar. None
              returned both for this domain.
            </p>
          ) : (
            <div className="flex flex-col gap-unit-xs">
              {items.map((item) => (
                <div
                  key={item.provider}
                  className={`p-unit-sm rounded-lg flex items-center justify-between border transition-all ${
                    item.isLowestInCurrency && items.length > 1
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-surface-container-low border-outline-variant/20'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        {providerLabel(item.provider)}
                      </span>
                      {item.isLowestInCurrency && items.length > 1 && (
                        <span className="px-1.5 py-0.2 rounded-full font-caption-xs text-[10px] font-semibold bg-secondary-container text-on-secondary-container">
                          {`Lowest ${item.currency} total`}
                        </span>
                      )}
                    </div>
                    <span className="font-caption-xs text-[11px] text-secondary truncate mt-0.5">
                      Renews at {formatMinorUnits(item.renewalMinorUnits, item.currency)}/yr
                    </span>
                  </div>

                  <div className="flex flex-col items-end shrink-0 ml-unit-sm">
                    <span className="font-label-mono text-label-mono font-bold text-on-surface">
                      {formatMinorUnits(item.totalMinorUnits, item.currency)}
                    </span>
                    <span className="font-caption-xs text-[11px] text-secondary">
                      Yr-1: {formatMinorUnits(item.year1MinorUnits, item.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {excluded.length > 0 && (
            <p className="mt-unit-xs font-caption-xs text-[11px] text-secondary">
              Not costed (registration or renewal price not returned):{' '}
              {excluded.map(providerLabel).join(', ')}.
            </p>
          )}
        </div>
      </div>

      {/* Cumulative Cost Bar Chart (Right 7 Cols) */}
      <div className="xl:col-span-7 p-unit-base rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30">
        <div>
          <div className="flex items-center justify-between mb-unit-xs flex-wrap gap-2">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                {horizon}-Year Cumulative Cost
              </h3>
              <p className="font-caption-xs text-caption-xs text-secondary">
                Registration vs.{' '}
                {horizon > 1 ? `${horizon - 1}-year cumulative renewal load` : 'initial year only'}
              </p>
            </div>
            <div className="flex items-center gap-unit-md text-caption-xs font-caption-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-primary"></span>
                <span className="text-on-surface-variant">Year 1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-secondary-container"></span>
                <span className="text-on-surface-variant">Years 2-{horizon} Renewals</span>
              </div>
            </div>
          </div>

          {mixedCurrencies && (
            <p
              role="note"
              className="mb-unit-xs font-caption-xs text-caption-xs text-amber-800 rounded bg-amber-50 border border-amber-200/50 p-unit-xs"
            >
              Mixed currencies: bars are scaled within each currency only and are not comparable
              across currencies.
            </p>
          )}

          <div className="flex flex-col gap-unit-sm my-unit-xs">
            {items.map((item) => {
              const max = maxByCurrency.get(item.currency) ?? 0;
              const relativeBarWidth = max > 0 ? (item.totalMinorUnits / max) * 100 : 100;
              const yr1Share =
                item.totalMinorUnits > 0 ? (item.year1MinorUnits / item.totalMinorUnits) * 100 : 100;
              const renewalShare = 100 - yr1Share;
              return (
                <div key={item.provider} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between font-label-md text-label-md">
                    <span className="font-medium text-on-surface">
                      {providerLabel(item.provider)}{' '}
                      <span className="text-caption-xs text-secondary font-normal">
                        ({item.currency})
                      </span>
                    </span>
                    <span className="font-label-mono text-label-mono font-bold text-on-surface">
                      {formatMinorUnits(item.totalMinorUnits, item.currency)} Total
                    </span>
                  </div>

                  <div className="w-full h-5 bg-surface-container rounded-md overflow-hidden flex">
                    <div
                      className="bg-primary h-full transition-all duration-500"
                      style={{ width: `${(relativeBarWidth * yr1Share) / 100}%` }}
                      title={`Year 1: ${formatMinorUnits(item.year1MinorUnits, item.currency)}`}
                    ></div>
                    <div
                      className="h-full bg-secondary-fixed-dim transition-all duration-500"
                      style={{ width: `${(relativeBarWidth * renewalShare) / 100}%` }}
                      title={`Years 2-${horizon}: ${formatMinorUnits(
                        item.totalMinorUnits - item.year1MinorUnits,
                        item.currency,
                      )}`}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Savings callout: only between registrars that share a currency */}
        {savings.length > 0 ? (
          <div className="mt-unit-xs px-unit-sm py-unit-xs rounded bg-surface-container text-on-surface-variant flex flex-col gap-0.5 text-caption-xs font-caption-xs border border-outline-variant/20">
            {savings.map((entry) => (
              <div key={entry.currency} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">savings</span>
                  <span>
                    {entry.currency}: cheapest vs. dearest differ by{' '}
                    {formatMinorUnits(entry.savingsMinorUnits, entry.currency)} over {horizon}{' '}
                    year{horizon === 1 ? '' : 's'}.
                  </span>
                </div>
                <span className="font-semibold text-primary shrink-0">
                  {formatTenthsPercent(entry.savingsTenthsPercent)} lower
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-unit-xs px-unit-sm py-unit-xs rounded bg-surface-container text-secondary text-caption-xs font-caption-xs border border-outline-variant/20">
            A savings comparison needs two registrars that both returned prices in the same currency.
          </div>
        )}
      </div>
    </div>
  );
};
