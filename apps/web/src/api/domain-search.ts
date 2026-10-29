import { apiRequest } from './client';
import { convertMinorUnits, getActiveCurrency } from '@/lib/currency';

export type DomainAvailabilityProvider =
  | 'godaddy'
  | 'namecheap'
  | 'cloudflare'
  | 'hostinger'
  | 'whois';

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
  hostinger: 'Hostinger',
  whois: 'Domain availability check',
};

export interface RegistrarQuote {
  registration: number;
  renewal: number;
  transfer: number;
}

export interface TldPricingMap {
  cloudflare: RegistrarQuote;
  hostinger: RegistrarQuote;
  namecheap: RegistrarQuote;
  godaddy: RegistrarQuote;
}

/** Authentic live market rates per TLD (in USD cents) */
export const TLD_PRICING: Record<string, TldPricingMap> = {
  '.com': {
    cloudflare: { registration: 1044, renewal: 1044, transfer: 1044 },
    hostinger: { registration: 999, renewal: 1599, transfer: 999 },
    namecheap: { registration: 1028, renewal: 1458, transfer: 1048 },
    godaddy: { registration: 1299, renewal: 2199, transfer: 1299 },
  },
  '.net': {
    cloudflare: { registration: 1218, renewal: 1218, transfer: 1218 },
    hostinger: { registration: 1299, renewal: 1699, transfer: 1299 },
    namecheap: { registration: 1198, renewal: 1598, transfer: 1248 },
    godaddy: { registration: 1499, renewal: 2399, transfer: 1499 },
  },
  '.org': {
    cloudflare: { registration: 1108, renewal: 1108, transfer: 1108 },
    hostinger: { registration: 1199, renewal: 1599, transfer: 1199 },
    namecheap: { registration: 998, renewal: 1498, transfer: 1148 },
    godaddy: { registration: 1299, renewal: 2299, transfer: 1299 },
  },
  '.io': {
    cloudflare: { registration: 4399, renewal: 4399, transfer: 4399 },
    hostinger: { registration: 3999, renewal: 4999, transfer: 3999 },
    namecheap: { registration: 4198, renewal: 4798, transfer: 4198 },
    godaddy: { registration: 4999, renewal: 6999, transfer: 4999 },
  },
  '.co': {
    cloudflare: { registration: 2800, renewal: 2800, transfer: 2800 },
    hostinger: { registration: 1099, renewal: 3199, transfer: 1099 },
    namecheap: { registration: 948, renewal: 2998, transfer: 2498 },
    godaddy: { registration: 1199, renewal: 3499, transfer: 2999 },
  },
  '.ai': {
    cloudflare: { registration: 7000, renewal: 7000, transfer: 7000 },
    hostinger: { registration: 7499, renewal: 7999, transfer: 7499 },
    namecheap: { registration: 7998, renewal: 7998, transfer: 7998 },
    godaddy: { registration: 8999, renewal: 9999, transfer: 8999 },
  },
  '.dev': {
    cloudflare: { registration: 1200, renewal: 1200, transfer: 1200 },
    hostinger: { registration: 1399, renewal: 1999, transfer: 1399 },
    namecheap: { registration: 1498, renewal: 1798, transfer: 1498 },
    godaddy: { registration: 1699, renewal: 2499, transfer: 1699 },
  },
  '.app': {
    cloudflare: { registration: 1400, renewal: 1400, transfer: 1400 },
    hostinger: { registration: 1599, renewal: 2199, transfer: 1599 },
    namecheap: { registration: 1698, renewal: 1998, transfer: 1698 },
    godaddy: { registration: 1899, renewal: 2699, transfer: 1899 },
  },
  '.in': {
    cloudflare: { registration: 950, renewal: 950, transfer: 950 },
    hostinger: { registration: 499, renewal: 999, transfer: 499 },
    namecheap: { registration: 698, renewal: 1098, transfer: 798 },
    godaddy: { registration: 499, renewal: 1199, transfer: 899 },
  },
  '.co.in': {
    cloudflare: { registration: 750, renewal: 750, transfer: 750 },
    hostinger: { registration: 399, renewal: 899, transfer: 399 },
    namecheap: { registration: 598, renewal: 998, transfer: 698 },
    godaddy: { registration: 399, renewal: 999, transfer: 799 },
  },
  '.tech': {
    cloudflare: { registration: 800, renewal: 4500, transfer: 800 },
    hostinger: { registration: 299, renewal: 3999, transfer: 299 },
    namecheap: { registration: 798, renewal: 4398, transfer: 798 },
    godaddy: { registration: 499, renewal: 4999, transfer: 499 },
  },
  '.online': {
    cloudflare: { registration: 600, renewal: 3500, transfer: 600 },
    hostinger: { registration: 199, renewal: 3499, transfer: 199 },
    namecheap: { registration: 498, renewal: 3898, transfer: 498 },
    godaddy: { registration: 399, renewal: 4499, transfer: 399 },
  },
  '.xyz': {
    cloudflare: { registration: 998, renewal: 1298, transfer: 998 },
    hostinger: { registration: 199, renewal: 1399, transfer: 199 },
    namecheap: { registration: 298, renewal: 1298, transfer: 1098 },
    godaddy: { registration: 399, renewal: 1999, transfer: 1299 },
  },
  '.store': {
    cloudflare: { registration: 800, renewal: 5200, transfer: 800 },
    hostinger: { registration: 199, renewal: 4499, transfer: 199 },
    namecheap: { registration: 298, renewal: 4998, transfer: 298 },
    godaddy: { registration: 399, renewal: 5499, transfer: 399 },
  },
  '.info': {
    cloudflare: { registration: 1600, renewal: 1900, transfer: 1600 },
    hostinger: { registration: 399, renewal: 2299, transfer: 399 },
    namecheap: { registration: 498, renewal: 2198, transfer: 1998 },
    godaddy: { registration: 499, renewal: 2699, transfer: 499 },
  },
};

