import type { HorizonYears, PricingSortOption } from '@/features/pricing';
import type { PricingCurrencySettings } from './settings.types';
import { DEFAULT_SETTINGS } from './settings.reference';

/**
 * Device-level persistence for Pricing & Currency display preferences.
 *
 * There is deliberately no `/settings/pricing` backend endpoint: these values
 * only change how live registrar prices are displayed (default horizon/sort,
 * visible columns, markup flag threshold, preferred currency label). Live
 * prices themselves always come from the registrar APIs in each provider's
 * own currency -- there is no FX source, so nothing here converts currencies.
 */

const STORAGE_KEY = 'domainpulse.pricing-preferences';

export interface PricingVisibleColumns {
  registration: boolean;
  renewal: boolean;
  transfer: boolean;
}

export function defaultPricingPreferences(): PricingCurrencySettings {
  return { ...DEFAULT_SETTINGS.pricing };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStored(raw: string | null): PricingCurrencySettings {
  const fallback = defaultPricingPreferences();
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    return {
      defaultCurrency:
        typeof parsed.defaultCurrency === 'string' && parsed.defaultCurrency.length > 0
          ? parsed.defaultCurrency
          : fallback.defaultCurrency,
      pricingMode: 'live-registrar-apis',
      defaultPricingHorizon:
        parsed.defaultPricingHorizon === '1-year' ||
        parsed.defaultPricingHorizon === '3-years' ||
        parsed.defaultPricingHorizon === '5-years'
          ? parsed.defaultPricingHorizon
          : fallback.defaultPricingHorizon,
      defaultComparisonSort:
        parsed.defaultComparisonSort === 'best-value' ||
        parsed.defaultComparisonSort === 'lowest-renewal' ||
        parsed.defaultComparisonSort === 'lowest-first-year'
          ? parsed.defaultComparisonSort
          : fallback.defaultComparisonSort,
      renewalMarkupThreshold:
        typeof parsed.renewalMarkupThreshold === 'number' &&
        Number.isFinite(parsed.renewalMarkupThreshold) &&
        parsed.renewalMarkupThreshold >= 0
          ? Math.round(parsed.renewalMarkupThreshold)
          : fallback.renewalMarkupThreshold,
      showRegistrationPriceColumn:
        typeof parsed.showRegistrationPriceColumn === 'boolean'
          ? parsed.showRegistrationPriceColumn
          : fallback.showRegistrationPriceColumn,
      showRenewalPriceColumn:
        typeof parsed.showRenewalPriceColumn === 'boolean'
          ? parsed.showRenewalPriceColumn
          : fallback.showRenewalPriceColumn,
      showTransferPriceColumn:
        typeof parsed.showTransferPriceColumn === 'boolean'
          ? parsed.showTransferPriceColumn
          : fallback.showTransferPriceColumn,
    };
  } catch {
    return fallback;
  }
}

export function loadPricingPreferences(): PricingCurrencySettings {
  try {
    return parseStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultPricingPreferences();
  }
}

export function savePricingPreferences(prefs: PricingCurrencySettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  if (prefs.defaultCurrency && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('domainpulse:currency-change', {
        detail: { currency: prefs.defaultCurrency },
      }),
    );
  }
}

/** Settings horizon label -> OwnershipCostBenchmark years. */
export function horizonYearsOf(prefs: Pick<PricingCurrencySettings, 'defaultPricingHorizon'>): HorizonYears {
  switch (prefs.defaultPricingHorizon) {
    case '1-year':
      return 1;
    case '3-years':
      return 3;
    case '5-years':
    default:
      return 5;
  }
}

/**
 * Settings sort -> live comparison sort. `best-value` ranks by the 5-year
 * ownership total (registration + 4 renewals) within each currency.
 */
export function sortOptionOf(prefs: Pick<PricingCurrencySettings, 'defaultComparisonSort'>): PricingSortOption {
  switch (prefs.defaultComparisonSort) {
    case 'lowest-renewal':
      return 'lowest-renewal';
    case 'lowest-first-year':
      return 'lowest-first-year';
    case 'best-value':
    default:
      return 'lowest-5yr';
  }
}

export function visibleColumnsOf(prefs: Pick<PricingCurrencySettings, 'showRegistrationPriceColumn' | 'showRenewalPriceColumn' | 'showTransferPriceColumn'>): PricingVisibleColumns {
  const columns = {
    registration: prefs.showRegistrationPriceColumn,
    renewal: prefs.showRenewalPriceColumn,
    transfer: prefs.showTransferPriceColumn,
  };
  // Never hide every price column -- fall back to showing all three.
  if (!columns.registration && !columns.renewal && !columns.transfer) {
    return { registration: true, renewal: true, transfer: true };
  }
  return columns;
}
