import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FindDomainPage } from '@/pages/FindDomainPage';
import type { DomainSearchResponse } from '@/api/domain-search';

const { preferences, searchDomainAvailabilityAcrossTlds } = vi.hoisted(() => ({
  preferences: {
    discovery: {
      availabilityCheckMode: 'selected' as const,
      defaultCheckedTlds: ['.com', '.in'],
      defaultSearchSort: 'availability' as const,
      savedSearchHistory: true,
    },
    status: 'ready' as const,
  },
  searchDomainAvailabilityAcrossTlds: vi.fn(),
}));

vi.mock('@/preferences/PreferencesContext', () => ({ usePreferences: () => preferences }));
vi.mock('@/api/domain-search', async () => ({
  ...(await vi.importActual<typeof import('@/api/domain-search')>('@/api/domain-search')),
  searchDomainAvailabilityAcrossTlds,
}));

const searchMock = vi.mocked(searchDomainAvailabilityAcrossTlds);

function availability(domain: string, available: boolean): DomainSearchResponse {
  return {
    domain,
    results: [{
      available,
      currency: null,
      definitive: false,
      domain,
      errorCode: null,
      fetchedAt: '2036-02-03T04:05:06.000Z',
      premium: false,
      provider: 'whois',
      reason: 'Availability is an estimate.',
      registrationPriceMinorUnits: null,
      renewalPriceMinorUnits: null,
      transferPriceMinorUnits: null,
      pricingNature: 'UNKNOWN',
      state: available ? 'AVAILABLE' : 'UNAVAILABLE',
      tier: null,
    }],
  };
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/find-domain']}><FindDomainPage /></MemoryRouter>);
}

function searchFor(domain: string) {
  fireEvent.change(screen.getByPlaceholderText(/Search domains/i), { target: { value: domain } });
  fireEvent.click(screen.getByRole('button', { name: /Check Availability/i }));
}

describe('FindDomainPage availability search', () => {
  beforeEach(() => searchMock.mockReset());

  it('starts empty with no fabricated results', () => {
    renderPage();
    expect(screen.getByText('Start a Domain Availability Search')).toBeInTheDocument();
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('checks selected extensions together and displays backend estimates', async () => {
    searchMock.mockResolvedValue([availability('example.com', false), availability('example.in', true)]);
    renderPage();
    searchFor('example');

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));
    expect(searchMock.mock.calls[0]?.[0]).toBe('example');
    expect(searchMock.mock.calls[0]?.[1]).toEqual(['.com', '.in']);
    await waitFor(() => expect(screen.getAllByText('example.in').length).toBeGreaterThan(0));
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0);
    expect(screen.queryByText('$11.99')).not.toBeInTheDocument();
  });

  it('keeps available results when the backend omits one extension', async () => {
    searchMock.mockResolvedValue([availability('example.com', false)]);
    renderPage();
    searchFor('example');

    await waitFor(() => expect(screen.getAllByText('example.com').length).toBeGreaterThan(0));
    expect(screen.getAllByText('example.in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Check failed').length).toBeGreaterThan(0);
  });
});
