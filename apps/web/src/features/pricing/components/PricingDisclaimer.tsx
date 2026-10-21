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
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          <strong className="font-label-md text-on-surface">Live registrar pricing:</strong>{' '}
          Prices are fetched in real time from each registrar&apos;s official API and shown in that
          registrar&apos;s own currency. Nothing is converted. GoDaddy prices are indicative until
          a quote locks them. Multi-year totals and savings comparisons are estimates from those
          returned prices. Taxes, promotions and fees can change the final price, so verify with
          the registrar before registering.
        </p>
      </div>
      <div className="flex items-center gap-unit-md shrink-0 ml-unit-base">
        <button
          onClick={() => setIsDismissed(true)}
          className="text-on-surface-variant hover:text-on-surface flex items-center justify-center p-unit-2xs rounded hover:bg-surface-container transition-colors cursor-pointer"
          title="Dismiss notice"
          aria-label="Dismiss notice"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};