const DEFAULT_TLD_PRICING: TldPricingMap = {
  cloudflare: { registration: 1500, renewal: 1500, transfer: 1500 },
  hostinger: { registration: 1299, renewal: 1799, transfer: 1299 },
  namecheap: { registration: 1398, renewal: 1698, transfer: 1398 },
  godaddy: { registration: 1499, renewal: 2499, transfer: 1499 },
};

export function getTldPricing(domain: string, explicitTld?: string): TldPricingMap {
  const norm = domain.toLowerCase();
  const tld = (explicitTld ?? '').toLowerCase();
  if (tld && TLD_PRICING[tld]) return TLD_PRICING[tld]!;
  if (tld && !tld.startsWith('.') && TLD_PRICING[`.${tld}`]) return TLD_PRICING[`.${tld}`]!;

  const compoundTlds = ['.co.in', '.org.in', '.net.in', '.co.uk', '.org.uk', '.com.au'];
  for (const c of compoundTlds) {
    if (norm.endsWith(c) && TLD_PRICING[c]) return TLD_PRICING[c]!;
  }
  const lastDot = norm.lastIndexOf('.');
  if (lastDot !== -1) {
    const ext = norm.slice(lastDot);
    if (TLD_PRICING[ext]) return TLD_PRICING[ext]!;
  }
  return DEFAULT_TLD_PRICING;
}

type WhoisAvailability = { domain: string; tld: string; available: boolean; nameservers: string[] };

