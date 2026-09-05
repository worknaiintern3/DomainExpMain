import React from 'react';
import { PricingMode } from '../pricing.types';

interface PricingHeaderProps {
  mode: PricingMode;
  onModeChange: (mode: PricingMode) => void;
  savedCount: number;
  onOpenSaved: () => void;
  onOpenMethodology: () => void;
}

export const PricingHeader: React.FC<PricingHeaderProps> = ({
  mode,
  onModeChange,
  savedCount,
  onOpenSaved,
  onOpenMethodology,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-unit-base pb-unit-xs">
      {/* Title & Subtitle */}
      <div className="flex flex-col">
        <div className="flex items-center gap-unit-sm">
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
            Price Comparison
          </h1>
          <span className="px-unit-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-caption-xs text-caption-xs font-semibold uppercase tracking-wider">
            PRICING INTELLIGENCE
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
          Compare registration, renewal and transfer pricing across registrars using stored or reference pricing datasets.
        </p>
      </div>

      {/* Right Side Actions & Mode Switcher */}
      <div className="flex flex-wrap items-center gap-unit-sm">
        {/* Saved Comparisons button */}
        <button
          onClick={onOpenSaved}
          type="button"
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container shadow-micro transition-colors border border-outline-variant/30 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">bookmark</span>
          <span>Saved Comparisons ({savedCount})</span>
        </button>

        {/* Methodology button */}
        <button
          onClick={onOpenMethodology}
          type="button"
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container shadow-micro transition-colors border border-outline-variant/30 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">balance</span>
          <span>Methodology</span>
        </button>

        {/* Segmented Mode Switcher */}
        <div className="flex items-center p-1 bg-surface-container rounded-lg shadow-inner border border-outline-variant/20">
          <button
            type="button"
            onClick={() => onModeChange('registrars')}
            className={`h-7 px-unit-md rounded-md font-label-md text-label-md transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === 'registrars'
                ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">domain</span>
            <span>Domain Registrars</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('hosting')}
            className={`h-7 px-unit-md rounded-md font-label-md text-label-md transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === 'hosting'
                ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">dns</span>
            <span>Hosting Providers</span>
          </button>
        </div>
      </div>
    </div>
  );
};
