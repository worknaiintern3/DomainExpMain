import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivitiesPage } from '@/pages/ActivitiesPage';

const { portfolio, monitoring, notifications } = vi.hoisted(() => ({
  portfolio: { fetchDomainsList: vi.fn(), fetchServersList: vi.fn(), fetchApplicationsList: vi.fn(), fetchWebsitesList: vi.fn() },
  monitoring: { listAlerts: vi.fn() },
  notifications: { listNotificationHistory: vi.fn() },
}));

vi.mock('@/services/portfolioService', () => portfolio);
vi.mock('@/api/monitoring', () => monitoring);
vi.mock('@/api/notifications', () => notifications);

const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

const renderPage = () => render(
  <MemoryRouter>
    <ActivitiesPage />
  </MemoryRouter>,
);

describe('ActivitiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    portfolio.fetchDomainsList.mockResolvedValue([{
      name: 'example.com', expiresAt: iso(5 * 86_400_000), daysRemaining: 5, id: 'domain-1',
    }]);
    portfolio.fetchServersList.mockResolvedValue([{
      id: 'server-1', name: 'Production API', status: 'healthy', cpuUsagePercent: 20, memoryUsagePercent: 30,
    }]);
    portfolio.fetchWebsitesList.mockResolvedValue([{
      id: 'site-1', name: 'Marketing site', url: 'https://example.com', status: 'healthy',
    }]);
    portfolio.fetchApplicationsList.mockResolvedValue([]);

    vi.mocked(monitoring.listAlerts).mockResolvedValue({
      items: [{
        detail: 'Certificate chain will expire in 4 days.',
        domainId: 'domain-1',
        firstSeenAt: iso(-300_000),
        id: 'alert-1',
        lastSeenAt: iso(-30_000),
        severity: 'CRITICAL',
        title: 'TLS certificate expires',
      }],
      nextCursor: null,
    });

    vi.mocked(notifications.listNotificationHistory).mockResolvedValue([{
      assetId: 'domain-1',
      assetName: 'example.com',
      assetType: 'domain',
      body: 'example.com expires in 7 days.',
      createdAt: iso(-90_000),
      expiryDate: iso(7 * 86_400_000),
      id: 'notification-1',
      isRead: true,
      readAt: iso(-80_000),
      reminderThreshold: 7,
      status: 'SENT',
      ticketId: null,
      title: 'Expiry reminder delivered',
    }]);
  });

  it('derives a feed from alerts, reminders, expiry warnings, and inventory updates', async () => {
    renderPage();

    expect(await screen.findByText('TLS certificate expires')).toBeInTheDocument();
    expect(await screen.findByText(/Domain Expiring Soon/i)).toBeInTheDocument();
    expect(await screen.findByText('Expiry reminder delivered')).toBeInTheDocument();
    expect(await screen.findByText('Server Active & Monitored')).toBeInTheDocument();
    expect(await screen.findByText('Website Monitored')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('dismisses a single activity and can clear the whole feed', async () => {
    renderPage();

    await screen.findByText('TLS certificate expires');
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss this activity' });
    const before = dismissButtons.length;
    fireEvent.click(dismissButtons[0]!);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Dismiss this activity' })).toHaveLength(before - 1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(await screen.findByText('All captured activities have been dismissed.')).toBeInTheDocument();
  });
});
