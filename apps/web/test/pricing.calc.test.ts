import { describe, expect, it } from 'vitest';

import type { DomainAvailabilityResult } from '@/api/domain-search';
import {
  calculateTransferSavings,
  formatBps,
  formatTenthsPercent,
  largestStepUp,
  lowestByCurrency,
  ownershipItems,
  ownershipSavings,
  pricedCurrencies,
  renewalStepUpBps,
  sortResults,
  totalCost,
} from '@/features/pricing';

function r(
  provider: DomainAvailabilityResult['provider'],
  overrides: Partial<DomainAvailabilityResult> = {},
): DomainAvailabilityResult {
  return {
    available: true,
    currency: 'USD',
    definitive: true,
    domain: 'example.com',
    errorCode: null,
    fetchedAt: '2036-02-03T04:05:06.000Z',
    premium: false,
    pricingNature: 'CURRENT',
    provider,
    reason: null,
    registrationPriceMinorUnits: null,
    renewalPriceMinorUnits: null,
    state: 'AVAILABLE',
    tier: null,
    transferPriceMinorUnits: null,
    ...overrides,
  };
}

const GODADDY = r('godaddy', {
  pricingNature: 'INDICATIVE',
  registrationPriceMinorUnits: 1199,
  renewalPriceMinorUnits: 2299,
});
const NAMECHEAP = r('namecheap', {
  registrationPriceMinorUnits: 1098,
  renewalPriceMinorUnits: 1698,
  transferPriceMinorUnits: 948,
});
const CLOUDFLARE = r('cloudflare', {
  registrationPriceMinorUnits: 857,
  renewalPriceMinorUnits: 857,
});

describe('pricing calculations are integer-only', () => {
  it('computes multi-year cost from integer minor units', () => {
    expect(totalCost(GODADDY, 1)).toBe(1199);
    expect(totalCost(GODADDY, 3)).toBe(1199 + 2 * 2299);
    expect(totalCost(GODADDY, 5)).toBe(1199 + 4 * 2299);
    expect(totalCost(r('cloudflare', { registrationPriceMinorUnits: 857 }), 3)).toBeNull();
  });

  it('never yields a fractional or unsafe minor-unit total', () => {
    const huge = r('godaddy', {
      registrationPriceMinorUnits: 1,
      renewalPriceMinorUnits: Number.MAX_SAFE_INTEGER,
    });
    expect(totalCost(huge, 5)).toBeNull();
    expect(Number.isInteger(totalCost(NAMECHEAP, 5))).toBe(true);
  });

  it('computes the renewal step-up in integer basis points', () => {
    // (2299 - 1199) / 1199 = 91.74...% -> 9174 bps (truncated, not rounded up).
    expect(renewalStepUpBps(GODADDY)).toBe(9174);
    expect(renewalStepUpBps(CLOUDFLARE)).toBe(0);
    expect(renewalStepUpBps(r('godaddy', { registrationPriceMinorUnits: 1000 }))).toBeNull();
    expect(
      renewalStepUpBps(r('godaddy', { registrationPriceMinorUnits: 0, renewalPriceMinorUnits: 100 })),
    ).toBeNull();
    expect(formatBps(9174)).toBe('+91.7%');
    expect(formatBps(0)).toBe('+0.0%');
    expect(formatBps(-1250)).toBe('-12.5%');
    expect(formatTenthsPercent(123)).toBe('12.3%');
  });

  it('finds the largest real step-up and ignores providers without both prices', () => {
    expect(largestStepUp([GODADDY, NAMECHEAP, CLOUDFLARE])).toEqual({ bps: 9174, provider: 'godaddy' });
    expect(largestStepUp([r('godaddy'), r('namecheap')])).toBeNull();
  });
});

