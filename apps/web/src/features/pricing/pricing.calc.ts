import {
  AVAILABILITY_PROVIDER_LABELS,
  type DomainAvailabilityProvider,
  type DomainAvailabilityResult,
} from '@/api/domain-search';

import type {
  CurrencyLowest,
  HorizonYears,
  OwnershipCostItem,
  OwnershipSavings,
  PriceField,
  PricingSortOption,
  TransferSavingsCalculation,
} from './pricing.types';

/**
 * Pure helpers over the live normalized registrar results.
 *
 * Every price is an integer count of a currency's minor units. All
 * arithmetic here is integer-only (BigInt for ratios) and prices in
 * different currencies are NEVER combined, ranked against each other, or
 * converted: there is no FX source, so a cross-currency comparison would be
 * a guess. A `null` price stays null everywhere.
 */

/** Extension shortcuts that only help the user type a full domain name. */
export const PRICING_TLD_SHORTCUTS: readonly string[] = [
  '.com',
  '.net',
  '.org',
  '.io',
  '.co',
  '.dev',
  '.app',
  '.ai',
  '.in',
  '.co.in',
  '.tech',
];

const PRICED_STATES: ReadonlySet<DomainAvailabilityResult['state']> = new Set([
  'AVAILABLE',
  'PREMIUM',
]);

export function providerLabel(provider: DomainAvailabilityProvider): string {
  return AVAILABILITY_PROVIDER_LABELS[provider];
}

export function priceOf(result: DomainAvailabilityResult, field: PriceField): number | null {
  if (result.currency === null) return null;
  switch (field) {
    case 'registration':
      return result.registrationPriceMinorUnits;
    case 'renewal':
      return result.renewalPriceMinorUnits;
    case 'transfer':
      return result.transferPriceMinorUnits;
  }
}

export function hasAnyPrice(result: DomainAvailabilityResult): boolean {
  return (
    priceOf(result, 'registration') !== null ||
    priceOf(result, 'renewal') !== null ||
    priceOf(result, 'transfer') !== null
  );
}

/** Registration + (horizon - 1) renewals, or null unless both prices exist. */
export function totalCost(result: DomainAvailabilityResult, horizon: HorizonYears): number | null {
  const registration = priceOf(result, 'registration');
  const renewal = priceOf(result, 'renewal');
  if (registration === null || renewal === null) return null;
  const total = registration + (horizon - 1) * renewal;
  return Number.isSafeInteger(total) ? total : null;
}

function valueFor(result: DomainAvailabilityResult, sort: PricingSortOption): number | null {
  switch (sort) {
    case 'lowest-first-year':
      return priceOf(result, 'registration');
    case 'lowest-renewal':
      return priceOf(result, 'renewal');
    case 'lowest-transfer':
      return priceOf(result, 'transfer');
    case 'lowest-5yr':
      return totalCost(result, 5);
  }
}

/**
 * Orders providers by a price field. Results with no value sort last.
 * Values are only ranked within the same currency: different currencies are
 * grouped (alphabetically) rather than interleaved by their raw numbers.
 */
export function sortResults(
  results: readonly DomainAvailabilityResult[],
  sort: PricingSortOption,
): DomainAvailabilityResult[] {
  const provided = (r: DomainAvailabilityResult) => valueFor(r, sort) !== null;
  return [...results].sort((a, b) => {
    const aHas = provided(a);
    const bHas = provided(b);
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (!aHas) return providerLabel(a.provider).localeCompare(providerLabel(b.provider));
    const currencyOrder = (a.currency ?? '').localeCompare(b.currency ?? '');
    if (currencyOrder !== 0) return currencyOrder;
    return (valueFor(a, sort) ?? 0) - (valueFor(b, sort) ?? 0);
  });
}

/** Distinct currencies among results that returned a price, alphabetical. */
export function pricedCurrencies(results: readonly DomainAvailabilityResult[]): string[] {
  const currencies = new Set<string>();
  for (const result of results) {
    if (result.currency !== null && hasAnyPrice(result)) currencies.add(result.currency);
  }
  return [...currencies].sort();
}

