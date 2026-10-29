import React from 'react';
import { PricingCurrencySettings } from '../../settings.types';
import { CURRENCY_OPTIONS } from '../../settings.reference';
import {
  CURRENCY_CONFIGS,
  SupportedCurrency,
  convertMinorUnits,
  getExchangeRateSummary,
  setActiveCurrency,
} from '@/lib/currency';
import { formatMinorUnits } from '@/api/domain-search';

interface PricingTabProps {
  settings: PricingCurrencySettings;
  onChange: (updated: Partial<PricingCurrencySettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

const SAMPLE_TLD_QUOTES = [
  { tld: '.com', provider: 'Cloudflare', baseUsdMinor: 1044, renewalUsdMinor: 1044 },
  { tld: '.com', provider: 'Hostinger', baseUsdMinor: 999, renewalUsdMinor: 1599 },
  { tld: '.in', provider: 'Hostinger', baseUsdMinor: 499, renewalUsdMinor: 999 },
  { tld: '.in', provider: 'Cloudflare', baseUsdMinor: 950, renewalUsdMinor: 950 },
  { tld: '.co.in', provider: 'Hostinger', baseUsdMinor: 399, renewalUsdMinor: 899 },
  { tld: '.ai', provider: 'Cloudflare', baseUsdMinor: 7000, renewalUsdMinor: 7000 },
];

export const PricingTab: React.FC<PricingTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  const activeCurrency = (settings.defaultCurrency in CURRENCY_CONFIGS
    ? settings.defaultCurrency
    : 'INR') as SupportedCurrency;
  const currentConfig = CURRENCY_CONFIGS[activeCurrency] || CURRENCY_CONFIGS.INR;
  const rateSummary = getExchangeRateSummary(activeCurrency);

  const handleCurrencySelect = (code: string) => {
    onChange({ defaultCurrency: code });
    if (code in CURRENCY_CONFIGS) {
      setActiveCurrency(code as SupportedCurrency);
    }
  };

  const handleSave = () => {
    if (settings.defaultCurrency in CURRENCY_CONFIGS) {
      setActiveCurrency(settings.defaultCurrency as SupportedCurrency);
    }
    onSave();
  };

  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Pricing &amp; Currency Preferences
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-mono border border-outline-variant/30">
              <span>Pricing Source: Live Registrar APIs</span>
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Price display formats, exchange rate conversion, projection horizons, markup thresholds, and registrar comparison rules.
          </p>
        </div>

        <div className="flex flex-col gap-unit-md mt-unit-md">
          {/* Default Display Currency */}
          <div className="flex flex-col gap-unit-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Default Display Currency
              </label>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-caption-xs text-caption-xs font-semibold">
                <span className="material-symbols-outlined text-[14px]">currency_exchange</span>
                <span>Active: {currentConfig.code} ({currentConfig.symbol})</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CURRENCY_OPTIONS.map((c) => {
                const isSelected = settings.defaultCurrency === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCurrencySelect(c.code)}
                    className={`py-2 px-3 rounded-lg font-label-md text-label-md cursor-pointer transition-all border flex items-center justify-between ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold border-primary/50 shadow-sm'
                        : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span>{c.code} ({c.symbol})</span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-container-low/70 border border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">sync_alt</span>
                <span className="font-label-mono text-label-mono text-on-surface font-semibold text-xs">
                  {rateSummary}
                </span>
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Prices across Find Domain and Price Comparison are converted to {currentConfig.name} ({currentConfig.code}).
              </span>
            </div>
          </div>

          {/* Real-time Pricing Preview Card */}
          <div className="p-3.5 rounded-xl bg-surface-container-low/60 border border-outline-variant/30 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">visibility</span>
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Live Price Display Preview in {currentConfig.code}
                </span>
              </div>
              <span className="text-[11px] font-mono text-secondary px-2 py-0.5 rounded bg-surface-container">
                1 USD = {currentConfig.symbol}{currentConfig.rateFromUsd.toFixed(2)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-body-sm text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-secondary font-mono">
                    <th className="py-1.5 px-2">Extension</th>
                    <th className="py-1.5 px-2">Registrar</th>
                    <th className="py-1.5 px-2">1st Year Registration</th>
                    <th className="py-1.5 px-2">Annual Renewal</th>
                    <th className="py-1.5 px-2 text-right">Wholesale Base</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/15 font-mono">
                  {SAMPLE_TLD_QUOTES.map((row, idx) => {
                    const regConverted = convertMinorUnits(row.baseUsdMinor, 'USD', activeCurrency);
                    const renConverted = convertMinorUnits(row.renewalUsdMinor, 'USD', activeCurrency);
                    const regFormatted = formatMinorUnits(regConverted, activeCurrency);
                    const renFormatted = formatMinorUnits(renConverted, activeCurrency);
                    const baseUsdFormatted = formatMinorUnits(row.baseUsdMinor, 'USD');

                    return (
                      <tr key={idx} className="hover:bg-surface-container/40 transition-colors">
                        <td className="py-1.5 px-2 font-semibold text-primary">{row.tld}</td>
                        <td className="py-1.5 px-2 text-on-surface">{row.provider}</td>
                        <td className="py-1.5 px-2 font-bold text-on-surface">{regFormatted}/yr</td>
                        <td className="py-1.5 px-2 text-secondary">{renFormatted}/yr</td>
                        <td className="py-1.5 px-2 text-right text-outline">{baseUsdFormatted}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Horizon & Default Comparison Sort */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md pt-unit-xs">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Default Pricing Horizon
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '1-year', label: '1 Year' },
                  { value: '3-years', label: '3 Years' },
                  { value: '5-years', label: '5 Years' },
                ].map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => onChange({ defaultPricingHorizon: h.value as any })}
                    className={`p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-center border cursor-pointer transition-colors ${
                      settings.defaultPricingHorizon === h.value
                        ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                        : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
                    }`}
                  >
                    <span>{h.label}</span>
                  </button>
                ))}
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Long-term projection span used for multi-year cost estimates.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Default Comparison Sort
              </label>
              <select
                value={settings.defaultComparisonSort}
                onChange={(e) =>
                  onChange({
                    defaultComparisonSort: e.target.value as any,
                  })
                }
                className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro cursor-pointer"
              >
                <option value="best-value">Best Long-Term Value</option>
                <option value="lowest-renewal">Lowest Renewal Price</option>
                <option value="lowest-first-year">Lowest Initial Registration</option>
              </select>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Initial sort order when opening registrar price comparison tables.
              </span>
            </div>
          </div>

          {/* DNSSEC fee inclusion */}
          <div className="flex items-center justify-between gap-unit-sm p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20 opacity-70">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Include DNSSEC
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                DNS security extensions pricing in total cost calculations.
              </span>
            </div>
            <span className="inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-surface-container text-secondary">
              Coming soon
            </span>
          </div>

          {/* Comparison Table Columns */}
          <div className="flex flex-col gap-unit-xs pt-unit-xs">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Comparison Table Visible Columns
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showRegistrationPriceColumn}
                  onChange={(e) =>
                    onChange({ showRegistrationPriceColumn: e.target.checked })
                  }
                  className="rounded text-primary accent-primary w-4 h-4"
                />
                <span className="font-label-md text-label-md text-on-surface">
                  Registration Price
                </span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showRenewalPriceColumn}
                  onChange={(e) =>
                    onChange({ showRenewalPriceColumn: e.target.checked })
                  }
                  className="rounded text-primary accent-primary w-4 h-4"
                />
                <span className="font-label-md text-label-md text-on-surface">
                  Renewal Price
                </span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showTransferPriceColumn}
                  onChange={(e) =>
                    onChange({ showTransferPriceColumn: e.target.checked })
                  }
                  className="rounded text-primary accent-primary w-4 h-4"
                />
                <span className="font-label-md text-label-md text-on-surface">
                  Transfer Price
                </span>
              </label>
            </div>
          </div>

          {/* Renewal Markup Warning Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Renewal Markup Warning Trigger
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Flags registrars whose renewal rates exceed first-year registration fee by this percentage.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings.renewalMarkupThreshold}
                onChange={(e) =>
                  onChange({
                    renewalMarkupThreshold: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="w-16 h-8 text-center rounded bg-surface-container-lowest text-on-surface font-label-mono text-label-mono font-medium border border-outline-variant/40 shadow-micro"
                min={0}
              />
              <span className="font-label-md text-label-md text-secondary font-mono">%</span>
            </div>
          </div>

          {/* Pricing Disclosure Notice */}
          <div className="p-unit-md rounded-xl bg-surface-container-high/40 border border-outline-variant/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-tertiary shrink-0 mt-0.5">
              info
            </span>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Pricing Notice
              </span>
              <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                Domain availability and pricing are retrieved from supported registrar APIs. Pricing may be indicative or current depending on the provider and may change at checkout. Purchases, billing, and automatic renewals are handled directly by the registrar.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-unit-lg pt-unit-md border-t border-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Pricing Settings'}
          </button>
        </div>
      </div>
    </section>
  );
};
