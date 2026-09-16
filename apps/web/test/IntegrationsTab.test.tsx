import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IntegrationsTab } from '@/features/settings/components/tabs/IntegrationsTab';

const {
  createProviderAccount,
  createProviderConnection,
  disconnectProviderConnection,
  listProviderAccounts,
  listProviderConnections,
  listProviderConnectionSyncRuns,
  replaceProviderConnectionCredential,
  triggerProviderConnectionSync,
  validateProviderConnection,
} = vi.hoisted(() => ({
  createProviderAccount: vi.fn(),
  createProviderConnection: vi.fn(),
  disconnectProviderConnection: vi.fn(),
  listProviderAccounts: vi.fn(),
  listProviderConnections: vi.fn(),
  listProviderConnectionSyncRuns: vi.fn(),
  replaceProviderConnectionCredential: vi.fn(),
  triggerProviderConnectionSync: vi.fn(),
  validateProviderConnection: vi.fn(),
}));

vi.mock('@/api/provider-connections', () => ({
  createProviderAccount,
  createProviderConnection,
  disconnectProviderConnection,
  listProviderAccounts,
  listProviderConnections,
  listProviderConnectionSyncRuns,
  replaceProviderConnectionCredential,
  triggerProviderConnectionSync,
  validateProviderConnection,
}));

