import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewPage } from '@/pages/OverviewPage';
import type { DomainItem, PortfolioSummary } from '@/services/portfolioService';

const { portfolio, auth } = vi.hoisted(() => ({
  portfolio: {
    fetchPortfolioSummary: vi.fn(), fetchDomainsList: vi.fn(),
    fetchServersList: vi.fn(), fetchApplicationsList: vi.fn(), syncAllProviders: vi.fn(),
  },
  auth: { user: { displayName: 'Test Owner', email: 'owner@example.test' } },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/services/portfolioService', async () => ({
  ...await vi.importActual<typeof import('@/services/portfolioService')>('@/services/portfolioService'),
  ...portfolio,
}));

const summary: PortfolioSummary = {
  totalDomains: 42, safeDomains: 40, warningDomains: 1, criticalDomains: 1,
  totalServers: 30, healthyServers: 30, totalApps: 3, productionApps: 3,
  totalWebsites: 9, totalProviders: 4, totalAlerts: 2, estimatedRenewalCost: 12000,
};
const domain: DomainItem = {
  id: 'domain-1', name: 'example.com', tld: '.com', registrar: 'hostinger',
  autoRenew: true, registrationDate: '2025-01-01', expiresAt: '2027-01-01',
  daysRemaining: 60, renewalPrice: 1000, currency: 'INR', status: 'safe',
  dnsProvider: 'Cloudflare', sslStatus: 'active', httpStatus: '200', rdapStatus: 'ok',
  nameservers: [], tags: [],
};
const renderPage = () => render(<MemoryRouter><OverviewPage /></MemoryRouter>);

describe('OverviewPage portfolio dashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.user.displayName = 'Test Owner';
    portfolio.fetchPortfolioSummary.mockResolvedValue(summary);
    portfolio.fetchDomainsList.mockResolvedValue([domain]);
    portfolio.fetchServersList.mockResolvedValue([]);
    portfolio.fetchApplicationsList.mockResolvedValue([]);
    portfolio.syncAllProviders.mockResolvedValue({ message: 'Provider inventory refreshed.' });
  });

  it('renders portfolio totals independently of the preview list length', async () => {
    renderPage();
    const domains = screen.getByRole('link', { name: /My Domains/ });
    expect(await within(domains).findByText('42')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /VPS & Servers/ })).getByText('30')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /Mobile Apps/ })).getByText('3')).toBeInTheDocument();
    expect(portfolio.fetchPortfolioSummary).toHaveBeenCalledWith({ forceRefresh: false });
  });

  it('preserves true zero counts instead of substituting populated defaults', async () => {
    portfolio.fetchPortfolioSummary.mockResolvedValue(Object.fromEntries(Object.keys(summary).map((key) => [key, 0])));
    portfolio.fetchDomainsList.mockResolvedValue([]);
    renderPage();
    expect(await within(screen.getByRole('link', { name: /My Domains/ })).findByText('0')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /Websites/ })).getByText('0')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /Connected Providers/ })).getByText('0')).toBeInTheDocument();
  });

  it('uses the loaded domain list for preview and its view-all count', async () => {
    renderPage();
    expect(await screen.findByText('example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View all 1 domains/ })).toHaveAttribute('href', '/domains');
  });

  it('highlights domains within the immediate renewal window', async () => {
    portfolio.fetchDomainsList.mockResolvedValue([{ ...domain, daysRemaining: 5, status: 'critical' }]);
    renderPage();
    expect(await screen.findByText('1 domain requires immediate renewal action')).toBeInTheDocument();
    expect(screen.getByText('example.com (5d left)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review & Renew/ })).toHaveAttribute('href', '/domains');
  });

  it('does not show a renewal warning for a domain outside the critical window', async () => {
    renderPage();
    await screen.findByText('example.com');
    expect(screen.queryByText(/requires immediate renewal action/)).not.toBeInTheDocument();
  });

  it('refreshes every portfolio source after provider sync succeeds', async () => {
    renderPage();
    await screen.findByText('example.com');
    fireEvent.click(screen.getByRole('button', { name: /Sync All Providers/ }));
    expect(await screen.findByText('Provider inventory refreshed.')).toBeInTheDocument();
    expect(portfolio.syncAllProviders).toHaveBeenCalledOnce();
    for (const load of [portfolio.fetchPortfolioSummary, portfolio.fetchDomainsList, portfolio.fetchServersList, portfolio.fetchApplicationsList]) {
      expect(load).toHaveBeenLastCalledWith({ forceRefresh: true });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByText('Provider inventory refreshed.')).not.toBeInTheDocument());
  });

  it('shows sync failure feedback and allows another attempt', async () => {
    portfolio.syncAllProviders.mockRejectedValue(new Error('Provider unavailable'));
    renderPage();
    await screen.findByText('example.com');
    fireEvent.click(screen.getByRole('button', { name: /Sync All Providers/ }));
    expect(await screen.findByText('Failed to sync provider resources.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync All Providers/ })).toBeEnabled();
  });

  it('greets the signed-in owner', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Welcome back, Test Owner' })).toBeInTheDocument();
    await screen.findByText('example.com');
  });

  it('falls back to the email username when the display name is blank', async () => {
    auth.user.displayName = '';
    renderPage();
    expect(screen.getByRole('heading', { name: 'Welcome back, owner' })).toBeInTheDocument();
    await screen.findByText('example.com');
  });
});
