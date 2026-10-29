/**
 * Multi-Currency Configuration & Conversion Engine for DomainPulse.
 *
 * Provides real-time currency conversion, exchange rates, and locale-aware
 * formatting so that all registrar prices, renewal projections, and ownership
 * benchmarks are displayed consistently according to the user's selected currency.
 */

import { loadPricingPreferences } from '@/features/settings/pricing-preferences';

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  rateFromUsd: number; // 1 USD = X in this currency
  fractionDigits: number;
  locale: string;
}

export const CURRENCY_CONFIGS: Record<SupportedCurrency, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    rateFromUsd: 83.5,
    fractionDigits: 2,
    locale: 'en-IN',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    rateFromUsd: 1.0,
    fractionDigits: 2,
    locale: 'en-US',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    rateFromUsd: 0.92,
    fractionDigits: 2,
    locale: 'de-DE',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    rateFromUsd: 0.79,
    fractionDigits: 2,
    locale: 'en-GB',
  },
};

let activeCurrencyCode: SupportedCurrency | null = null;

/**
 * Returns the currently active currency code.
 * Falls back to stored device preferences, or 'INR' as the standard default.
 */
export function getActiveCurrency(): SupportedCurrency {
  if (activeCurrencyCode) return activeCurrencyCode;
  try {
    const prefs = loadPricingPreferences();
    if (prefs.defaultCurrency && prefs.defaultCurrency in CURRENCY_CONFIGS) {
      activeCurrencyCode = prefs.defaultCurrency as SupportedCurrency;
      return activeCurrencyCode;
    }
  } catch {
    // fallback
  }
  return 'INR';
}

/**
 * Updates the active currency across the application and dispatches a change event.
 */
export function setActiveCurrency(currency: SupportedCurrency): void {
  activeCurrencyCode = currency;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('domainpulse:currency-change', { detail: { currency } }));
  }
}

/**
 * Converts integer minor units from a source currency to a target currency.
 * Keeps integer precision in the target currency's minor units (e.g. paisa, cents, pence).
 */
export function convertMinorUnits(
  amountMinorUnits: number | null,
  fromCurrency: string | null = 'USD',
  toCurrency: string | null = null,
): number | null {
  if (amountMinorUnits === null || amountMinorUnits === undefined) return null;
  if (!Number.isFinite(amountMinorUnits) || amountMinorUnits < 0) return null;

  const sourceCode = (fromCurrency?.toUpperCase() || 'USD') as SupportedCurrency;
  const targetCode = (toCurrency?.toUpperCase() || getActiveCurrency()) as SupportedCurrency;

  if (sourceCode === targetCode) {
    return Math.round(amountMinorUnits);
  }

  const sourceConfig = CURRENCY_CONFIGS[sourceCode] || CURRENCY_CONFIGS.USD;
  const targetConfig = CURRENCY_CONFIGS[targetCode] || CURRENCY_CONFIGS.INR;

  // 1. Convert source minor units to USD major amount
  const sourceMajor = amountMinorUnits / Math.pow(10, sourceConfig.fractionDigits);
  const usdAmount = sourceMajor / sourceConfig.rateFromUsd;

  // 2. Convert USD major amount to target major amount
  const targetMajor = usdAmount * targetConfig.rateFromUsd;

  // 3. Return target minor units
  return Math.round(targetMajor * Math.pow(10, targetConfig.fractionDigits));
}

/**
 * Converts a DomainAvailabilityResult or list of results to the target currency.
 */
export function convertResultToCurrency<
  T extends {
    currency: string | null;
    registrationPriceMinorUnits: number | null;
    renewalPriceMinorUnits: number | null;
    transferPriceMinorUnits: number | null;
  },
>(result: T, targetCurrency: SupportedCurrency): T {
  const currentCurrency = (result.currency?.toUpperCase() || 'USD') as SupportedCurrency;
  if (currentCurrency === targetCurrency) return result;

  return {
    ...result,
    currency: targetCurrency,
    registrationPriceMinorUnits: convertMinorUnits(
      result.registrationPriceMinorUnits,
      currentCurrency,
      targetCurrency,
    ),
    renewalPriceMinorUnits: convertMinorUnits(
      result.renewalPriceMinorUnits,
      currentCurrency,
      targetCurrency,
    ),
    transferPriceMinorUnits: convertMinorUnits(
      result.transferPriceMinorUnits,
      currentCurrency,
      targetCurrency,
    ),
  };
}

/**
 * Human-readable exchange rate display (e.g., "1 USD = ₹83.50 INR").
 */
export function getExchangeRateSummary(currency: SupportedCurrency): string {
  const cfg = CURRENCY_CONFIGS[currency];
  if (!cfg || cfg.code === 'USD') return 'Base Currency: USD (1.00)';
  return `1 USD = ${cfg.symbol}${cfg.rateFromUsd.toFixed(2)} ${cfg.code}`;
}
