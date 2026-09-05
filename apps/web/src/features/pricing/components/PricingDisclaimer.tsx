import React, { useState } from 'react';

export const PricingDisclaimer: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="flex items-center justify-between px-unit-base py-unit-sm rounded-lg bg-surface-container-low text-on-surface shadow-micro border border-outline-variant/30">
      <div className="flex items-center gap-unit-sm min-w-0">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
          info
        </span>
        <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
          <strong className="font-label-md text-on-surface">Reference Data:</strong>{' '}
          Pricing shown in this workspace is stored/reference data unless a future provider integration supplies current rates. Registrar pricing, taxes, promotions and renewal terms may change. Verify final pricing directly with the provider.
        </p>
      </div>
      <div className="flex items-center gap-unit-md shrink-0 ml-unit-base">
        <span className="font-caption-xs text-caption-xs text-secondary whitespace-nowrap hidden sm:inline">
          Reference Dataset: Benchmark Prototype Data • Currency: INR (₹)
        </span>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-on-surface-variant hover:text-on-surface flex items-center justify-center p-unit-2xs rounded hover:bg-surface-container transition-colors cursor-pointer"
          title="Dismiss notice"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};
