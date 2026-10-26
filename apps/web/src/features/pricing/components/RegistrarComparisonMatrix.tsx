import React from 'react';
import { formatMinorUnits, type DomainAvailabilityResult } from '@/api/domain-search';
import { formatBps, priceOf, providerLabel, renewalStepUpBps } from '../pricing.calc';
import { PROVIDER_ICONS, describeBasis, describeStatus, formatFetchedAt } from '../pricing.present';
import type { PriceField, PricingSearchState } from '../pricing.types';

interface RegistrarComparisonMatrixProps {
  results: DomainAvailabilityResult[];
  searchState: PricingSearchState;
  domain: string | null;
  selectedProvider: DomainAvailabilityResult['provider'] | null;
  onSelectProvider: (provider: DomainAvailabilityResult['provider']) => void;
  /** Price columns the user chose to see in Settings. Defaults to all three. */
  visibleColumns?: { registration: boolean; renewal: boolean; transfer: boolean };
  /** Renewal step-up at or above this percent gets the warning style. */
  markupThresholdPercent?: number;
}

const SKELETON_ROWS = [0, 1, 2];

function PriceCell({
  result,
  field,
  emphasis,
}: {
  result: DomainAvailabilityResult;
  field: PriceField;
  emphasis?: boolean;
}) {
  const formatted = formatMinorUnits(priceOf(result, field), result.currency);
  if (formatted === null) {
    return (
      <span
        className="text-outline"
        title="Not returned by this registrar's official API"
        aria-label="Not returned"
      >
        —
      </span>
    );
  }
  return (
    <span className={emphasis ? 'font-semibold text-primary' : 'text-on-surface'}>
      {formatted}
      {result.pricingNature === 'INDICATIVE' && (
        <sup
          className="ml-0.5 text-[9px] font-semibold text-amber-700"
          title="Indicative price: only a quote locks it"
        >
          ind.
        </sup>
      )}
    </span>
  );
}

