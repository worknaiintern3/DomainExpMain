import React, { useState } from 'react';
import { calculateTransferSavings } from '../pricing.reference';

export const TransferSavingsCalculator: React.FC = () => {
  const [currentRate, setCurrentRate] = useState<number>(1499);
  const [targetRate, setTargetRate] = useState<number>(899);
  const [domainCount, setDomainCount] = useState<number>(12);
  const [guideModalOpen, setGuideModalOpen] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<boolean>(false);

  const calc = calculateTransferSavings(currentRate, targetRate, domainCount);

  const handleExportCsv = () => {
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 2500);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Metric,Value\n' +
      `Number of Domains,${domainCount}\n` +
      `Current Annual Renewal Rate (INR),${currentRate}\n` +
      `Target Annual Renewal Rate (INR),${targetRate}\n` +
      `Current Annual Total (INR),${calc.currentAnnual}\n` +
      `Projected Annual Total (INR),${calc.projectedAnnual}\n` +
      `Estimated Annual Savings (INR),${calc.annualSavings}\n` +
      `Estimated 3-Year Savings (INR),${calc.threeYearSavings}\n` +
      `Estimated Savings Percentage,${calc.percentSavings}%\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `domainpulse_transfer_savings_${domainCount}_domains.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-unit-base rounded-lg bg-surface-container-lowest shadow-micro border border-outline-variant/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm mb-unit-base">
        <div className="flex items-center gap-unit-sm">
          <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">calculate</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Transfer Savings Calculator
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary">
              Estimate portfolio consolidation savings using reference renewal pricing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-unit-sm flex-wrap">
          {exportNotice && (
            <span className="text-caption-xs text-emerald-700 font-semibold animate-pulse">
              Exported CSV!
            </span>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-8 px-unit-sm rounded bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high flex items-center gap-1 transition-colors cursor-pointer border border-outline-variant/20"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Transfer Plan (CSV)</span>
          </button>
          <button
            type="button"
            onClick={() => setGuideModalOpen(true)}
            className="h-8 px-unit-sm rounded bg-surface-container text-primary font-label-md text-label-md hover:bg-surface-container-high flex items-center gap-1 transition-colors cursor-pointer border border-outline-variant/20"
          >
            <span>Step-by-step Guide</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg items-center">
        {/* Input Deck (5 cols) */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-unit-sm">
          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs text-secondary font-medium">
              Current Registrar
            </label>
            <select
              value={currentRate}
              onChange={(e) => setCurrentRate(Number(e.target.value))}
              className="h-9 px-unit-sm rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
            >
              <option value="1499">GoDaddy (₹1,499/yr)</option>
              <option value="1650">Squarespace (₹1,650/yr)</option>
              <option value="1299">Hostinger (₹1,299/yr)</option>
              <option value="1099">Namecheap (₹1,099/yr)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs text-secondary font-medium">
              Current Renewal Price
            </label>
            <div className="h-9 px-unit-sm rounded bg-surface-container flex items-center font-label-mono text-label-mono text-rose-700 font-bold border border-outline-variant/20">
              ₹{currentRate.toLocaleString('en-IN')} /yr
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs text-secondary font-medium">
              Target Registrar
            </label>
            <select
              value={targetRate}
              onChange={(e) => setTargetRate(Number(e.target.value))}
              className="h-9 px-unit-sm rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
            >
              <option value="899">Cloudflare (₹899/yr)</option>
              <option value="950">Porkbun (₹950/yr)</option>
              <option value="999">Dynadot (₹999/yr)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs text-secondary font-medium">
              Target Renewal Price
            </label>
            <div className="h-9 px-unit-sm rounded bg-surface-container flex items-center font-label-mono text-label-mono text-primary font-bold border border-outline-variant/20">
              ₹{targetRate.toLocaleString('en-IN')} /yr
            </div>
          </div>

          <div className="col-span-2 flex flex-col gap-1 mt-1">
            <div className="flex items-center justify-between">
              <label className="font-caption-xs text-caption-xs text-secondary font-medium">
                Number of Domains to Transfer
              </label>
              <span className="font-label-mono text-label-mono font-bold text-primary">
                {domainCount} domains
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={domainCount}
              onChange={(e) => setDomainCount(Number(e.target.value))}
              className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex items-center justify-between text-caption-xs font-caption-xs text-secondary select-none">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Results Output Deck (7 cols) */}
        <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-unit-sm p-unit-base rounded-lg bg-surface-container-low border border-outline-variant/20">
          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
              Current Annual
            </span>
            <span className="font-headline-sm text-headline-sm font-label-mono text-rose-700 font-bold mt-1">
              {calc.currentAnnualFormatted}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Without transfers
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
              Projected Annual
            </span>
            <span className="font-headline-sm text-headline-sm font-label-mono text-primary font-bold mt-1">
              {calc.projectedAnnualFormatted}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary">
              At wholesale rate
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
              Estimated Annual Savings
            </span>
            <span className="font-headline-sm text-headline-sm font-label-mono text-primary font-bold mt-1">
              {calc.annualSavingsFormatted}
            </span>
            <span className="font-caption-xs text-caption-xs text-emerald-700 font-semibold">
              {calc.percentSavings}% Cost Drop
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
              Estimated 3-Year Savings
            </span>
            <span className="font-headline-sm text-headline-sm font-label-mono text-on-surface font-bold mt-1">
              {calc.threeYearSavingsFormatted}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Total Net Saved
            </span>
          </div>
        </div>
      </div>

      <div className="mt-unit-sm pt-unit-xs text-caption-xs font-caption-xs text-secondary border-t border-surface-container/60">
        Note: Estimated reference savings. Actual savings may differ due to taxes, promotions, transfer fees and future pricing changes.
      </div>

      {/* Guide Modal */}
      {guideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-unit-lg shadow-xl border border-outline-variant/30 flex flex-col gap-unit-md">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Domain Transfer Step-by-Step Guide
              </h3>
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                className="p-1 rounded text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-unit-sm text-body-sm text-secondary">
              <div className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <span><strong>Unlock Domain:</strong> Disable the registrar transfer lock in your current provider portal.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <span><strong>Obtain Auth Code (EPP):</strong> Request your transfer authorization key from the current registrar.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <span><strong>Initiate at Destination:</strong> Enter the domain name and auth code at the target registrar.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">4.</span>
                <span><strong>Preserve DNS:</strong> Ensure your nameservers remain pointing to Cloudflare/Cloud DNS during the 5-day transfer window.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGuideModalOpen(false)}
              className="mt-2 h-9 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-tertiary transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
