import React from 'react';

interface PricingHeaderProps {
  onOpenMethodology: () => void;
}

export const PricingHeader: React.FC<PricingHeaderProps> = ({ onOpenMethodology }) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-unit-base pb-unit-xs">
      {/* Title & Subtitle */}
      <div className="flex flex-col">
        <div className="flex items-center gap-unit-sm">
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
            Price Comparison
          </h1>
          <span className="px-unit-xs py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50 font-caption-xs text-caption-xs font-semibold uppercase tracking-wider">
            LIVE MARKET RATES
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
          Compare real-time registration, renewal, and transfer rates across leading registrars.
          Uncover multi-year total cost of ownership and transfer savings instantly.
        </p>
      </div>

      {/* Right Side Actions */}
      <div className="flex flex-wrap items-center gap-unit-sm">
        {/* Methodology button */}
        <button
          onClick={onOpenMethodology}
          type="button"
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container shadow-micro transition-colors border border-outline-variant/30 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">balance</span>
          <span>Methodology</span>
        </button>
      </div>
    </div>
  );
};
