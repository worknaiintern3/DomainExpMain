import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLayout } from '../src/components/AdminLayout';
import { ThemeProvider } from '../src/context/ThemeContext';
import { PlatformOverviewPage } from '../src/pages/PlatformOverviewPage';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const stats = {
  totalUsers: 17, webUsersCount: 10, mobileUsersCount: 7, bothUsersCount: 0,
  totalDomains: 4, activeDomains: 4, expiringSoonDomains: 0,
  totalServers: 2, healthyServers: 2, totalApplications: 3, totalProviders: 1,
  mobileDevicesTotal: 7, iosDevicesCount: 2, androidDevicesCount: 5,
  announcementsCount: 0, recentAuditLogs: [],
  systemHealth: { status: 'operational', uptime: '99.9%', apiLatency: '12ms', databaseStatus: 'ok', workerStatus: 'ok' },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('admin session and overview recovery', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const renderAdmin = async () => {
    await act(async () => {
      root.render(<MemoryRouter><ThemeProvider><AdminLayout><PlatformOverviewPage /></AdminLayout></ThemeProvider></MemoryRouter>);
    });
  };

  it('shows a working sign-in action without requesting protected data when signed out', async () => {
    await renderAdmin();
    expect(getByRole(container, 'heading', { name: 'Sign in to Admin Center' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Aggregating cross-platform metrics');
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Sign in', exact: true })));
    expect(getByRole(container, 'heading', { name: 'Admin Authentication & Live Backend Link' })).toBeTruthy();
  });

  it('returns an expired session to sign-in instead of an endless loader', async () => {
    localStorage.setItem('domainpulse_admin_token', 'expired-session');
    fetchMock.mockResolvedValue(json({ detail: 'Authentication required' }, 401));
    await renderAdmin();
    expect(getByRole(container, 'heading', { name: 'Sign in to Admin Center' })).toBeTruthy();
    expect(localStorage.getItem('domainpulse_admin_token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Aggregating cross-platform metrics');
  });

  it('shows an error after a server failure and recovers when retried', async () => {
    localStorage.setItem('domainpulse_admin_token', 'admin-session');
    fetchMock.mockResolvedValueOnce(json({ detail: 'Service temporarily unavailable' }, 503)).mockResolvedValueOnce(json(stats));
    await renderAdmin();
    expect(getByRole(container, 'alert').textContent).toContain('Service temporarily unavailable');
    expect(container.textContent).not.toContain('Aggregating cross-platform metrics');
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Try again' })));
    expect(getByRole(container, 'heading', { name: 'Platform Command Center' })).toBeTruthy();
    expect(queryByRole(container, 'alert')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows permission errors without hiding them behind a loader', async () => {
    localStorage.setItem('domainpulse_admin_token', 'regular-user-session');
    fetchMock.mockResolvedValue(json({ detail: 'Forbidden: Requires platform role SUPER_ADMIN or ADMIN' }, 403));
    await renderAdmin();
    expect(getByRole(container, 'alert').textContent).toContain('Requires platform role');
    expect(container.textContent).not.toContain('Aggregating cross-platform metrics');
  });

  it('ends a stalled request after 15 seconds and offers retry', async () => {
    vi.useFakeTimers();
    localStorage.setItem('domainpulse_admin_token', 'admin-session');
    fetchMock.mockImplementation((_path, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    await renderAdmin();
    expect(getByRole(container, 'status').textContent).toContain('Aggregating');
    await act(async () => { await vi.advanceTimersByTimeAsync(15_001); });
    expect(getByRole(container, 'alert').textContent).toContain('request timed out');
    expect(getByRole(container, 'button', { name: 'Try again' })).toBeTruthy();
  });
});
