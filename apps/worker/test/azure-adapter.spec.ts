import { describe, expect, it, vi } from 'vitest';

import { assertTrustedAzureManagementUrl, AzureAdapter } from '../src/providers/azure/azure.adapter';
import { parseAzureCredential } from '../src/providers/azure/azure.constants';

const VALID_CREDENTIAL = JSON.stringify({
  clientId: '22222222-2222-2222-2222-222222222222',
  clientSecret: 'super-secret-value',
  subscriptionId: '33333333-3333-3333-3333-333333333333',
  tenantId: '11111111-1111-1111-1111-111111111111',
});

function json(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(value), { ...init, headers });
}

function tokenResponse(): Response {
  return json({ access_token: 'test-arm-token', expires_in: 3_600, token_type: 'Bearer' });
}

function azureVm(overrides: Record<string, unknown> = {}) {
  return {
    id: '/subscriptions/33333333-3333-3333-3333-333333333333/resourceGroups/my-rg/providers/Microsoft.Compute/virtualMachines/vm-1',
    location: 'eastus',
    name: 'vm-1',
    properties: { hardwareProfile: { vmSize: 'Standard_D2s_v3' }, provisioningState: 'Succeeded' },
    tags: { env: 'prod' },
    ...overrides,
  };
}

function adapter(fetchMock: ReturnType<typeof vi.fn>, options: { readonly timeoutMs?: number; readonly maxPages?: number } = {}): AzureAdapter {
  return new AzureAdapter({ fetchImplementation: fetchMock as unknown as typeof fetch, ...options });
}

