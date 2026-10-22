import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivitiesPage } from '@/pages/ActivitiesPage';

const { inventory, monitoring, notifications } = vi.hoisted(() => ({
  inventory: { listInventory: vi.fn() },
  monitoring: { listAlerts: vi.fn() },
  notifications: { listNotificationHistory: vi.fn() },
}));

vi.mock('@/api/inventory', () => inventory);
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

    vi.mocked(inventory.listInventory).mockImplementation(async (resource: string) => {
      if (resource === 'domains') {
        return {
          items: [{
            domainName: 'example.com',
            expiresAt: iso(5 * 86_400_000),
            id: 'domain-1',
            provenance: 'RDAP_RETRIEVED',
            updatedAt: iso(-60_000),
          }],
          nextCursor: null,
        };
      }
      if (resource === 'servers') {
        return {
          items: [{
            hostname: 'api.example.com',
            id: 'server-1',
            name: 'Production API',
            primaryIp: '203.0.113.10',
            provenance: 'PROVIDER_API',
            updatedAt: iso(-120_000),
          }],
          nextCursor: null,
        };
      }
      return {
        items: [{
          id: 'app-1',
          kind: 'WEBSITE',
          name: 'Marketing site',
          primaryUrl: 'https://example.com',
          updatedAt: iso(-180_000),
        }],
        nextCursor: null,
      };
    });

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
    expect(await screen.findByText('Domain expiring soon')).toBeInTheDocument();
    expect(await screen.findByText('Expiry reminder delivered')).toBeInTheDocument();
    expect(await screen.findByText('Server record updated')).toBeInTheDocument();
    expect(await screen.findByText('Application record updated')).toBeInTheDocument();
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
