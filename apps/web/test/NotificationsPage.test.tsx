import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsPage } from '@/pages/NotificationsPage';

const { api } = vi.hoisted(() => ({
  api: {
    getNotificationPreferences: vi.fn(),
    listMonitoredExpiries: vi.fn(),
    listNotificationHistory: vi.fn(),
    markNotificationRead: vi.fn(),
    triggerExpiryCheck: vi.fn(),
    upsertMonitoredExpiry: vi.fn(),
    updateNotificationPreferences: vi.fn(),
  },
}));

vi.mock('@/api/notifications', () => api);

const preferences = {
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'prefs-1',
  notifyDomains: true,
  notifyHosting: true,
  notifyServers: true,
  notifySsl: true,
  preferredHour: 9,
  pushEnabled: true,
  reminderThresholds: [15, 7, 3, 1, 0],
  timeZone: 'UTC',
  updatedAt: '2026-01-01T00:00:00.000Z',
  userId: 'user-1',
  workspaceId: 'workspace-1',
};

const renderPage = () => render(
  <MemoryRouter>
    <NotificationsPage />
  </MemoryRouter>,
);

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getNotificationPreferences).mockResolvedValue(preferences);
    vi.mocked(api.updateNotificationPreferences).mockResolvedValue(preferences);
    vi.mocked(api.markNotificationRead).mockResolvedValue({ markedRead: true, ok: true });
    vi.mocked(api.listNotificationHistory).mockResolvedValue([
      {
        assetId: 'domain-1',
        assetName: 'example.com',
        assetType: 'domain',
        body: 'example.com expires in 7 days.',
        createdAt: '2026-10-20T10:00:00.000Z',
        expiryDate: '2026-10-27T00:00:00.000Z',
        id: 'notification-1',
        isRead: false,
        readAt: null,
        reminderThreshold: 7,
        status: 'SENT',
        ticketId: null,
        title: 'Domain expiring soon',
      },
    ]);
    vi.mocked(api.listMonitoredExpiries).mockResolvedValue([
      {
        assetName: 'monitored.example',
        assetType: 'domain',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-11-01T00:00:00.000Z',
        hostname: null,
        id: 'domain-2',
        provider: 'Cloudflare',
        reminderThresholds: [30, 7, 1],
        status: 'ACTIVE',
        timeZone: 'UTC',
        workspaceId: 'workspace-1',
      },
    ]);
    vi.mocked(api.triggerExpiryCheck).mockResolvedValue({
      assetsChecked: 2,
      completedAt: '2026-10-21T10:00:00.000Z',
      dryRun: true,
      errors: [],
      jobId: 'job-1',
      remindersIdentified: 1,
      remindersSent: 0,
      remindersSkippedAlreadySent: 0,
      remindersSkippedDisabled: 0,
      startedAt: '2026-10-21T09:59:59.000Z',
    });
  });

  it('loads preferences, history, and monitored expiries', async () => {
    renderPage();

    expect(await screen.findByText('Delivery preferences')).toBeInTheDocument();
    expect(await screen.findByText('Domain expiring soon')).toBeInTheDocument();
    expect(await screen.findByText('monitored.example')).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
    expect(screen.getByText('example.com expires in 7 days.')).toBeInTheDocument();
  });

  it('saves preference changes and marks a notification as read', async () => {
    renderPage();

    const domainsToggle = await screen.findByRole('checkbox', { name: /Domains/ });
    fireEvent.click(domainsToggle);
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() => {
      expect(api.updateNotificationPreferences).toHaveBeenCalledWith(expect.objectContaining({
        notifyDomains: false,
        pushEnabled: true,
      }));
    });
    expect(await screen.findByText('Notification preferences saved.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));

    await waitFor(() => {
      expect(api.markNotificationRead).toHaveBeenCalledWith('notification-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('1 unread')).not.toBeInTheDocument();
    });
  });

  it('runs a dry expiry check and reports the summary', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Preview check (dry run)' }));

    await waitFor(() => {
      expect(api.triggerExpiryCheck).toHaveBeenCalledWith({ dryRun: true });
    });
    expect(await screen.findByText('Dry run complete — no notifications were sent.')).toBeInTheDocument();
  });

  it('registers a monitored expiry using the existing API', async () => {
    vi.mocked(api.upsertMonitoredExpiry).mockResolvedValue({ id: 'domain-1' });
    renderPage();
    fireEvent.change(await screen.findByLabelText('Asset ID'), { target: { value: 'domain-1' } });
    fireEvent.change(screen.getByLabelText('Asset name'), { target: { value: 'example.com' } });
    fireEvent.change(screen.getByLabelText('Expiry date and time'), { target: { value: '2026-11-01T09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save monitored expiry' }));
    await waitFor(() => expect(api.upsertMonitoredExpiry).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'domain-1', assetType: 'domain', assetName: 'example.com',
    })));
    expect(await screen.findByText('Expiry registered for monitoring.')).toBeInTheDocument();
  });
});
