import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PricingPage } from '@/pages/PricingPage';
import { ApiError } from '@/api/client';
import type { DomainAvailabilityResult, DomainSearchResponse } from '@/api/domain-search';

const { searchDomainAvailability } = vi.hoisted(() => ({
  searchDomainAvailability: vi.fn(),
}));

vi.mock('@/api/domain-search', async () => {
  const actual = await vi.importActual<typeof import('@/api/domain-search')>('@/api/domain-search');
  return {
    ...actual,
    searchDomainAvailability,
  };
});

const searchMock = vi.mocked(searchDomainAvailability);

const FETCHED_AT = '2036-02-03T04:05:06.000Z';

function result(
  overrides: Partial<DomainAvailabilityResult> & Pick<DomainAvailabilityResult, 'provider' | 'domain'>,
): DomainAvailabilityResult {
  return {
    available: true,
    currency: 'USD',
    definitive: true,
    errorCode: null,
    fetchedAt: FETCHED_AT,
    premium: false,
    pricingNature: 'CURRENT',
    reason: null,
    registrationPriceMinorUnits: null,
    renewalPriceMinorUnits: null,
    state: 'AVAILABLE',
    tier: null,
    transferPriceMinorUnits: null,
    ...overrides,
  };
}

/** Distinctive, non-round values so any reference/demo number would stand out. */
function livePricing(domain: string): DomainSearchResponse {
  return {
    domain,
    results: [
      result({
        domain,
        pricingNature: 'INDICATIVE',
        provider: 'godaddy',
        registrationPriceMinorUnits: 1199,
        renewalPriceMinorUnits: 2299,
      }),
      result({
        domain,
        provider: 'namecheap',
        registrationPriceMinorUnits: 1098,
        renewalPriceMinorUnits: 1698,
        transferPriceMinorUnits: 948,
      }),
      result({
        domain,
        provider: 'cloudflare',
        registrationPriceMinorUnits: 857,
        renewalPriceMinorUnits: 857,
        tier: 'standard',
      }),
    ],
  };
}

function unconfigured(domain: string, provider: DomainAvailabilityResult['provider']) {
  return result({
    available: null,
    currency: null,
    definitive: false,
    domain,
    pricingNature: 'UNKNOWN',
    provider,
    state: 'UNCONFIGURED',
  });
}

function renderPage(initialEntry = '/pricing') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PricingPage />
    </MemoryRouter>,
  );
}

function compare(domain: string) {
  fireEvent.change(screen.getByLabelText('Domain to compare'), { target: { value: domain } });
  fireEvent.click(screen.getByRole('button', { name: /Compare prices/iu }));
}

function rowFor(provider: string): HTMLElement {
  const row = screen.getByRole('button', { name: `Inspect ${provider}` }).closest('tr');
  if (!row) throw new Error(`No table row for ${provider}`);
  return row;
}

