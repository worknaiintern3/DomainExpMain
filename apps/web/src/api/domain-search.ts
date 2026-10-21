import { apiRequest } from './client';

export type DomainAvailabilityProvider = 'godaddy' | 'namecheap' | 'cloudflare';

export type DomainAvailabilityState =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'PREMIUM'
  | 'ERROR'
  | 'UNCONFIGURED';

/**
 * INDICATIVE: the provider documents the figure as non-binding (GoDaddy).
 * CURRENT: returned by the provider's official pricing API for this request.
 * UNKNOWN: no price was returned.
 */
export type PricingNature = 'INDICATIVE' | 'CURRENT' | 'UNKNOWN';

export interface DomainAvailabilityResult {
  provider: DomainAvailabilityProvider;
  domain: string;
  state: DomainAvailabilityState;
  available: boolean | null;
  definitive: boolean;
  currency: string | null;
  registrationPriceMinorUnits: number | null;
  renewalPriceMinorUnits: number | null;
  transferPriceMinorUnits: number | null;
  pricingNature: PricingNature;
  premium: boolean;
  tier: string | null;
  reason: string | null;
  errorCode: string | null;
  fetchedAt: string;
}

export interface DomainSearchResponse {
  domain: string;
  results: DomainAvailabilityResult[];
}

export const AVAILABILITY_PROVIDER_LABELS: Record<DomainAvailabilityProvider, string> = {
  cloudflare: 'Cloudflare',
  godaddy: 'GoDaddy',
  namecheap: 'Namecheap',
};

/** Live registrar availability and pricing for one fully-qualified domain name. */
export function searchDomainAvailability(
  domain: string,
  signal?: AbortSignal,
): Promise<DomainSearchResponse> {
  return apiRequest(`/domain-search?domain=${encodeURIComponent(domain)}`, { signal });
}

/** Fraction digits of an ISO 4217 currency (USD 2, JPY 0, TND 3); null if unknown. */
function currencyFractionDigits(currency: string): number | null {
  try {
    const digits = new Intl.NumberFormat('en-US', { currency, style: 'currency' }).resolvedOptions()
      .maximumFractionDigits;
    return typeof digits === 'number' ? digits : null;
  } catch {
    return null;
  }
}

/** Inserts the decimal point by string position: no floating point involved. */
function minorUnitsToDecimalString(minorUnits: number, fractionDigits: number): string {
  if (fractionDigits === 0) return String(minorUnits);
  const padded = String(minorUnits).padStart(fractionDigits + 1, '0');
  return `${padded.slice(0, -fractionDigits)}.${padded.slice(-fractionDigits)}`;
}

/**
 * Formats integer minor units in the result's own currency, or null when the
 * price or currency is absent/invalid. Never converts between currencies.
 */
export function formatMinorUnits(
  minorUnits: number | null,
  currency: string | null,
): string | null {
  if (minorUnits === null || currency === null) return null;
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) return null;
  const fractionDigits = currencyFractionDigits(currency);
  if (fractionDigits === null) return null;
  try {
    // Intl.NumberFormat (v3) formats a decimal string exactly; the runtime
    // type only declares number/bigint, hence the cast. Engines without v3
    // coerce the string to a number, which still rounds to the same digits.
    return new Intl.NumberFormat('en-US', {
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
      style: 'currency',
    }).format(minorUnitsToDecimalString(minorUnits, fractionDigits) as unknown as number);
  } catch {
    return null;
  }
}
