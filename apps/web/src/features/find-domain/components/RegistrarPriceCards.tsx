import React from 'react';
import { Link } from 'react-router-dom';

import {
  AVAILABILITY_PROVIDER_LABELS,
  formatMinorUnits,
  type DomainAvailabilityResult,
} from '@/api/domain-search';

interface RegistrarPriceCardsProps {
  domain: string;
  isAvailable: boolean;
  results: DomainAvailabilityResult[];
}

interface LiveQuote {
  id: string;
  registrarName: string;
  featureNote: string;
  firstYearPriceMinorUnits: number;
  firstYearFormatted: string;
  renewalFormatted: string;
}

function buildQuotes(results: DomainAvailabilityResult[]): LiveQuote[] {
  const quotes: LiveQuote[] = [];
  for (const result of results) {
    const firstYear = formatMinorUnits(result.registrationPriceMinorUnits, result.currency);
    if (firstYear === null || result.registrationPriceMinorUnits === null) continue;
    const renewal = formatMinorUnits(result.renewalPriceMinorUnits, result.currency);
    quotes.push({
      featureNote:
        result.state === 'PREMIUM' || result.premium
          ? 'Premium tier · live registry check'
          : 'Live registry check',
      firstYearFormatted: firstYear,
      firstYearPriceMinorUnits: result.registrationPriceMinorUnits,
      id: `reg-${result.provider}`,
      registrarName: AVAILABILITY_PROVIDER_LABELS[result.provider],
      renewalFormatted: renewal ? `Ren: ${renewal}` : 'Renewal unavailable',
    });
  }
  return quotes.sort((a, b) => a.firstYearPriceMinorUnits - b.firstYearPriceMinorUnits);
}

export const RegistrarPriceCards: React.FC<RegistrarPriceCardsProps> = ({
  domain,
  isAvailable,
  results,
}) => {
  const quotes = buildQuotes(results);
  const lowestQuote = quotes[0];

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-md flex flex-col gap-unit-md border border-outline-variant/30">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-unit-xs flex-wrap">
            <span className="font-headline-sm text-headline-sm text-on-surface font-label-mono truncate">
              {domain}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption-xs font-semibold ${
                isAvailable
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/50'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  isAvailable ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              ></span>
              {isAvailable ? 'Possibly available' : 'Likely registered'}
            </span>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
            {quotes.length > 0 ? 'Live registrar pricing rates' : 'Registrar pricing unavailable'}
          </span>
        </div>
        <span className="material-symbols-outlined text-[20px] text-primary">price_change</span>
      </div>

      {lowestQuote ? (
        <>
          {/* Highlight Badge */}
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-900 font-caption-xs text-caption-xs flex flex-col border border-emerald-200/40">
            <span className="text-emerald-700 text-[10px] uppercase font-bold tracking-wider">
              Lowest live 1st-Year
            </span>
            <span className="font-bold text-body-md font-label-mono text-emerald-800">
              {lowestQuote.firstYearFormatted}{' '}
              <span className="text-[11px] font-sans font-normal">({lowestQuote.registrarName})</span>
            </span>
          </div>

          {/* Comparative Rates List */}
          <div className="flex flex-col gap-1 font-caption-xs text-caption-xs">
            {quotes.map((q) => (
              <div
                key={q.id}
                className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors border border-outline-variant/20"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-on-surface">{q.registrarName}</span>
                  <span className="text-secondary text-[10px] truncate">{q.featureNote}</span>
                </div>

                <div className="flex items-center gap-unit-sm shrink-0">
                  <div className="text-right">
                    <div className="font-label-mono font-bold text-on-surface">
                      {q.firstYearFormatted}
                    </div>
                    <div className="text-secondary font-label-mono text-[10px]">
                      {q.renewalFormatted}
                    </div>
                  </div>
                  <Link
                    to={`/pricing?domain=${encodeURIComponent(domain)}`}
                    className="h-6 px-2 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface font-medium transition-colors flex items-center justify-center text-[11px]"
                  >
                    Compare
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="font-caption-xs text-caption-xs text-secondary rounded-lg bg-surface-container-low p-unit-sm border border-outline-variant/20">
          No registrar prices are available from this backend. The availability result is an
          estimate; confirm both availability and price with a registrar.
        </p>
      )}

      {/* Footnote Disclaimer */}
      <p className="font-caption-xs text-caption-xs text-secondary italic">
        Availability may use a DNS fallback. DomainPulse does not sell domains directly.
      </p>
    </div>
  );
};
