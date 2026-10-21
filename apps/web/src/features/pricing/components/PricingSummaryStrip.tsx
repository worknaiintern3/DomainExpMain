import React from 'react';
import { formatMinorUnits, type DomainAvailabilityResult } from '@/api/domain-search';
import {
  formatBps,
  isDefinitive,
  largestStepUp,
  lowestByCurrency,
  pricedCurrencies,
  providerLabel,
} from '../pricing.calc';
import type { CurrencyLowest, PriceField } from '../pricing.types';

interface PricingSummaryStripProps {
  results: DomainAvailabilityResult[];
}

const CARD =
  'p-unit-sm rounded-lg bg-surface-container-lowest shadow-micro flex flex-col justify-between border border-outline-variant/30';
const LABEL =
  'font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium';

function LowestCard({
  title,
  suffix,
  lowest,
  highlight,
}: {
  title: string;
  suffix: string;
  lowest: CurrencyLowest[];
  highlight?: boolean;
}) {
  const [only] = lowest;
  const providers = only ? only.providers.map(providerLabel).join(', ') : '';
  return (
    <div className={CARD}>
      <span className={LABEL}>{title}</span>
      {lowest.length === 0 && (
        <>
          <div className="mt-1 font-headline-sm text-headline-sm font-label-mono text-outline font-semibold">
            —
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary mt-1">
            Not returned by any registrar
          </span>
        </>
      )}
      {lowest.length === 1 && only && (
        <>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={`font-headline-sm text-headline-sm font-label-mono font-semibold ${
                highlight ? 'text-primary' : 'text-on-surface'
              }`}
            >
              {formatMinorUnits(only.minorUnits, only.currency) ?? '—'}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary">{suffix}</span>
          </div>
          <span className="font-caption-xs text-caption-xs text-primary font-medium mt-1 truncate">
            {providers}
          </span>
        </>
      )}
      {lowest.length > 1 && (
        <>
          <div className="mt-1 font-headline-sm text-headline-sm text-on-surface font-semibold">
            Mixed currencies
          </div>
          <ul className="mt-1 flex flex-col gap-0.5 font-caption-xs text-caption-xs text-secondary">
            {lowest.map((entry) => (
              <li key={entry.currency} className="truncate">
                <span className="font-label-mono text-on-surface">
                  {formatMinorUnits(entry.minorUnits, entry.currency) ?? '—'}
                </span>{' '}
                {entry.providers.map(providerLabel).join(', ')}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export const PricingSummaryStrip: React.FC<PricingSummaryStripProps> = ({ results }) => {
  const lowest = (field: PriceField) => lowestByCurrency(results, field);
  const definitiveCount = results.filter(isDefinitive).length;
  const pricedCount = results.filter(
    (result) =>
      result.registrationPriceMinorUnits !== null ||
      result.renewalPriceMinorUnits !== null ||
      result.transferPriceMinorUnits !== null,
  ).length;
  const currencies = pricedCurrencies(results);
  const stepUp = largestStepUp(results);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-unit-sm">
      <LowestCard title="Lowest Registration" suffix="/1st yr" lowest={lowest('registration')} />
      <LowestCard title="Lowest Renewal" suffix="/yr recurring" lowest={lowest('renewal')} highlight />
      <LowestCard title="Lowest Transfer" suffix="+1 yr" lowest={lowest('transfer')} />

      {/* Registrars responding */}
      <div className={CARD}>
        <span className={LABEL}>Registrars Responding</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-headline-sm text-headline-sm font-label-mono text-on-surface font-semibold">
            {definitiveCount} of {results.length}
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary mt-1">
          {pricedCount} returned prices
        </span>
      </div>

      {/* Currencies */}
      <div className={CARD}>
        <span className={LABEL}>Currency</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-headline-sm text-headline-sm font-label-mono text-on-surface font-semibold">
            {currencies.length === 0 ? '—' : currencies.length === 1 ? currencies[0] : 'Mixed'}
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary mt-1">
          {currencies.length > 1
            ? `${currencies.join(', ')} · never compared`
            : 'As returned · not converted'}
        </span>
      </div>

      {/* Largest renewal step-up (computed from two real prices) */}
      <div className="p-unit-sm rounded-lg bg-rose-50 text-rose-900 shadow-micro flex flex-col justify-between border border-rose-200/50">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px] text-rose-600">warning</span>
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider font-semibold text-rose-800">
            Renewal Step-up
          </span>
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-headline-sm text-headline-sm font-label-mono text-rose-900 font-bold">
            {stepUp ? formatBps(stepUp.bps) : '—'}
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-rose-800 font-medium mt-1 truncate">
          {stepUp ? `${providerLabel(stepUp.provider)} renewal vs 1st year` : 'Needs register and renew prices'}
        </span>
      </div>
    </div>
  );
};