describe('Azure credential shape', () => {
  it('accepts a well-formed service-principal credential', () => {
    expect(parseAzureCredential(VALID_CREDENTIAL)).toEqual({
      clientId: '22222222-2222-2222-2222-222222222222',
      clientSecret: 'super-secret-value',
      subscriptionId: '33333333-3333-3333-3333-333333333333',
      tenantId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('rejects a blank credential', () => {
    expect(() => parseAzureCredential('')).toThrow();
    expect(() => parseAzureCredential('   ')).toThrow();
  });

  it('rejects a non-GUID tenant/client/subscription ID', () => {
    expect(() => parseAzureCredential(JSON.stringify({
      clientId: 'not-a-guid', clientSecret: 'x', subscriptionId: '33333333-3333-3333-3333-333333333333', tenantId: '11111111-1111-1111-1111-111111111111',
    }))).toThrow();
  });

  it('rejects a blank client secret', () => {
    expect(() => parseAzureCredential(JSON.stringify({
      clientId: '22222222-2222-2222-2222-222222222222', clientSecret: '  ', subscriptionId: '33333333-3333-3333-3333-333333333333', tenantId: '11111111-1111-1111-1111-111111111111',
    }))).toThrow();
  });

  it('rejects malformed JSON', () => {
    expect(() => parseAzureCredential('not-json')).toThrow();
  });
});

describe('assertTrustedAzureManagementUrl', () => {
  it('accepts a valid HTTPS management.azure.com URL', () => {
    expect(() => assertTrustedAzureManagementUrl(
      'https://management.azure.com/subscriptions/x/providers/Microsoft.Compute/virtualMachines?$skiptoken=abc',
    )).not.toThrow();
  });

  it('rejects an HTTP (non-HTTPS) URL even with the exact trusted host -- host equality alone is not enough', () => {
    expect(() => assertTrustedAzureManagementUrl('http://management.azure.com/next'))
      .toThrow(expect.objectContaining({ code: 'UPSTREAM_BAD_RESPONSE' }));
  });

  it('rejects a foreign host', () => {
    expect(() => assertTrustedAzureManagementUrl('https://evil.example/steal'))
      .toThrow(expect.objectContaining({ code: 'UPSTREAM_BAD_RESPONSE' }));
  });

  it('rejects a suffix-lookalike host (management.azure.com.evil.example)', () => {
    expect(() => assertTrustedAzureManagementUrl('https://management.azure.com.evil.example/next'))
      .toThrow(expect.objectContaining({ code: 'UPSTREAM_BAD_RESPONSE' }));
  });

  it('rejects a subdomain lookalike host (evil.management.azure.com)', () => {
    expect(() => assertTrustedAzureManagementUrl('https://evil.management.azure.com/next'))
      .toThrow(expect.objectContaining({ code: 'UPSTREAM_BAD_RESPONSE' }));
  });

  it('rejects an alternate/non-default port', () => {
    expect(() => assertTrustedAzureManagementUrl('https://management.azure.com:8443/next'))
      .toThrow(expect.objectContaining({ code: 'UPSTREAM_BAD_RESPONSE' }));
  });

  it('rejects embedded URL credentials (userinfo)', () => {
    expect(() => assertTrustedAzureManagementUrl('https://attacker:pw@management.azure.com/next'))
      .toThrow(expect.objectContaining({ code: 'UPSTREAM_BAD_RESPONSE' }));
  });

  it('rejects a malformed URL', () => {
    expect(() => assertTrustedAzureManagementUrl('not a url at all'))
      .toThrow(expect.objectContaining({ code: 'UPSTREAM_BAD_RESPONSE' }));
  });
});

describe('Azure Virtual Machines discovery', () => {
  it('mints a token via the client-credentials grant before calling the VM list endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ value: [] }));
    await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    expect(String(tokenUrl)).toBe('https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/oauth2/v2.0/token');
    const body = new URLSearchParams(tokenInit.body as string);
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('scope')).toBe('https://management.azure.com/.default');
    expect(body.get('client_id')).toBe('22222222-2222-2222-2222-222222222222');
    expect(body.get('client_secret')).toBe('super-secret-value');

    const [vmUrl, vmInit] = fetchMock.mock.calls[1] as [string | URL, RequestInit];
    expect(String(vmUrl)).toContain('/subscriptions/33333333-3333-3333-3333-333333333333/providers/Microsoft.Compute/virtualMachines');
    expect((vmInit.headers as Record<string, string>).authorization).toBe('Bearer test-arm-token');
  });

  it('normalizes a VM, parsing the resource group from the ARM ID and reporting no IP/runtime-status data', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ value: [azureVm()] }));
    const result = await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);

    expect(result).toEqual({
      completion: 'COMPLETE',
      error: null,
      externalResourceType: 'virtual-machine',
      resources: [
        {
          externalResourceId: '/subscriptions/33333333-3333-3333-3333-333333333333/resourceGroups/my-rg/providers/Microsoft.Compute/virtualMachines/vm-1',
          imageReference: null,
          instanceType: 'Standard_D2s_v3',
          launchedAt: null,
          name: 'vm-1',
          privateIpAddress: null,
          providerStatus: 'succeeded',
          publicIpAddress: null,
          region: 'eastus',
          resourceGroup: 'my-rg',
          resourceKind: 'virtual-machine',
          tags: { env: 'prod' },
          zone: null,
        },
      ],
    });
    expect(adapter(fetchMock).cloudResourceCapabilities).toEqual({
      listInstances: true,
      readNetworkAddresses: false,
      readRuntimeStatus: false,
      readTags: true,
    });
  });

  it('paginates via nextLink, only ever following the fixed management.azure.com host', async () => {
    const nextLink = 'https://management.azure.com/subscriptions/33333333-3333-3333-3333-333333333333/providers/Microsoft.Compute/virtualMachines?api-version=2024-07-01&$skiptoken=abc';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ nextLink, value: [azureVm({ name: 'vm-1' })] }))
      .mockResolvedValueOnce(json({ value: [azureVm({ id: azureVm().id.replace('vm-1', 'vm-2'), name: 'vm-2' })] }));
    const result = await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);

    expect(result.completion).toBe('COMPLETE');
    expect(result.resources.map((r) => r.name)).toEqual(['vm-1', 'vm-2']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(nextLink);
  });

  it('rejects an http:// nextLink end-to-end even though its host matches (no HTTPS downgrade)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ nextLink: 'http://management.azure.com/next', value: [azureVm()] }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('rejects a nextLink pointing at a different host (untrusted redirect-like response)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ nextLink: 'https://evil.example/steal', value: [azureVm()] }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('returns PARTIAL with data gathered so far when a later page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({
        nextLink: 'https://management.azure.com/next',
        value: [azureVm()],
      }))
      .mockResolvedValueOnce(json({ error: { code: 'TooManyRequests' } }, { status: 429 }));
    const result = await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);

    expect(result).toMatchObject({ completion: 'PARTIAL', error: { code: 'RATE_LIMITED' }, resources: [expect.objectContaining({ name: 'vm-1' })] });
  });

  it('throws (does not return a hollow PARTIAL) when the very first VM list call fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ error: { code: 'AuthorizationFailed' } }, { status: 403 }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('classifies a token-mint failure (invalid_client) as AUTH_INVALID', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ error: 'invalid_client' }, { status: 401 }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });

  it('maps SubscriptionNotFound to RESOURCE_NOT_FOUND', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ error: { code: 'SubscriptionNotFound' } }, { status: 404 }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('maps a 5xx to UPSTREAM_UNAVAILABLE', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('rejects malformed JSON', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('{not json'));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('aborts a timed-out VM-list request and classifies it safely', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockImplementationOnce((_input: unknown, init?: { readonly signal?: AbortSignal | null }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('test timeout', 'AbortError'));
          });
        }));
    await expect(adapter(fetchMock, { timeoutMs: 5 }).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('treats an empty subscription as a complete empty enumeration', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ value: [] }));
    const result = await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);
    expect(result).toMatchObject({ completion: 'COMPLETE', resources: [] });
  });
});
