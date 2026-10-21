import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DomainAvailabilityResult } from '@/api/domain-search';
import { RegistrarComparisonMatrix } from '@/features/pricing/components/RegistrarComparisonMatrix';
import {
  horizonYearsOf,
  loadPricingPreferences,
  savePricingPreferences,
  sortOptionOf,
  visibleColumnsOf,
} from '@/features/settings/pricing-preferences';
import { DEFAULT_SETTINGS } from '@/features/settings/settings.reference';

beforeEach(() => {
  localStorage.clear();
});

describe('pricing display preferences', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(loadPricingPreferences()).toEqual(DEFAULT_SETTINGS.pricing);
  });

  it('round-trips through localStorage', () => {
    savePricingPreferences({
      ...DEFAULT_SETTINGS.pricing,
      defaultPricingHorizon: '1-year',
      defaultComparisonSort: 'lowest-renewal',
      renewalMarkupThreshold: 25,
      showTransferPriceColumn: false,
    });

    const loaded = loadPricingPreferences();
    expect(loaded.defaultPricingHorizon).toBe('1-year');
    expect(loaded.defaultComparisonSort).toBe('lowest-renewal');
    expect(loaded.renewalMarkupThreshold).toBe(25);
    expect(loaded.showTransferPriceColumn).toBe(false);
  });

  it('maps settings to the live comparison defaults', () => {
    expect(horizonYearsOf({ defaultPricingHorizon: '1-year' })).toBe(1);
    expect(horizonYearsOf({ defaultPricingHorizon: '3-years' })).toBe(3);
    expect(sortOptionOf({ defaultComparisonSort: 'best-value' })).toBe('lowest-5yr');
    expect(sortOptionOf({ defaultComparisonSort: 'lowest-renewal' })).toBe('lowest-renewal');
    expect(sortOptionOf({ defaultComparisonSort: 'lowest-first-year' })).toBe('lowest-first-year');
  });

  it('never hides every price column', () => {
    expect(
      visibleColumnsOf({
        showRegistrationPriceColumn: false,
        showRenewalPriceColumn: false,
        showTransferPriceColumn: false,
      }),
    ).toEqual({ registration: true, renewal: true, transfer: true });
  });

  it('stores no WHOIS/DNSSEC fee toggles', () => {
    const loaded = loadPricingPreferences();
    expect(loaded).not.toHaveProperty('includeWhoisPrivacy');
    expect(loaded).not.toHaveProperty('includeDnssec');
  });
});

const FETCHED_AT = '2036-02-03T04:05:06.000Z';

function pricedResult(provider: DomainAvailabilityResult['provider']): DomainAvailabilityResult {
  return {
    available: true,
    currency: 'USD',
    definitive: true,
    domain: 'example.com',
    errorCode: null,
    fetchedAt: FETCHED_AT,
    premium: false,
    pricingNature: 'CURRENT',
    reason: null,
    registrationPriceMinorUnits: 1000,
    renewalPriceMinorUnits: 3000,
    state: 'AVAILABLE',
    tier: null,
    transferPriceMinorUnits: 900,
  };
}

describe('RegistrarComparisonMatrix preferences', () => {
  it('hides columns the user turned off', () => {
    render(
      <RegistrarComparisonMatrix
        results={[pricedResult('godaddy')]}
        searchState="results"
        domain="example.com"
        selectedProvider={null}
        onSelectProvider={() => {}}
        visibleColumns={{ registration: true, renewal: true, transfer: false }}
      />,
    );

    expect(screen.queryByRole('columnheader', { name: 'Transfer' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Renew' })).toBeInTheDocument();
  });

  it('flags a renewal step-up at the saved threshold', () => {
    // 1000 -> 3000 is +200%; a 25% threshold must flag it.
    render(
      <RegistrarComparisonMatrix
        results={[pricedResult('godaddy')]}
        searchState="results"
        domain="example.com"
        selectedProvider={null}
        onSelectProvider={() => {}}
        markupThresholdPercent={25}
      />,
    );

    expect(screen.getByTitle(/warning at 25%/u)).toHaveTextContent('+200.0%');
  });

  it('keeps the default 50% threshold behavior', () => {
    render(
      <RegistrarComparisonMatrix
        results={[pricedResult('godaddy')]}
        searchState="results"
        domain="example.com"
        selectedProvider={null}
        onSelectProvider={() => {}}
      />,
    );

    expect(screen.getByTitle(/warning at 50%/u)).toBeInTheDocument();
  });
});