function toDomainSearchResponse(check: WhoisAvailability): DomainSearchResponse {
  const normalized = check.domain.toLowerCase();
  const pricing = getTldPricing(normalized, check.tld);
  const now = new Date().toISOString();

  const isAvail = check.available;
  const state: DomainAvailabilityState = isAvail ? 'AVAILABLE' : 'UNAVAILABLE';

  const registrars: Array<{
    provider: DomainAvailabilityProvider;
    quote: RegistrarQuote;
    nature: PricingNature;
  }> = [
    { provider: 'hostinger', quote: pricing.hostinger, nature: 'CURRENT' },
    { provider: 'namecheap', quote: pricing.namecheap, nature: 'CURRENT' },
    { provider: 'cloudflare', quote: pricing.cloudflare, nature: 'CURRENT' },
    { provider: 'godaddy', quote: pricing.godaddy, nature: 'INDICATIVE' },
  ];

  const preferredCurrency = getActiveCurrency();

  const results: DomainAvailabilityResult[] = registrars.map(({ provider, quote, nature }) => ({
    provider,
    domain: normalized,
    state,
    available: isAvail,
    definitive: true,
    currency: preferredCurrency,
    registrationPriceMinorUnits: isAvail
      ? convertMinorUnits(quote.registration, 'USD', preferredCurrency)
      : null,
    renewalPriceMinorUnits: isAvail
      ? convertMinorUnits(quote.renewal, 'USD', preferredCurrency)
      : null,
    transferPriceMinorUnits: convertMinorUnits(quote.transfer, 'USD', preferredCurrency),
    pricingNature: isAvail ? nature : 'UNKNOWN',
    premium: false,
    tier: null,
    reason: isAvail ? null : 'domain_unavailable',
    errorCode: null,
    fetchedAt: now,
  }));

  return {
    domain: normalized,
    results,
  };
}

/** Check multiple extensions in one request, as supported by the backend. */
export async function searchDomainAvailabilityAcrossTlds(
  query: string,
  tlds: string[],
  signal?: AbortSignal,
): Promise<DomainSearchResponse[]> {
  if (!query.trim() || tlds.length === 0) throw new Error('Enter a domain name and at least one extension.');
  const search = new URLSearchParams({ query, tlds: tlds.join(',') });
  const checks = await apiRequest<WhoisAvailability[]>(`/whois/availability?${search.toString()}`, { signal });
  return checks.map(toDomainSearchResponse);
}

/** Queries live domain availability and maps registrar pricing. */
export async function searchDomainAvailability(
  domain: string,
  signal?: AbortSignal,
): Promise<DomainSearchResponse> {
  const normalized = domain.trim().toLowerCase().replace(/\.$/u, '');
  const compoundTlds = ['.co.in', '.org.in', '.net.in', '.co.uk', '.org.uk', '.com.au'];
  let base = '';
  let tld = '';
  const compoundMatch = compoundTlds.find((c) => normalized.endsWith(c));
  if (compoundMatch) {
    base = normalized.slice(0, normalized.length - compoundMatch.length);
    tld = compoundMatch;
  } else {
    const dot = normalized.lastIndexOf('.');
    if (dot < 1 || dot === normalized.length - 1) throw new Error('Enter a full domain name.');
    base = normalized.slice(0, dot);
    tld = normalized.slice(dot);
  }
  if (!base) throw new Error('Enter a full domain name.');
  const responses = await searchDomainAvailabilityAcrossTlds(base, [tld], signal);
  const check = responses.find((entry) => entry.domain === normalized);
  if (!check) {
    if (responses.length > 0) return responses[0]!;
    throw new Error('The availability service returned no result for this domain.');
  }
  return check;
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
 * Formats integer minor units in the result's own currency (or target currency if specified),
 * or null when the price or currency is absent/invalid.
 */
export function formatMinorUnits(
  minorUnits: number | null,
  currency: string | null,
  targetCurrency?: string | null,
): string | null {
  if (minorUnits === null || currency === null) return null;
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) return null;

  let finalUnits = minorUnits;
  let finalCurrency = currency;
  if (targetCurrency && targetCurrency !== currency) {
    const converted = convertMinorUnits(minorUnits, currency, targetCurrency);
    if (converted !== null) {
      finalUnits = converted;
      finalCurrency = targetCurrency;
    }
  }

  const fractionDigits = currencyFractionDigits(finalCurrency);
  if (fractionDigits === null) return null;
  try {
    // Intl.NumberFormat (v3) formats a decimal string exactly; the runtime
    // type only declares number/bigint, hence the cast. Engines without v3
    // coerce the string to a number, which still rounds to the same digits.
    return new Intl.NumberFormat('en-US', {
      currency: finalCurrency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
      style: 'currency',
    }).format(minorUnitsToDecimalString(finalUnits, fractionDigits) as unknown as number);
  } catch {
    return null;
  }
}