export const RegistrarComparisonMatrix: React.FC<RegistrarComparisonMatrixProps> = ({
  results,
  searchState,
  domain,
  selectedProvider,
  onSelectProvider,
  visibleColumns = { registration: true, renewal: true, transfer: true },
  markupThresholdPercent = 50,
}) => {
  const isLoading = searchState === 'loading';
  const fetchedAt = results[0]?.fetchedAt;
  const shownPriceColumns = [
    visibleColumns.registration,
    visibleColumns.renewal,
    visibleColumns.transfer,
  ].filter(Boolean).length;
  // Registrar + Status + Price basis always render; step-up renders when available.
  const columnCount = 4 + shownPriceColumns;
  const flaggedStepUpBps = Math.round(markupThresholdPercent * 100);

  return (
    <div
      className="rounded-lg bg-surface-container-lowest shadow-micro border border-outline-variant/30 overflow-hidden"
      aria-busy={isLoading}
    >
      {/* Table Header Strip */}
      <div className="px-unit-base py-unit-sm bg-surface-container-low flex flex-wrap items-center justify-between gap-unit-xs border-b border-surface-container/50">
        <div className="flex items-center gap-unit-sm">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Registrar Price Matrix
          </h3>
          {domain && (
            <span className="px-2 py-0.5 rounded bg-surface-container font-label-mono text-caption-xs text-on-surface-variant font-medium">
              {domain}
            </span>
          )}
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary">
          {isLoading
            ? 'Fetching live prices…'
            : fetchedAt
              ? `Fetched ${formatFetchedAt(fetchedAt)} · click a row for details`
              : 'Enter a domain to fetch live prices'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-8 bg-surface-container-low text-secondary font-caption-xs text-caption-xs uppercase tracking-wider select-none border-b border-surface-container/50">
              <th className="px-unit-md py-1 font-semibold">Registrar</th>
              {visibleColumns.registration && <th className="px-unit-sm py-1 font-semibold">Register</th>}
              {visibleColumns.renewal && <th className="px-unit-sm py-1 font-semibold">Renew</th>}
              {visibleColumns.transfer && <th className="px-unit-sm py-1 font-semibold">Transfer</th>}
              <th className="px-unit-sm py-1 font-semibold">Renewal vs 1st yr</th>
              <th className="px-unit-sm py-1 font-semibold">Status</th>
              <th className="px-unit-md py-1 font-semibold text-right">Price basis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container text-body-sm font-body-sm">
            {isLoading &&
              SKELETON_ROWS.map((row) => (
                <tr key={`skeleton-${row}`} className="h-11" data-testid="pricing-skeleton-row">
                  <td colSpan={columnCount} className="px-unit-md py-1.5">
                    <div className="h-4 rounded bg-surface-container animate-pulse" />
                  </td>
                </tr>
              ))}

            {!isLoading && results.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-unit-md py-unit-lg text-center text-secondary">
                  {searchState === 'error'
                    ? 'No registrar prices could be loaded.'
                    : 'No comparison yet. Enter a domain above to see live registrar prices.'}
                </td>
              </tr>
            )}

            {!isLoading &&
              results.map((result) => {
                const isSelected = result.provider === selectedProvider;
                const status = describeStatus(result);
                const basis = describeBasis(result.pricingNature);
                const stepUp = renewalStepUpBps(result);
                const isRegistered = result.state === 'UNAVAILABLE';
                return (
                  <tr
                    key={result.provider}
                    onClick={() => onSelectProvider(result.provider)}
                    className={`h-11 cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-primary/5 hover:bg-primary/10'
                        : 'hover:bg-surface-container-low/60 bg-surface-container-lowest'
                    }`}
                  >
                    {/* Registrar */}
                    <td className="px-unit-md py-1.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectProvider(result.provider);
                        }}
                        aria-pressed={isSelected}
                        aria-label={`Inspect ${providerLabel(result.provider)}`}
                        className="flex items-center gap-2 text-left cursor-pointer"
                      >
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-primary-container text-on-primary'
                              : 'bg-surface-container text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {PROVIDER_ICONS[result.provider]}
                          </span>
                        </div>
                        <span
                          className={`font-label-md text-label-md font-semibold truncate ${
                            isSelected ? 'text-primary' : 'text-on-surface group-hover:text-primary'
                          }`}
                        >
                          {providerLabel(result.provider)}
                        </span>
                      </button>
                    </td>

                    {/* Register */}
                    {visibleColumns.registration && (
                    <td className="px-unit-sm py-1.5 font-label-mono text-label-mono">
                      {isRegistered ? (
                        <span className="text-secondary font-sans text-caption-xs">Registered</span>
                      ) : (
                        <PriceCell result={result} field="registration" />
                      )}
                    </td>
                    )}

                    {/* Renew */}
                    {visibleColumns.renewal && (
                    <td className="px-unit-sm py-1.5 font-label-mono text-label-mono">
                      <PriceCell result={result} field="renewal" emphasis />
                    </td>
                    )}

                    {/* Transfer */}
                    {visibleColumns.transfer && (
                    <td className="px-unit-sm py-1.5 font-label-mono text-label-mono">
                      <PriceCell result={result} field="transfer" />
                    </td>
                    )}

                    {/* Renewal step-up (computed from the two real prices) */}
                    <td className="px-unit-sm py-1.5">
                      {stepUp === null ? (
                        <span className="text-outline">—</span>
                      ) : (
                        <span
                          title={stepUp >= flaggedStepUpBps ? `Renewal exceeds the first-year price by ${formatBps(stepUp)} (warning at ${markupThresholdPercent}%)` : undefined}
                          className={`px-1.5 py-0.5 rounded text-caption-xs text-[11px] font-medium ${
                            stepUp >= flaggedStepUpBps
                              ? 'bg-rose-100 text-rose-800 font-bold'
                              : stepUp === 0
                                ? 'bg-secondary-container text-on-secondary-container font-semibold'
                                : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {stepUp === 0 ? 'Flat (0%)' : formatBps(stepUp)}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-unit-sm py-1.5">
                      <span
                        title={status.detail ?? undefined}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-caption-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>

                    {/* Price basis */}
                    <td className="px-unit-md py-1.5 text-right">
                      {basis ? (
                        <span
                          title={basis.title}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${basis.className}`}
                        >
                          {basis.label}
                        </span>
                      ) : (
                        <span className="text-outline">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {results.some((result) => result.pricingNature === 'INDICATIVE') && (
        <p className="px-unit-base py-unit-xs border-t border-surface-container/60 font-caption-xs text-caption-xs text-amber-800 bg-amber-50/40">
          <strong>ind. / Indicative:</strong> GoDaddy documents availability pricing as indicative;
          only a quote locks the price. Treat these figures as estimates.
        </p>
      )}
    </div>
  );
};