describe('PricingPage live registrar pricing', () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  it('starts empty: no request, no prices, no reference or demo data', () => {
    renderPage();

    expect(searchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/No comparison yet/iu)).toBeInTheDocument();
    // Old static reference registrars and the INR reference currency are gone.
    expect(screen.queryByText(/Porkbun/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hostinger/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Squarespace/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/₹/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reference Dataset/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Illustrative Benchmark/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Future capability/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Saved Comparisons/iu)).not.toBeInTheDocument();
    expect(screen.getByText(/Live registrar pricing:/iu)).toBeInTheDocument();
  });

  it('renders the real registrar prices for a domain in the comparison table', async () => {
    searchMock.mockImplementation((domain: string) => Promise.resolve(livePricing(domain)));
    renderPage();

    compare('example.com');

    await waitFor(() => expect(within(rowFor('GoDaddy')).getByText(/\$11\.99/u)).toBeInTheDocument());
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock.mock.calls[0]?.[0]).toBe('example.com');

    const godaddy = rowFor('GoDaddy');
    expect(within(godaddy).getByText(/\$11\.99/u)).toBeInTheDocument();
    expect(within(godaddy).getByText(/\$22\.99/u)).toBeInTheDocument();

    const namecheap = rowFor('Namecheap');
    expect(within(namecheap).getByText('$10.98')).toBeInTheDocument();
    expect(within(namecheap).getByText('$16.98')).toBeInTheDocument();
    expect(within(namecheap).getByText('$9.48')).toBeInTheDocument();

    const cloudflare = rowFor('Cloudflare');
    expect(within(cloudflare).getAllByText('$8.57')).toHaveLength(2);
  });

  it('shows a dash, never a number, where a registrar returned no transfer price', async () => {
    searchMock.mockImplementation((domain: string) => Promise.resolve(livePricing(domain)));
    renderPage();
    compare('example.com');
    await waitFor(() => expect(within(rowFor('Cloudflare')).getAllByText('$8.57')[0]).toBeInTheDocument());

    // Cloudflare row: register, renew ($8.57 twice) and a dash for transfer.
    const cloudflareCells = within(rowFor('Cloudflare')).getAllByRole('cell');
    expect(cloudflareCells[1]).toHaveTextContent('$8.57');
    expect(cloudflareCells[2]).toHaveTextContent('$8.57');
    expect(cloudflareCells[3]).toHaveTextContent('—');
    // GoDaddy also returns no transfer price.
    expect(within(rowFor('GoDaddy')).getAllByRole('cell')[3]).toHaveTextContent('—');
    // Namecheap does.
    expect(within(rowFor('Namecheap')).getAllByRole('cell')[3]).toHaveTextContent('$9.48');
  });

  it('marks GoDaddy pricing as indicative and other providers as live', async () => {
    searchMock.mockImplementation((domain: string) => Promise.resolve(livePricing(domain)));
    renderPage();
    compare('example.com');
    await waitFor(() => expect(within(rowFor('GoDaddy')).getByText(/\$11\.99/u)).toBeInTheDocument());

    expect(within(rowFor('GoDaddy')).getByText('Indicative')).toBeInTheDocument();
    expect(within(rowFor('GoDaddy')).getAllByText('ind.')).toHaveLength(2);
    expect(within(rowFor('Namecheap')).getByText('Live')).toBeInTheDocument();
    expect(within(rowFor('Namecheap')).queryByText('Indicative')).not.toBeInTheDocument();
    expect(screen.getByText(/only a quote locks the price/iu)).toBeInTheDocument();
  });

  it('shows a loading skeleton while the request is in flight', async () => {
    let resolveSearch: (value: DomainSearchResponse) => void = () => undefined;
    searchMock.mockImplementation(
      () =>
        new Promise<DomainSearchResponse>((resolve) => {
          resolveSearch = resolve;
        }),
    );
    renderPage();

    compare('example.com');

    expect(await screen.findAllByTestId('pricing-skeleton-row')).toHaveLength(3);
    expect(screen.getByRole('status')).toHaveTextContent(/Fetching live prices/iu);
    expect(screen.queryByText(/\$11\.99/u)).not.toBeInTheDocument();

    resolveSearch(livePricing('example.com'));
    await waitFor(() => expect(within(rowFor('GoDaddy')).getByText(/\$11\.99/u)).toBeInTheDocument());
    expect(screen.queryByTestId('pricing-skeleton-row')).not.toBeInTheDocument();
  });

  it('explains a registered (unavailable) domain and shows no prices', async () => {
    searchMock.mockImplementation((domain: string) =>
      Promise.resolve({
        domain,
        results: (['godaddy', 'namecheap', 'cloudflare'] as const).map((provider) =>
          result({
            available: false,
            currency: null,
            domain,
            pricingNature: 'UNKNOWN',
            provider,
            reason: 'domain_unavailable',
            state: 'UNAVAILABLE',
          }),
        ),
      }),
    );
    renderPage();

    compare('google.com');

    await waitFor(() => expect(screen.getByText(/google\.com is already registered/iu)).toBeInTheDocument());
    for (const provider of ['GoDaddy', 'Namecheap', 'Cloudflare']) {
      expect(within(rowFor(provider)).getByText('Registered', { selector: 'span.inline-flex' })).toBeInTheDocument();
    }
    expect(screen.queryByText(/\$\d/u)).not.toBeInTheDocument();
  });

  it('reports a fully unconfigured platform truthfully without asking users to connect accounts', async () => {
    searchMock.mockImplementation((domain: string) =>
      Promise.resolve({
        domain,
        results: (['godaddy', 'namecheap', 'cloudflare'] as const).map((provider) =>
          unconfigured(domain, provider),
        ),
      }),
    );
    renderPage();

    compare('example.com');

    await waitFor(() =>
      expect(screen.getByText(/Live registrar pricing isn't configured/iu)).toBeInTheDocument(),
    );
    expect(screen.getByText(/You don't need to connect your own account/iu)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Provider Accounts/iu })).not.toBeInTheDocument();
    expect(screen.getAllByText('Not configured').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/\$\d/u)).not.toBeInTheDocument();
  });

  it('keeps configured providers when only some are unconfigured', async () => {
    searchMock.mockImplementation((domain: string) => {
      const live = livePricing(domain);
      return Promise.resolve({
        domain,
        results: [live.results[0] as DomainAvailabilityResult, unconfigured(domain, 'namecheap'), live.results[2] as DomainAvailabilityResult],
      });
    });
    renderPage();

    compare('example.com');

    await waitFor(() => expect(screen.getByText(/1 of 3 registrars isn't configured/iu)).toBeInTheDocument());
    expect(within(rowFor('GoDaddy')).getByText(/\$11\.99/u)).toBeInTheDocument();
    expect(within(rowFor('Namecheap')).getByText('Not configured')).toBeInTheDocument();
    expect(screen.queryByText(/isn't configured\./iu)).not.toBeInTheDocument();
  });

  it('isolates a provider failure and preserves the other providers\' prices', async () => {
    searchMock.mockImplementation((domain: string) => {
      const live = livePricing(domain);
      return Promise.resolve({
        domain,
        results: [
          live.results[0] as DomainAvailabilityResult,
          result({
            available: null,
            currency: null,
            definitive: false,
            domain,
            errorCode: 'NETWORK_TIMEOUT',
            pricingNature: 'UNKNOWN',
            provider: 'namecheap',
            state: 'ERROR',
          }),
          live.results[2] as DomainAvailabilityResult,
        ],
      });
    });
    renderPage();

    compare('example.com');

    await waitFor(() => expect(screen.getByText(/Partial results/iu)).toBeInTheDocument());
    expect(within(rowFor('Namecheap')).getByText(/Error · NETWORK_TIMEOUT/iu)).toBeInTheDocument();
    expect(within(rowFor('GoDaddy')).getByText(/\$11\.99/u)).toBeInTheDocument();
    expect(within(rowFor('Cloudflare')).getAllByText('$8.57')[0]).toBeInTheDocument();
  });

  it('shows availability but no prices when only the price lookup failed', async () => {
    searchMock.mockImplementation((domain: string) => {
      const live = livePricing(domain);
      return Promise.resolve({
        domain,
        results: [
          live.results[0] as DomainAvailabilityResult,
          result({
            currency: null,
            domain,
            errorCode: 'RATE_LIMITED',
            pricingNature: 'UNKNOWN',
            provider: 'namecheap',
          }),
          live.results[2] as DomainAvailabilityResult,
        ],
      });
    });
    renderPage();

    compare('example.com');

    await waitFor(() => expect(screen.getByText(/Partial results/iu)).toBeInTheDocument());
    const namecheap = rowFor('Namecheap');
    expect(within(namecheap).getByText('Available · price lookup failed')).toBeInTheDocument();
    expect(within(namecheap).queryByText(/\$\d/u)).not.toBeInTheDocument();
    expect(within(namecheap).getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('does not pretend mixed currencies are comparable and never converts them', async () => {
    searchMock.mockImplementation((domain: string) => {
      const live = livePricing(domain);
      return Promise.resolve({
        domain,
        results: [
          live.results[0] as DomainAvailabilityResult,
          result({
            currency: 'EUR',
            domain,
            provider: 'namecheap',
            registrationPriceMinorUnits: 999,
            renewalPriceMinorUnits: 1499,
          }),
          live.results[2] as DomainAvailabilityResult,
        ],
      });
    });
    renderPage();

    compare('example.com');

    await waitFor(() => expect(screen.getByText(/Mixed currencies \(EUR, USD\)/u)).toBeInTheDocument());
    // Each price keeps its own currency; nothing is converted.
    expect(within(rowFor('Namecheap')).getByText('€9.99')).toBeInTheDocument();
    expect(within(rowFor('Namecheap')).getByText('€14.99')).toBeInTheDocument();
    expect(within(rowFor('GoDaddy')).getByText(/\$11\.99/u)).toBeInTheDocument();
    // The summary refuses a single cross-currency "lowest".
    expect(screen.getAllByText('Mixed currencies').length).toBeGreaterThan(0);
    expect(screen.getByText(/never compared/iu)).toBeInTheDocument();
  });

  it('runs automatically for a domain passed in the URL', async () => {
    searchMock.mockImplementation((domain: string) => Promise.resolve(livePricing(domain)));
    renderPage('/pricing?domain=example.org');

    await waitFor(() => expect(within(rowFor('Cloudflare')).getAllByText('$8.57')[0]).toBeInTheDocument());
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock.mock.calls[0]?.[0]).toBe('example.org');
    expect(screen.getByLabelText('Domain to compare')).toHaveValue('example.org');
  });

  it('queries the real API for each extension instead of scaling prices with multipliers', async () => {
    searchMock.mockImplementation((domain: string) => {
      const isIo = domain.endsWith('.io');
      return Promise.resolve({
        domain,
        results: [
          result({
            domain,
            provider: 'cloudflare',
            registrationPriceMinorUnits: isIo ? 4321 : 857,
            renewalPriceMinorUnits: isIo ? 4321 : 857,
          }),
        ],
      });
    });
    renderPage();
    compare('example.com');
    await waitFor(() => expect(within(rowFor('Cloudflare')).getAllByText('$8.57').length).toBe(2));

    fireEvent.click(screen.getByRole('button', { name: '.io' }));

    await waitFor(() => expect(within(rowFor('Cloudflare')).getAllByText('$43.21').length).toBe(2));
    expect(searchMock.mock.calls.map((call) => call[0])).toEqual(['example.com', 'example.io']);
    // No synthesized number derived from the .com price.
    expect(screen.queryByText('$8.57')).not.toBeInTheDocument();
    expect(screen.queryByText(/\$25\.71/u)).not.toBeInTheDocument();
  });

  it('rejects a bare name locally without calling the API', async () => {
    renderPage();

    compare('worknai');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Enter a full domain/iu);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('reports a failed request and lets the user retry', async () => {
    searchMock.mockRejectedValueOnce(
      new ApiError({
        detail: 'Registrar lookup is unavailable.',
        status: 503,
        title: 'Service Unavailable',
      }),
    );
    renderPage();

    compare('example.com');

    await waitFor(() =>
      expect(screen.getByText(/Registrar lookup is unavailable\./iu)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/\$\d/u)).not.toBeInTheDocument();

    searchMock.mockImplementation((domain: string) => Promise.resolve(livePricing(domain)));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(within(rowFor('Cloudflare')).getAllByText('$8.57')[0]).toBeInTheDocument());
  });

  it('sorts by the chosen price and keeps providers without that price last', async () => {
    searchMock.mockImplementation((domain: string) => Promise.resolve(livePricing(domain)));
    renderPage();
    compare('example.com');
    await waitFor(() => expect(within(rowFor('Cloudflare')).getAllByText('$8.57')[0]).toBeInTheDocument());

    const order = () =>
      screen
        .getAllByRole('button', { name: /^Inspect / })
        .map((button) => button.getAttribute('aria-label')?.replace('Inspect ', ''));
    // Default: lowest first-year price.
    expect(order()).toEqual(['Cloudflare', 'Namecheap', 'GoDaddy']);

    fireEvent.change(screen.getByLabelText('Sort registrars'), { target: { value: 'lowest-transfer' } });

    // Only Namecheap returned a transfer price; the others follow without one.
    expect(order()[0]).toBe('Namecheap');
  });

  it('has no hosting tab or static hosting prices', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /Hosting Providers/iu })).not.toBeInTheDocument();
    expect(screen.queryByText(/Hosting Benchmark/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Illustrative reference data/iu)).not.toBeInTheDocument();
    for (const provider of [/DigitalOcean/iu, /Vultr/iu, /Lightsail/iu, /SiteGround/iu, /Cloudways/iu]) {
      expect(screen.queryByText(provider)).not.toBeInTheDocument();
    }
    // The registrar comparison is the only view.
    expect(screen.getByLabelText('Domain to compare')).toBeInTheDocument();
    expect(searchMock).not.toHaveBeenCalled();
  });
});