describe('currency handling never mixes or converts', () => {
  const EUR_NAMECHEAP = r('namecheap', {
    currency: 'EUR',
    registrationPriceMinorUnits: 999,
    renewalPriceMinorUnits: 1499,
  });

  it('groups the lowest price per currency instead of ranking across currencies', () => {
    const lowest = lowestByCurrency([GODADDY, EUR_NAMECHEAP, CLOUDFLARE], 'registration');

    expect(lowest).toEqual([
      { currency: 'EUR', minorUnits: 999, providers: ['namecheap'] },
      { currency: 'USD', minorUnits: 857, providers: ['cloudflare'] },
    ]);
    // 999 EUR-cents is numerically above 857 USD-cents yet is not compared to it.
    expect(lowest).toHaveLength(2);
  });

  it('lists every provider tied for the lowest price', () => {
    const tied = r('namecheap', { registrationPriceMinorUnits: 857, renewalPriceMinorUnits: 857 });
    expect(lowestByCurrency([CLOUDFLARE, tied], 'renewal')).toEqual([
      { currency: 'USD', minorUnits: 857, providers: ['cloudflare', 'namecheap'] },
    ]);
  });

  it('reports the priced currencies alphabetically and ignores unpriced results', () => {
    expect(pricedCurrencies([GODADDY, EUR_NAMECHEAP, r('cloudflare')])).toEqual(['EUR', 'USD']);
    expect(pricedCurrencies([r('godaddy', { currency: 'USD' })])).toEqual([]);
  });

  it('groups sort order by currency so raw numbers of different currencies never interleave', () => {
    const sorted = sortResults([GODADDY, EUR_NAMECHEAP, CLOUDFLARE], 'lowest-first-year');
    expect(sorted.map((x) => x.provider)).toEqual(['namecheap', 'cloudflare', 'godaddy']);
    expect(sorted.map((x) => x.currency)).toEqual(['EUR', 'USD', 'USD']);
  });

  it('sorts missing values last and by label among equals', () => {
    const sorted = sortResults([r('godaddy'), NAMECHEAP, CLOUDFLARE], 'lowest-transfer');
    expect(sorted.map((x) => x.provider)).toEqual(['namecheap', 'cloudflare', 'godaddy']);
  });

  it('costs ownership per currency and only for providers with both prices', () => {
    const { items, excluded } = ownershipItems(
      [GODADDY, EUR_NAMECHEAP, r('cloudflare', { registrationPriceMinorUnits: 857 })],
      3,
    );

    expect(excluded).toEqual(['cloudflare']);
    expect(items.map((i) => [i.provider, i.currency, i.totalMinorUnits])).toEqual([
      ['namecheap', 'EUR', 999 + 2 * 1499],
      ['godaddy', 'USD', 1199 + 2 * 2299],
    ]);
    // A lone provider in a currency has nothing to be compared to.
    expect(ownershipSavings(items)).toEqual([]);
  });

  it('reports savings only between registrars sharing a currency', () => {
    const { items } = ownershipItems([GODADDY, NAMECHEAP, CLOUDFLARE], 5);
    const [savings] = ownershipSavings(items);

    const godaddyTotal = 1199 + 4 * 2299;
    const cloudflareTotal = 857 + 4 * 857;
    expect(savings?.currency).toBe('USD');
    expect(savings?.savingsMinorUnits).toBe(godaddyTotal - cloudflareTotal);
    expect(items.find((i) => i.provider === 'cloudflare')?.isLowestInCurrency).toBe(true);
    expect(items.find((i) => i.provider === 'godaddy')?.isLowestInCurrency).toBe(false);
  });

  it('skips unavailable and unconfigured results when costing ownership', () => {
    const registered = r('godaddy', {
      available: false,
      registrationPriceMinorUnits: 1199,
      renewalPriceMinorUnits: 2299,
      state: 'UNAVAILABLE',
    });
    expect(ownershipItems([registered], 5)).toEqual({ excluded: [], items: [] });
  });
});

describe('transfer savings', () => {
  it('computes annual and three-year savings from real renewal prices in one currency', () => {
    const calc = calculateTransferSavings(GODADDY, CLOUDFLARE, 10);

    expect(calc).toEqual({
      annualSavingsMinorUnits: (2299 - 857) * 10,
      currentAnnualMinorUnits: 22_990,
      percentSavings: 62,
      projectedAnnualMinorUnits: 8570,
      threeYearSavingsMinorUnits: (2299 - 857) * 10 * 3,
    });
  });

  it('refuses to compare registrars quoting different currencies', () => {
    const eur = r('namecheap', { currency: 'EUR', renewalPriceMinorUnits: 1499 });
    expect(calculateTransferSavings(GODADDY, eur, 5)).toBeNull();
  });

  it('returns null when a renewal price is missing or the selection is invalid', () => {
    expect(calculateTransferSavings(GODADDY, r('cloudflare'), 5)).toBeNull();
    expect(calculateTransferSavings(undefined, CLOUDFLARE, 5)).toBeNull();
    expect(calculateTransferSavings(GODADDY, CLOUDFLARE, 0)).toBeNull();
    expect(calculateTransferSavings(GODADDY, CLOUDFLARE, 2.5)).toBeNull();
  });

  it('never reports negative savings when the target is dearer', () => {
    const calc = calculateTransferSavings(CLOUDFLARE, GODADDY, 4);
    expect(calc?.annualSavingsMinorUnits).toBe(0);
    expect(calc?.percentSavings).toBe(0);
  });

  it('computes identical savings whether or not any transfer price exists', () => {
    const withoutTransfer = calculateTransferSavings(GODADDY, CLOUDFLARE, 10);
    const withTransfer = calculateTransferSavings(
      r('godaddy', {
        pricingNature: 'INDICATIVE',
        registrationPriceMinorUnits: 1199,
        renewalPriceMinorUnits: 2299,
        transferPriceMinorUnits: 1999,
      }),
      r('cloudflare', {
        registrationPriceMinorUnits: 857,
        renewalPriceMinorUnits: 857,
        transferPriceMinorUnits: 857,
      }),
      10,
    );
    expect(withoutTransfer).not.toBeNull();
    expect(withTransfer).toEqual(withoutTransfer);
  });
});
