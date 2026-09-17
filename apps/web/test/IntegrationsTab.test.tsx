import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function cloudflareCard(): HTMLElement {
  return screen.getByTestId('cloudflare-integration-card');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  listProviderConnectionSyncRuns.mockResolvedValue({ items: [] });
  listProviderAccounts.mockResolvedValue({ items: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IntegrationsTab', () => {
  it('renders a card for every supported provider (Cloudflare, GoDaddy, Namecheap, Hostinger, DigitalOcean, Hetzner, Vultr, Linode, AWS, GCP, Azure)', async () => {
    listProviderConnections.mockResolvedValue({ items: [] });

    render(<IntegrationsTab />);

    for (const providerKey of [
      'cloudflare', 'godaddy', 'namecheap', 'hostinger',
      'digitalocean', 'hetzner', 'vultr', 'linode',
      'aws', 'gcp', 'azure',
    ]) {
      expect(await screen.findByTestId(`${providerKey}-integration-card`)).toBeInTheDocument();
    }
  });

  it('renders the DISCONNECTED state with a Connect button when no connection exists', async () => {
    listProviderConnections.mockResolvedValue({ items: [] });

    render(<IntegrationsTab />);

    expect(await within(cloudflareCard()).findByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.queryByTestId('cloudflare-token-input')).not.toBeInTheDocument();
  });

  it('renders the CONNECTED/VALID card with the credential mask, timestamps, and never the raw token', async () => {
    listProviderConnections.mockResolvedValue({ items: [connectedConnection] });

    render(<IntegrationsTab />);

    expect(await within(cloudflareCard()).findByText('••••1234')).toBeInTheDocument();
    expect(within(cloudflareCard()).getByText('Connected')).toBeInTheDocument();
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

    expect(await within(cloudflareCard()).findByText('Attention needed')).toBeInTheDocument();
    expect(within(cloudflareCard()).getByRole('alert')).toHaveTextContent(/authentication failed/iu);
  });

  it('the token input is password-type and is cleared after a successful connect', async () => {
    listProviderConnections
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({ items: [connectedConnection] });
    createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'account-1', label: 'Cloudflare', providerKey: 'cloudflare' });
    createProviderConnection.mockResolvedValue(connectedConnection);

    render(<IntegrationsTab />);
    fireEvent.click(await within(cloudflareCard()).findByRole('button', { name: 'Connect' }));

    const input = screen.getByTestId('cloudflare-token-input');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.change(input, { target: { value: 'cf-super-secret-token' } });
    expect((input as HTMLInputElement).value).toBe('cf-super-secret-token');

    fireEvent.click(within(cloudflareCard()).getByRole('button', { name: 'Save and connect' }));

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
    fireEvent.click(await within(cloudflareCard()).findByRole('button', { name: 'Sync Now' }));

    await waitFor(() => {
      expect(triggerProviderConnectionSync).toHaveBeenCalledWith('connection-1', expect.any(String));
    });
    expect(await within(cloudflareCard()).findByTestId('syncing-indicator')).toBeInTheDocument();
  });

  it('Replace Credential flow calls the API with the new token and clears the field', async () => {
    listProviderConnections.mockResolvedValue({ items: [connectedConnection] });
    replaceProviderConnectionCredential.mockResolvedValue({ ...connectedConnection, credentialMask: '••••9999' });

    render(<IntegrationsTab />);
    fireEvent.click(await within(cloudflareCard()).findByRole('button', { name: 'Replace Credential' }));

    const input = screen.getByTestId('cloudflare-token-input');
    fireEvent.change(input, { target: { value: 'cf-new-token' } });
    fireEvent.click(within(cloudflareCard()).getByRole('button', { name: 'Save replacement' }));

    await waitFor(() => {
      expect(replaceProviderConnectionCredential).toHaveBeenCalledWith('connection-1', 'cf-new-token');
    });
    await within(cloudflareCard()).findByText('••••9999');
    expect(localStorage.length).toBe(0);
  });

  it('Disconnect flow calls the API and the card returns to the DISCONNECTED state', async () => {
    listProviderConnections
      .mockResolvedValueOnce({ items: [connectedConnection] })
      .mockResolvedValue({ items: [{ ...connectedConnection, connectionStatus: 'DISCONNECTED' as const, credentialMask: 'Disconnected' }] });
    disconnectProviderConnection.mockResolvedValue({ connectionStatus: 'DISCONNECTED', disconnectedAt: '2026-01-05T00:00:00.000Z', id: 'connection-1' });

    render(<IntegrationsTab />);
    fireEvent.click(await within(cloudflareCard()).findByRole('button', { name: 'Disconnect' }));

    await waitFor(() => {
      expect(disconnectProviderConnection).toHaveBeenCalledWith('connection-1');
    });
    expect(await within(cloudflareCard()).findByRole('button', { name: 'Connect' })).toBeInTheDocument();
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
    fireEvent.click(await within(cloudflareCard()).findByRole('button', { name: 'Validate' }));

    expect(await within(cloudflareCard()).findByTestId('validating-indicator')).toBeInTheDocument();
    resolveValidate?.();
    await waitFor(() => {
      expect(within(cloudflareCard()).queryByTestId('validating-indicator')).not.toBeInTheDocument();
    });
  });

  describe('GoDaddy', () => {
    function godaddyCard(): HTMLElement {
      return screen.getByTestId('godaddy-integration-card');
    }

    it('connects with a single PAT field and never persists it to storage', async () => {
      // handleConnect uses createProviderConnection's own return value
      // (setConnection(created)), never a re-fetch, so listProviderConnections
      // can stay empty throughout -- avoids racing the other 3 cards' own
      // concurrent initial-load calls against a shared once-only mock.
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'gd-account-1', label: 'GoDaddy', providerKey: 'godaddy' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'GODADDY_PAT' as const, id: 'gd-1', providerType: 'godaddy' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(godaddyCard()).findByRole('button', { name: 'Connect' }));

      const input = screen.getByTestId('godaddy-token-input');
      expect(input).toHaveAttribute('type', 'password');
      fireEvent.change(input, { target: { value: 'godaddy-secret-pat' } });
      fireEvent.click(within(godaddyCard()).getByRole('button', { name: 'Save and connect' }));

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'GODADDY_PAT',
          credential: 'godaddy-secret-pat',
          providerAccountId: 'gd-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('Hostinger', () => {
    function hostingerCard(): HTMLElement {
      return screen.getByTestId('hostinger-integration-card');
    }

    it('connects with a single API token field and never persists it to storage', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'ho-account-1', label: 'Hostinger', providerKey: 'hostinger' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'HOSTINGER_API_TOKEN' as const, id: 'ho-1', providerType: 'hostinger' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(hostingerCard()).findByRole('button', { name: 'Connect' }));

      const input = screen.getByTestId('hostinger-token-input');
      fireEvent.change(input, { target: { value: 'hostinger-secret-token' } });
      fireEvent.click(within(hostingerCard()).getByRole('button', { name: 'Save and connect' }));

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'HOSTINGER_API_TOKEN',
          credential: 'hostinger-secret-token',
          providerAccountId: 'ho-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('DigitalOcean', () => {
    function digitaloceanCard(): HTMLElement {
      return screen.getByTestId('digitalocean-integration-card');
    }

    it('connects with a single API token field and never persists it to storage', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'do-account-1', label: 'DigitalOcean', providerKey: 'digitalocean' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'DIGITALOCEAN_API_TOKEN' as const, id: 'do-1', providerType: 'digitalocean' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(digitaloceanCard()).findByRole('button', { name: 'Connect' }));

      const input = screen.getByTestId('digitalocean-token-input');
      expect(input).toHaveAttribute('type', 'password');
      fireEvent.change(input, { target: { value: 'digitalocean-secret-token' } });
      fireEvent.click(within(digitaloceanCard()).getByRole('button', { name: 'Save and connect' }));

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'DIGITALOCEAN_API_TOKEN',
          credential: 'digitalocean-secret-token',
          providerAccountId: 'do-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('Hetzner', () => {
    function hetznerCard(): HTMLElement {
      return screen.getByTestId('hetzner-integration-card');
    }

    it('connects with a single API token field and never persists it to storage', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'hz-account-1', label: 'Hetzner', providerKey: 'hetzner' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'HETZNER_API_TOKEN' as const, id: 'hz-1', providerType: 'hetzner' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(hetznerCard()).findByRole('button', { name: 'Connect' }));

      const input = screen.getByTestId('hetzner-token-input');
      expect(input).toHaveAttribute('type', 'password');
      fireEvent.change(input, { target: { value: 'hetzner-secret-token' } });
      fireEvent.click(within(hetznerCard()).getByRole('button', { name: 'Save and connect' }));

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'HETZNER_API_TOKEN',
          credential: 'hetzner-secret-token',
          providerAccountId: 'hz-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('Vultr', () => {
    function vultrCard(): HTMLElement {
      return screen.getByTestId('vultr-integration-card');
    }

    it('connects with a single API key field and never persists it to storage', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'vu-account-1', label: 'Vultr', providerKey: 'vultr' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'VULTR_API_KEY' as const, id: 'vu-1', providerType: 'vultr' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(vultrCard()).findByRole('button', { name: 'Connect' }));

      const input = screen.getByTestId('vultr-token-input');
      expect(input).toHaveAttribute('type', 'password');
      fireEvent.change(input, { target: { value: 'vultr-secret-key' } });
      fireEvent.click(within(vultrCard()).getByRole('button', { name: 'Save and connect' }));

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'VULTR_API_KEY',
          credential: 'vultr-secret-key',
          providerAccountId: 'vu-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('Linode', () => {
    function linodeCard(): HTMLElement {
      return screen.getByTestId('linode-integration-card');
    }

    it('connects with a single API token field and never persists it to storage', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'li-account-1', label: 'Linode (Akamai)', providerKey: 'linode' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'LINODE_API_TOKEN' as const, id: 'li-1', providerType: 'linode' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(linodeCard()).findByRole('button', { name: 'Connect' }));

      const input = screen.getByTestId('linode-token-input');
      expect(input).toHaveAttribute('type', 'password');
      fireEvent.change(input, { target: { value: 'linode-secret-token' } });
      fireEvent.click(within(linodeCard()).getByRole('button', { name: 'Save and connect' }));

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'LINODE_API_TOKEN',
          credential: 'linode-secret-token',
          providerAccountId: 'li-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('Namecheap', () => {
    function namecheapCard(): HTMLElement {
      return screen.getByTestId('namecheap-integration-card');
    }

    it('serializes the four fields into the exact JSON credential shape the backend expects, and the submit button stays disabled until all four are filled', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'nc-account-1', label: 'Namecheap', providerKey: 'namecheap' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'NAMECHEAP_API_KEY' as const, id: 'nc-1', providerType: 'namecheap' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(namecheapCard()).findByRole('button', { name: 'Connect' }));

      const submit = within(namecheapCard()).getByRole('button', { name: 'Save and connect' });
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByTestId('namecheap-namecheap-api-user'), { target: { value: 'nc-user' } });
      fireEvent.change(screen.getByTestId('namecheap-namecheap-api-key'), { target: { value: 'nc-key' } });
      expect(submit).toBeDisabled(); // still missing username/clientIp
      fireEvent.change(screen.getByTestId('namecheap-namecheap-username'), { target: { value: 'nc-user' } });
      fireEvent.change(screen.getByTestId('namecheap-namecheap-client-ip'), { target: { value: '203.0.113.10' } });
      expect(submit).not.toBeDisabled();

      fireEvent.click(submit);

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'NAMECHEAP_API_KEY',
          credential: JSON.stringify({
            apiKey: 'nc-key',
            apiUser: 'nc-user',
            clientIp: '203.0.113.10',
            userName: 'nc-user',
          }),
          providerAccountId: 'nc-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });

    it('never shows a raw JSON credential mask fragment (e.g. a `"}` tail) -- the backend\'s generic mask is displayed verbatim', async () => {
      listProviderConnections.mockResolvedValue({
        items: [{ ...connectedConnection, authType: 'NAMECHEAP_API_KEY' as const, credentialMask: 'Configured', id: 'nc-1', providerType: 'namecheap' }],
      });

      render(<IntegrationsTab />);

      expect(await within(namecheapCard()).findByText('Configured')).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/"\}/u);
    });
  });

  describe('AWS', () => {
    function awsCard(): HTMLElement {
      return screen.getByTestId('aws-integration-card');
    }

    it('serializes access key/secret/regions into the exact JSON credential shape, omits a blank optional session token, and stays disabled until required fields are filled', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'aws-account-1', label: 'AWS', providerKey: 'aws' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'AWS_ACCESS_KEY' as const, id: 'aws-1', providerType: 'aws' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(awsCard()).findByRole('button', { name: 'Connect' }));

      const submit = within(awsCard()).getByRole('button', { name: 'Save and connect' });
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByTestId('aws-accessKeyId-input'), { target: { value: 'AKIAEXAMPLE12345678' } });
      expect(submit).toBeDisabled(); // still missing secret/regions
      fireEvent.change(screen.getByTestId('aws-secretAccessKey-input'), { target: { value: 'super-secret-key' } });
      fireEvent.change(screen.getByTestId('aws-regions-input'), { target: { value: 'us-east-1, eu-west-1' } });
      // The session token field is optional and never blocks submission.
      expect(submit).not.toBeDisabled();

      fireEvent.click(submit);

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'AWS_ACCESS_KEY',
          credential: JSON.stringify({
            accessKeyId: 'AKIAEXAMPLE12345678',
            regions: ['us-east-1', 'eu-west-1'],
            secretAccessKey: 'super-secret-key',
          }),
          providerAccountId: 'aws-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });

    it('includes a filled-in session token in the serialized credential', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'aws-account-1', label: 'AWS', providerKey: 'aws' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'AWS_ACCESS_KEY' as const, id: 'aws-1', providerType: 'aws' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(awsCard()).findByRole('button', { name: 'Connect' }));

      fireEvent.change(screen.getByTestId('aws-accessKeyId-input'), { target: { value: 'AKIAEXAMPLE12345678' } });
      fireEvent.change(screen.getByTestId('aws-secretAccessKey-input'), { target: { value: 'super-secret-key' } });
      fireEvent.change(screen.getByTestId('aws-sessionToken-input'), { target: { value: 'temp-session-token' } });
      fireEvent.change(screen.getByTestId('aws-regions-input'), { target: { value: 'us-east-1' } });
      fireEvent.click(within(awsCard()).getByRole('button', { name: 'Save and connect' }));

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'AWS_ACCESS_KEY',
          credential: JSON.stringify({
            accessKeyId: 'AKIAEXAMPLE12345678',
            regions: ['us-east-1'],
            secretAccessKey: 'super-secret-key',
            sessionToken: 'temp-session-token',
          }),
          providerAccountId: 'aws-account-1',
        });
      });
    });
  });

  describe('Google Cloud', () => {
    function gcpCard(): HTMLElement {
      return screen.getByTestId('gcp-integration-card');
    }

    it('serializes project/email/private key into the exact JSON credential shape via the multi-line key field', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'gcp-account-1', label: 'Google Cloud', providerKey: 'gcp' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'GCP_SERVICE_ACCOUNT_KEY' as const, id: 'gcp-1', providerType: 'gcp' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(gcpCard()).findByRole('button', { name: 'Connect' }));

      const submit = within(gcpCard()).getByRole('button', { name: 'Save and connect' });
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByTestId('gcp-projectId-input'), { target: { value: 'my-test-project' } });
      fireEvent.change(screen.getByTestId('gcp-clientEmail-input'), {
        target: { value: 'sa@my-test-project.iam.gserviceaccount.com' },
      });
      expect(submit).toBeDisabled(); // still missing the private key
      fireEvent.change(screen.getByTestId('gcp-privateKey-input'), {
        target: { value: '-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----' },
      });
      expect(submit).not.toBeDisabled();

      fireEvent.click(submit);

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'GCP_SERVICE_ACCOUNT_KEY',
          credential: JSON.stringify({
            clientEmail: 'sa@my-test-project.iam.gserviceaccount.com',
            privateKey: '-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----',
            projectId: 'my-test-project',
          }),
          providerAccountId: 'gcp-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('Azure', () => {
    function azureCard(): HTMLElement {
      return screen.getByTestId('azure-integration-card');
    }

    it('serializes tenant/client/secret/subscription into the exact JSON credential shape', async () => {
      listProviderConnections.mockResolvedValue({ items: [] });
      createProviderAccount.mockResolvedValue({ externalAccountId: null, id: 'azure-account-1', label: 'Azure', providerKey: 'azure' });
      createProviderConnection.mockResolvedValue({ ...connectedConnection, authType: 'AZURE_CLIENT_CREDENTIALS' as const, id: 'azure-1', providerType: 'azure' });

      render(<IntegrationsTab />);
      fireEvent.click(await within(azureCard()).findByRole('button', { name: 'Connect' }));

      const submit = within(azureCard()).getByRole('button', { name: 'Save and connect' });
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByTestId('azure-tenantId-input'), { target: { value: '11111111-1111-1111-1111-111111111111' } });
      fireEvent.change(screen.getByTestId('azure-clientId-input'), { target: { value: '22222222-2222-2222-2222-222222222222' } });
      fireEvent.change(screen.getByTestId('azure-clientSecret-input'), { target: { value: 'super-secret-value' } });
      expect(submit).toBeDisabled(); // still missing subscriptionId
      fireEvent.change(screen.getByTestId('azure-subscriptionId-input'), { target: { value: '33333333-3333-3333-3333-333333333333' } });
      expect(submit).not.toBeDisabled();

      fireEvent.click(submit);

      await waitFor(() => {
        expect(createProviderConnection).toHaveBeenCalledWith({
          authType: 'AZURE_CLIENT_CREDENTIALS',
          credential: JSON.stringify({
            clientId: '22222222-2222-2222-2222-222222222222',
            clientSecret: 'super-secret-value',
            subscriptionId: '33333333-3333-3333-3333-333333333333',
            tenantId: '11111111-1111-1111-1111-111111111111',
          }),
          providerAccountId: 'azure-account-1',
        });
      });
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });
});