/** Lowest value of a field per currency (ties list every provider). */
export function lowestByCurrency(
  results: readonly DomainAvailabilityResult[],
  field: PriceField,
): CurrencyLowest[] {
  const byCurrency = new Map<string, CurrencyLowest>();
  for (const result of results) {
    if (result.currency === null) continue;
    const value = priceOf(result, field);
    if (value === null) continue;
    const current = byCurrency.get(result.currency);
    if (current === undefined || value < current.minorUnits) {
      byCurrency.set(result.currency, {
        currency: result.currency,
        minorUnits: value,
        providers: [result.provider],
      });
    } else if (value === current.minorUnits) {
      current.providers.push(result.provider);
    }
  }
  return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Renewal step-up over the first-year price in basis points (integer),
 * or null unless both prices exist and registration is positive.
 */
export function renewalStepUpBps(result: DomainAvailabilityResult): number | null {
  const registration = priceOf(result, 'registration');
  const renewal = priceOf(result, 'renewal');
  if (registration === null || renewal === null || registration <= 0) return null;
  const bps = (BigInt(renewal - registration) * 10_000n) / BigInt(registration);
  return Number(bps);
}

/** "+91.7%" / "-12.0%" from integer basis points; integer arithmetic only. */
export function formatBps(bps: number): string {
  const absolute = Math.abs(bps);
  const whole = Math.trunc(absolute / 100);
  const tenths = Math.trunc((absolute % 100) / 10);
  return `${bps < 0 ? '-' : '+'}${whole}.${tenths}%`;
}

/** The largest renewal step-up among providers that returned both prices. */
export function largestStepUp(
  results: readonly DomainAvailabilityResult[],
): { provider: DomainAvailabilityProvider; bps: number } | null {
  let best: { provider: DomainAvailabilityProvider; bps: number } | null = null;
  for (const result of results) {
    const bps = renewalStepUpBps(result);
    if (bps !== null && (best === null || bps > best.bps)) {
      best = { bps, provider: result.provider };
    }
  }
  return best;
}

export function ownershipItems(
  results: readonly DomainAvailabilityResult[],
  horizon: HorizonYears,
): { items: OwnershipCostItem[]; excluded: DomainAvailabilityProvider[] } {
  const items: OwnershipCostItem[] = [];
  const excluded: DomainAvailabilityProvider[] = [];
  for (const result of results) {
    if (!PRICED_STATES.has(result.state)) continue;
    const total = totalCost(result, horizon);
    const registration = priceOf(result, 'registration');
    const renewal = priceOf(result, 'renewal');
    if (total === null || registration === null || renewal === null || result.currency === null) {
      excluded.push(result.provider);
      continue;
    }
    items.push({
      currency: result.currency,
      isLowestInCurrency: false,
      provider: result.provider,
      renewalMinorUnits: renewal,
      totalMinorUnits: total,
      year1MinorUnits: registration,
    });
  }
  const lowestPerCurrency = new Map<string, number>();
  for (const item of items) {
    const current = lowestPerCurrency.get(item.currency);
    if (current === undefined || item.totalMinorUnits < current) {
      lowestPerCurrency.set(item.currency, item.totalMinorUnits);
    }
  }
  const marked = items
    .map((item) => ({
      ...item,
      isLowestInCurrency: lowestPerCurrency.get(item.currency) === item.totalMinorUnits,
    }))
    .sort(
      (a, b) =>
        a.currency.localeCompare(b.currency) || a.totalMinorUnits - b.totalMinorUnits,
    );
  return { excluded, items: marked };
}

/** Cheapest-vs-dearest spread per currency; only where 2+ providers share it. */
export function ownershipSavings(items: readonly OwnershipCostItem[]): OwnershipSavings[] {
  const groups = new Map<string, number[]>();
  for (const item of items) {
    groups.set(item.currency, [...(groups.get(item.currency) ?? []), item.totalMinorUnits]);
  }
  const savings: OwnershipSavings[] = [];
  for (const [currency, totals] of groups) {
    if (totals.length < 2) continue;
    const highest = Math.max(...totals);
    const lowest = Math.min(...totals);
    const difference = highest - lowest;
    savings.push({
      currency,
      savingsMinorUnits: difference,
      savingsTenthsPercent:
        highest > 0 ? Number((BigInt(difference) * 1_000n) / BigInt(highest)) : 0,
    });
  }
  return savings.sort((a, b) => a.currency.localeCompare(b.currency));
}

/** "12.3%" from tenths of a percent. */
export function formatTenthsPercent(tenths: number): string {
  return `${Math.trunc(tenths / 10)}.${tenths % 10}%`;
}

/**
 * Annual renewal savings from consolidating `count` domains at a cheaper
 * registrar. Returns null when either rate is missing, the currencies
 * differ, or the arithmetic would leave the safe-integer range.
 */
export function calculateTransferSavings(
  current: DomainAvailabilityResult | undefined,
  target: DomainAvailabilityResult | undefined,
  count: number,
): TransferSavingsCalculation | null {
  if (current === undefined || target === undefined) return null;
  if (current.currency === null || current.currency !== target.currency) return null;
  const currentRate = priceOf(current, 'renewal');
  const targetRate = priceOf(target, 'renewal');
  if (currentRate === null || targetRate === null) return null;
  if (!Number.isInteger(count) || count < 1) return null;

  const currentAnnual = currentRate * count;
  const projectedAnnual = targetRate * count;
  const annualSavings = Math.max(0, currentAnnual - projectedAnnual);
  const threeYearSavings = annualSavings * 3;
  if (![currentAnnual, projectedAnnual, threeYearSavings].every(Number.isSafeInteger)) return null;
  return {
    annualSavingsMinorUnits: annualSavings,
    currentAnnualMinorUnits: currentAnnual,
    percentSavings:
      currentAnnual > 0 ? Number((BigInt(annualSavings) * 100n) / BigInt(currentAnnual)) : 0,
    projectedAnnualMinorUnits: projectedAnnual,
    threeYearSavingsMinorUnits: threeYearSavings,
  };
}

/** True when a provider answered definitively (not unconfigured / failed). */
export function isDefinitive(result: DomainAvailabilityResult): boolean {
  return (
    result.state === 'AVAILABLE' || result.state === 'PREMIUM' || result.state === 'UNAVAILABLE'
  );
}
