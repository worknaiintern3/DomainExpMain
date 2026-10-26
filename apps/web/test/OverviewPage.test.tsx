import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/AuthContext';
import { ApiError } from '@/api/client';
import { OverviewPage } from '@/pages/OverviewPage';

const { apiRequest } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return {
    ...actual,
    apiRequest,
  };
});

const EMPTY_SUMMARY = {
  applications: 0,
  cloudResources: 0,
  domains: 0,
  emailAccounts: 0,
  projects: 0,
  providerAccounts: 0,
  servers: 0,
};

function renderOverviewPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <OverviewPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('OverviewPage', () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders true workspace-wide totals, not a bounded page count', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/inventory/summary') {
        return Promise.resolve({
          applications: 3,
          cloudResources: 12,
          domains: 42,
          emailAccounts: 5,
          projects: 2,
          providerAccounts: 4,
          servers: 30,
        });
      }
      if (path === '/alerts/summary') {
        return Promise.resolve({ open: 2 });
      }
      if (path === '/provider-connections') {
        return Promise.resolve({ items: [] });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderOverviewPage();

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText('Domains')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    // The old "bounded page" / "first N loaded" language must be gone.
    expect(screen.queryByText(/bounded snapshot/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/more available/iu)).not.toBeInTheDocument();
    expect(screen.getAllByText(/workspace-wide totals/iu).length).toBeGreaterThan(0);
  });

  it('shows a genuine empty state when every true total is zero, not fake data', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/inventory/summary') return Promise.resolve(EMPTY_SUMMARY);
      if (path === '/alerts/summary') return Promise.resolve({ open: 0 });
      if (path === '/provider-connections') return Promise.resolve({ items: [] });
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderOverviewPage();

    await waitFor(() => expect(screen.getByText('Your inventory is empty')).toBeInTheDocument());
    expect(screen.getByText('No open alerts.')).toBeInTheDocument();
  });

  it('renders the Mongo backend partial summary without NaN or invented account totals', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/inventory/summary') {
        return Promise.resolve({ domains: 4, servers: 2, applications: 1, cloudResources: 0, alerts: 0 });
      }
      if (path === '/alerts/summary') {
        return Promise.reject(new ApiError({ detail: 'Not found', status: 404, title: 'Not Found' }));
      }
      if (path === '/alerts?limit=100&status=OPEN') {
        return Promise.resolve({ items: [{ id: 'one' }, { id: 'two' }], nextCursor: null });
      }
      if (path === '/provider-connections') return Promise.resolve({ items: [] });
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderOverviewPage();

    await waitFor(() => expect(screen.getByText('Connected inventory')).toBeInTheDocument());
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    expect(screen.queryByText('Provider accounts')).not.toBeInTheDocument();
    expect(screen.queryByText('Cloud resources')).not.toBeInTheDocument();
    expect(screen.getByText(/Other totals are unavailable from this backend/u)).toBeInTheDocument();
    expect(await screen.findByText('2 open alerts.')).toBeInTheDocument();
  });

  it('fills missing Mongo summary totals from every inventory page', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/inventory/summary') return Promise.resolve({ domains: 4, servers: 2, applications: 1, cloudResources: 0 });
      if (path === '/alerts/summary') return Promise.resolve({ open: 0 });
      if (path === '/provider-connections') return Promise.resolve({ items: [] });
      if (path.startsWith('/projects?') && path.includes('cursor=')) return Promise.resolve({ items: [{ id: 'p2' }], nextCursor: null });
      if (path.startsWith('/projects?')) return Promise.resolve({ items: [{ id: 'p1' }], nextCursor: 'next' });
      if (path.startsWith('/provider-accounts?')) return Promise.resolve({ items: [{ id: 'a1' }], nextCursor: null });
      if (path.startsWith('/email-accounts?')) return Promise.resolve({ items: [], nextCursor: null });
      if (path.startsWith('/cloud-resources?')) return Promise.resolve({ items: [{ id: 'c1' }], nextCursor: null });
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderOverviewPage();

    await waitFor(() => expect(screen.getByText('Cloud resources')).toBeInTheDocument());
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Provider accounts')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /2 Projects/ })).toBeInTheDocument();
  });

  it('surfaces the true open-alert count from the summary endpoint', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/inventory/summary') return Promise.resolve({ ...EMPTY_SUMMARY, domains: 1 });
      if (path === '/alerts/summary') return Promise.resolve({ open: 7 });
      if (path === '/provider-connections') return Promise.resolve({ items: [] });
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderOverviewPage();

    await waitFor(() => expect(screen.getByText('7 open alerts.')).toBeInTheDocument());
  });

  it('distinguishes live provider connection health from manual provider-account inventory', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/inventory/summary') return Promise.resolve({ ...EMPTY_SUMMARY, providerAccounts: 4 });
      if (path === '/alerts/summary') return Promise.resolve({ open: 0 });
      if (path === '/provider-connections') {
        return Promise.resolve({
          items: [
            { connectionStatus: 'CONNECTED', syncStatus: 'SUCCESS', validationStatus: 'VALID' },
            { connectionStatus: 'DISCONNECTED', syncStatus: 'IDLE', validationStatus: 'INVALID' },
            { connectionStatus: 'CONNECTED', syncStatus: 'FAILED', validationStatus: 'VALID' },
          ],
        });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderOverviewPage();

    await waitFor(() =>
      expect(screen.getByText('2 of 3 live provider connections connected.')).toBeInTheDocument(),
    );
    expect(screen.getByText(/1 connection disconnected or failing credential validation\./iu)).toBeInTheDocument();
    expect(screen.getByText(/1 connection with a failed sync\./iu)).toBeInTheDocument();
    expect(screen.getByText(/distinct from the manually tracked/iu)).toBeInTheDocument();
  });

  it('describes DNS/TLS accurately instead of claiming it is not connected', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/inventory/summary') return Promise.resolve(EMPTY_SUMMARY);
      if (path === '/alerts/summary') return Promise.resolve({ open: 0 });
      if (path === '/provider-connections') return Promise.resolve({ items: [] });
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderOverviewPage();

    await waitFor(() => expect(screen.getByText('Your inventory is empty')).toBeInTheDocument());
    expect(screen.queryByText(/DNS, TLS, .* are not connected yet/iu)).not.toBeInTheDocument();
    expect(screen.getByText(/DNS and TLS metadata is available per domain/iu)).toBeInTheDocument();
    expect(screen.getByText(/not aggregated workspace-wide/iu)).toBeInTheDocument();
  });

  it('describes pricing, purchases, billing and renewals truthfully', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/inventory/summary') return Promise.resolve(EMPTY_SUMMARY);
      if (path === '/alerts/summary') return Promise.resolve({ open: 0 });
      if (path === '/provider-connections') return Promise.resolve({ items: [] });
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderOverviewPage();

    await waitFor(() => expect(screen.getByText('Your inventory is empty')).toBeInTheDocument());
    expect(
      screen.getByText(/Domain pricing is available through supported registrar APIs/iu),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Purchases, billing, and automatic renewals are handled externally by your registrars and are not managed by DomainPulse/iu,
      ),
    ).toBeInTheDocument();
    // The stale claim that pricing is not connected to any backend is gone.
    expect(screen.queryByText(/pricing, and billing analytics are not connected/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/not connected to any backend/iu)).not.toBeInTheDocument();
  });

  it('shows an error state, not silently fabricated data, when the summary call fails', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/inventory/summary') return Promise.reject(new Error('Inventory summary boom'));
      if (path === '/alerts/summary') return Promise.resolve({ open: 0 });
      if (path === '/provider-connections') return Promise.resolve({ items: [] });
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderOverviewPage();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Inventory summary boom')).toBeInTheDocument();
  });
});
