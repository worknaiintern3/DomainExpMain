import React from 'react';
import { PricingCurrencySettings } from '../../settings.types';
import { CURRENCY_OPTIONS } from '../../settings.reference';

interface PricingTabProps {
  settings: PricingCurrencySettings;
  onChange: (updated: Partial<PricingCurrencySettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const PricingTab: React.FC<PricingTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Pricing &amp; Currency Preferences
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-mono border border-outline-variant/30">
              <span>Pricing Mode: Reference Dataset</span>
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Price display formats, projection horizons, markup thresholds, and registrar comparison rules.
          </p>
        </div>

        <div className="flex flex-col gap-unit-md mt-unit-md">
          {/* Default Display Currency */}
          <div className="flex flex-col gap-unit-xs">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Default Display Currency
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CURRENCY_OPTIONS.map((c) => {
                const isSelected = settings.defaultCurrency === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onChange({ defaultCurrency: c.code })}
                    className={`py-2 rounded-lg font-label-md text-label-md cursor-pointer transition-colors border ${
                      isSelected
                        ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                        : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span>{c.code} ({c.symbol})</span>
                  </button>
                );
              })}
            </div>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Applied to valuation dashboards, renewal forecasting, and benchmark matrix views.
            </span>
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

          {/* Feature Addon Inclusions (WHOIS Privacy & DNSSEC) */}
          <div className="space-y-unit-sm pt-unit-xs">
            <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Include WHOIS Privacy
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Include privacy protection fee in comparison benchmarks when charged separately.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.includeWhoisPrivacy}
                  onChange={(e) => onChange({ includeWhoisPrivacy: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 peer-checked:bg-primary transition-all"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Include DNSSEC
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Include DNS security extensions pricing in total cost calculations.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.includeDnssec}
                  onChange={(e) => onChange({ includeDnssec: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 peer-checked:bg-primary transition-all"></div>
              </label>
            </div>
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
                    renewalMarkupThreshold: parseInt(e.target.value, 10) || 50,
                  })
                }
                className="w-16 h-8 text-center rounded bg-surface-container-lowest text-on-surface font-label-mono text-label-mono font-medium border border-outline-variant/40 shadow-micro"
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
                Pricing Reference Notice
              </span>
              <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                Pricing shown in the demo is stored/reference data unless a provider integration supplies current pricing.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-unit-lg pt-unit-md border-t border-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={onSave}
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