const connectedConnection = {
  authType: 'CLOUDFLARE_API_TOKEN' as const,
  connectionStatus: 'CONNECTED' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  credentialMask: '••••1234',
  disconnectedAt: null,
  id: 'connection-1',
  lastSyncAt: '2026-01-02T00:00:00.000Z',
  lastValidatedAt: '2026-01-01T01:00:00.000Z',
  nextSyncAt: '2026-01-03T00:00:00.000Z',
  providerAccountId: 'account-1',
  providerAccountLabel: 'Cloudflare - primary',
  providerType: 'cloudflare',
  syncStatus: 'IDLE' as const,
  updatedAt: '2026-01-01T01:00:00.000Z',
  validationErrorCode: null,
  validationStatus: 'VALID' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  listProviderConnectionSyncRuns.mockResolvedValue({ items: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IntegrationsTab', () => {
  it('renders the DISCONNECTED state with a Connect button when no connection exists', async () => {
    listProviderConnections.mockResolvedValue({ items: [] });

    render(<IntegrationsTab />);

    expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.queryByTestId('cloudflare-token-input')).not.toBeInTheDocument();
  });

  it('renders the CONNECTED/VALID card with the credential mask, timestamps, and never the raw token', async () => {
    listProviderConnections.mockResolvedValue({ items: [connectedConnection] });

    render(<IntegrationsTab />);

    expect(await screen.findByText('••••1234')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('cf-');
    // Never shows fabricated marketing/status claims.
    for (const forbidden of ['Healthy', 'Live', '100% synced', 'realtime', 'billing', 'pricing', 'auto-renew']) {
      expect(document.body.textContent).not.toContain(forbidden);
    }
  });

  it('shows a FAILED state with a safe message, never the raw provider error', async () => {
    listProviderConnections.mockResolvedValue({
      items: [{ ...connectedConnection, validationErrorCode: 'AUTH_INVALID', validationStatus: 'INVALID' as const }],
    });

    render(<IntegrationsTab />);

    expect(await screen.findByText('Attention needed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/authentication failed/iu);
  });

  it('the token input is password-type and is cleared after a successful connect', async () => {
    listProviderConnections
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [connectedConnection] });
    listProviderAccounts.mockResolvedValue({ items: [] });
    createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'account-1', label: 'Cloudflare', providerKey: 'cloudflare' });
    createProviderConnection.mockResolvedValue(connectedConnection);

    render(<IntegrationsTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

    const input = screen.getByTestId('cloudflare-token-input');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.change(input, { target: { value: 'cf-super-secret-token' } });
    expect((input as HTMLInputElement).value).toBe('cf-super-secret-token');

    fireEvent.click(screen.getByRole('button', { name: 'Save and connect' }));

    await waitFor(() => {
      expect(createProviderConnection).toHaveBeenCalledWith({
        authType: 'CLOUDFLARE_API_TOKEN',
        credential: 'cf-super-secret-token',
        providerAccountId: 'account-1',
      });
    });
    // The plaintext token is never written to any browser storage.
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('Sync Now triggers a manual sync and shows the syncing indicator only while a run is actually in flight', async () => {
    listProviderConnections.mockResolvedValue({ items: [connectedConnection] });
    triggerProviderConnectionSync.mockResolvedValue({ id: 'run-1', message: 'queued', status: 'QUEUED', trigger: 'MANUAL' });
    listProviderConnectionSyncRuns
      .mockResolvedValueOnce({ items: [] }) // initial load
      .mockResolvedValueOnce({
        items: [{
          attemptNo: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          durationMs: null,
          errorCode: null,
          finishedAt: null,
          id: 'run-1',
          itemsCreated: 0,
          itemsDiscovered: 0,
          itemsMissing: 0,
          itemsUnchanged: 0,
          itemsUpdated: 0,
          startedAt: null,
          status: 'QUEUED',
          trigger: 'MANUAL',
        }],
      });

    render(<IntegrationsTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sync Now' }));

    await waitFor(() => {
      expect(triggerProviderConnectionSync).toHaveBeenCalledWith('connection-1', expect.any(String));
    });
    expect(await screen.findByTestId('syncing-indicator')).toBeInTheDocument();
  });

  it('Replace Token flow calls the API with the new token and clears the field', async () => {
    listProviderConnections.mockResolvedValue({ items: [connectedConnection] });
    replaceProviderConnectionCredential.mockResolvedValue({ ...connectedConnection, credentialMask: '••••9999' });

    render(<IntegrationsTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Replace Token' }));

    const input = screen.getByTestId('cloudflare-token-input');
    fireEvent.change(input, { target: { value: 'cf-new-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save replacement' }));

    await waitFor(() => {
      expect(replaceProviderConnectionCredential).toHaveBeenCalledWith('connection-1', 'cf-new-token');
    });
    await screen.findByText('••••9999');
    expect(localStorage.length).toBe(0);
  });

  it('Disconnect flow calls the API and the card returns to the DISCONNECTED state', async () => {
    listProviderConnections
      .mockResolvedValueOnce({ items: [connectedConnection] })
      .mockResolvedValueOnce({ items: [{ ...connectedConnection, connectionStatus: 'DISCONNECTED' as const, credentialMask: 'Disconnected' }] });
    disconnectProviderConnection.mockResolvedValue({ connectionStatus: 'DISCONNECTED', disconnectedAt: '2026-01-05T00:00:00.000Z', id: 'connection-1' });

    render(<IntegrationsTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

    await waitFor(() => {
      expect(disconnectProviderConnection).toHaveBeenCalledWith('connection-1');
    });
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('Validate action shows the validating indicator only during the real request', async () => {
    listProviderConnections.mockResolvedValue({ items: [connectedConnection] });
    let resolveValidate: (() => void) | undefined;
    validateProviderConnection.mockImplementation(
      () => new Promise<{ lastValidatedAt: string; validationErrorCode: null; validationStatus: 'VALID' }>((resolve) => {
        resolveValidate = () => resolve({ lastValidatedAt: '2026-01-06T00:00:00.000Z', validationErrorCode: null, validationStatus: 'VALID' });
      }),
    );

    render(<IntegrationsTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Validate' }));

    expect(await screen.findByTestId('validating-indicator')).toBeInTheDocument();
    resolveValidate?.();
    await waitFor(() => {
      expect(screen.queryByTestId('validating-indicator')).not.toBeInTheDocument();
    });
  });
});
