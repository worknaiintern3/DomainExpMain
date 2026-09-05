import React from 'react';
import { Link } from 'react-router-dom';
import { RegistrarPriceQuote } from '../findDomain.types';

interface RegistrarPriceCardsProps {
  domain: string;
  isAvailable: boolean;
  quotes: RegistrarPriceQuote[];
}

export const RegistrarPriceCards: React.FC<RegistrarPriceCardsProps> = ({
  domain,
  isAvailable,
  quotes,
}) => {
  const lowestQuote = quotes.reduce((min, curr) =>
    curr.firstYearPrice < min.firstYearPrice ? curr : min
  );

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
              {isAvailable ? 'Available' : 'Registered'}
            </span>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
            Registrar Multi-Channel Price Matrix (Reference Dataset)
          </span>
        </div>
        <span className="material-symbols-outlined text-[20px] text-primary">price_change</span>
      </div>

      {/* Highlight Badges */}
      <div className="grid grid-cols-2 gap-unit-xs">
        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-900 font-caption-xs text-caption-xs flex flex-col border border-emerald-200/40">
          <span className="text-emerald-700 text-[10px] uppercase font-bold tracking-wider">
            Lowest 1st-Year
          </span>
          <span className="font-bold text-body-md font-label-mono text-emerald-800">
            {lowestQuote.firstYearFormatted}{' '}
            <span className="text-[11px] font-sans font-normal">({lowestQuote.registrarName})</span>
          </span>
        </div>
        <div className="p-2 rounded-lg bg-blue-50 text-blue-900 font-caption-xs text-caption-xs flex flex-col border border-blue-200/40">
          <span className="text-blue-700 text-[10px] uppercase font-bold tracking-wider">
            Best Renewal Model
          </span>
          <span className="font-bold text-body-md font-label-mono text-blue-800">
            ₹899{' '}
            <span className="text-[11px] font-sans font-normal">(Namecheap)</span>
          </span>
        </div>
      </div>

      {/* Comparative Rates List */}
      <div className="flex flex-col gap-1 font-caption-xs text-caption-xs">
        {quotes.map((q) => (
          <div
            key={q.id}
            className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors border border-outline-variant/20"
          >
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-semibold text-on-surface">{q.registrarName}</span>
                {q.tag && (
                  <span
                    className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                      q.tagColor || 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {q.tag}
                  </span>
                )}
              </div>
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

      {/* Footnote Disclaimer */}
      <p className="font-caption-xs text-caption-xs text-secondary italic">
        *Reference/demo pricing. Actual registrar pricing may vary. DomainPulse is an independent intelligence suite and does not sell domains directly.
      </p>
    </div>
  );
};
