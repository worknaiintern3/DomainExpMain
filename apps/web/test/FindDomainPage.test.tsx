import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FindDomainPage } from '@/pages/FindDomainPage';
import type { DomainAvailabilityResult, DomainSearchResponse } from '@/api/domain-search';

const { preferences, searchDomainAvailability } = vi.hoisted(() => ({
  preferences: {
    discovery: {
      availabilityCheckMode: 'selected' as const,
      defaultCheckedTlds: ['.com'],
      defaultSearchSort: 'availability' as const,
      savedSearchHistory: true,
    },
    status: 'ready' as const,
  },
  searchDomainAvailability: vi.fn(),
}));

vi.mock('@/preferences/PreferencesContext', () => ({ usePreferences: () => preferences }));

vi.mock('@/api/domain-search', async () => {
  const actual = await vi.importActual<typeof import('@/api/domain-search')>('@/api/domain-search');
  return {
    ...actual,
    searchDomainAvailability,
  };
});

const searchMock = vi.mocked(searchDomainAvailability);

function godaddyAvailable(domain: string): DomainSearchResponse {
  return {
    domain,
    results: [
      {
        available: true,
        currency: 'USD',
        definitive: true,
        domain,
        errorCode: null,
        fetchedAt: '2036-02-03T04:05:06.000Z',
        premium: false,
        provider: 'godaddy',
        reason: null,
        registrationPriceMinorUnits: 1199,
        renewalPriceMinorUnits: 2299,
        transferPriceMinorUnits: null,
        pricingNature: 'INDICATIVE',
        state: 'AVAILABLE',
        tier: null,
      },
      {
        available: null,
        currency: null,
        definitive: false,
        domain,
        errorCode: null,
        fetchedAt: '2036-02-03T04:05:06.000Z',
        premium: false,
        provider: 'namecheap',
        reason: null,
        registrationPriceMinorUnits: null,
        renewalPriceMinorUnits: null,
        transferPriceMinorUnits: null,
        pricingNature: 'UNKNOWN',
        state: 'UNCONFIGURED',
        tier: null,
      },
      {
        available: false,
        currency: null,
        definitive: true,
        domain,
        errorCode: null,
        fetchedAt: '2036-02-03T04:05:06.000Z',
        premium: false,
        provider: 'cloudflare',
        reason: 'domain_unavailable',
        registrationPriceMinorUnits: null,
        renewalPriceMinorUnits: null,
        transferPriceMinorUnits: null,
        pricingNature: 'UNKNOWN',
        state: 'UNAVAILABLE',
        tier: null,
      },
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/find-domain']}>
      <FindDomainPage />
    </MemoryRouter>,
  );
}

async function searchFor(domain: string) {
  fireEvent.change(screen.getByPlaceholderText(/Search domains/i), {
    target: { value: domain },
  });
  fireEvent.click(screen.getByRole('button', { name: /Check Availability/i }));
}

describe('FindDomainPage live search', () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  it('starts empty with no fabricated results', () => {
    renderPage();

    expect(screen.getByText('Start a Domain Availability Search')).toBeInTheDocument();
    expect(searchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/demonstration data only/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reference\/demo pricing/iu)).not.toBeInTheDocument();
  });

  it('renders a successful live search with provider source and real pricing', async () => {
    searchMock.mockImplementation((domain: string) => Promise.resolve(godaddyAvailable(domain)));
    renderPage();

    await searchFor('example.com');

    await waitFor(() => expect(screen.getAllByText('example.com').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    // Real pricing from the mocked provider response, with its source.
    expect(screen.getAllByText('$11.99').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GoDaddy').length).toBeGreaterThan(0);
    // No fabricated reference data anywhere on screen.
    expect(screen.queryByText(/demonstration data only/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reference\/demo pricing/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Available • Reference/iu)).not.toBeInTheDocument();
  });

  it('renders an unavailable result without prices', async () => {
    searchMock.mockImplementation((domain: string) =>
      Promise.resolve({
        domain,
        results: (['godaddy', 'namecheap', 'cloudflare'] as const).map((provider) => ({
          available: false,
          currency: null,
          definitive: true,
          domain,
          errorCode: null,
          fetchedAt: '2036-02-03T04:05:06.000Z',
          premium: false,
          provider,
          reason: 'domain_unavailable',
          registrationPriceMinorUnits: null,
          renewalPriceMinorUnits: null,
          transferPriceMinorUnits: null,
          pricingNature: 'UNKNOWN',
          state: 'UNAVAILABLE' as const,
          tier: null,
        })),
      }),
    );
    renderPage();

    await searchFor('taken.com');

    await waitFor(() => expect(screen.getAllByText('Registered')[0]).toBeInTheDocument());
    expect(screen.queryByText('$11.99')).not.toBeInTheDocument();
  });

  it('surfaces partial provider failures without hiding good results', async () => {
    searchMock.mockImplementation((domain: string) => {
      const response = godaddyAvailable(domain);
      return Promise.resolve({
        ...response,
        results: response.results.map((result: DomainAvailabilityResult) =>
          result.provider === 'namecheap'
            ? {
                ...result,
                available: null,
                errorCode: 'NETWORK_TIMEOUT',
                state: 'ERROR' as const,
              }
            : result,
        ),
      });
    });
    renderPage();

    await searchFor('example.com');

    await waitFor(() => expect(screen.getByText(/Partial results/iu)).toBeInTheDocument());
    // The successful provider result still renders.
    expect(screen.getAllByText('$11.99').length).toBeGreaterThan(0);
  });

  it('explains an unconfigured central search service truthfully', async () => {
    searchMock.mockImplementation((domain: string) =>
      Promise.resolve({
        domain,
        results: (['godaddy', 'namecheap', 'cloudflare'] as const).map((provider) => ({
          available: null,
          currency: null,
          definitive: false,
          domain,
          errorCode: null,
          fetchedAt: '2036-02-03T04:05:06.000Z',
          premium: false,
          provider,
          reason: null,
          registrationPriceMinorUnits: null,
          renewalPriceMinorUnits: null,
          transferPriceMinorUnits: null,
          pricingNature: 'UNKNOWN',
          state: 'UNCONFIGURED' as const,
          tier: null,
        })),
      }),
    );
    renderPage();

    await searchFor('example.com');

    await waitFor(() =>
      expect(screen.getByText(/Live registrar search isn't configured/iu)).toBeInTheDocument(),
    );
    // Find Domain is a platform capability: never send users to connect their own account.
    expect(screen.getByText(/You don't need to connect your own account/iu)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Provider Accounts/iu })).not.toBeInTheDocument();
  });
});
