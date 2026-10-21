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
          <span className="px-unit-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-caption-xs text-caption-xs font-semibold uppercase tracking-wider">
            LIVE REGISTRAR PRICING
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
          Compare live registration, renewal and transfer pricing returned by registrar APIs for a
          domain. Only prices a registrar actually returns are shown.
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
