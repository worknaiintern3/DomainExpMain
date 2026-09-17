import { describe, expect, it, vi } from 'vitest';

import { AzureCredentialValidator, AzureTokenValidationError } from '../src/provider-connections/azure-credential-validator';

const VALID_CREDENTIAL = JSON.stringify({
  clientId: '22222222-2222-2222-2222-222222222222',
  clientSecret: 'super-secret-value',
  subscriptionId: '33333333-3333-3333-3333-333333333333',
  tenantId: '11111111-1111-1111-1111-111111111111',
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status });
}

function tokenResponse(): Response {
  return json(200, { access_token: 'test-arm-token', expires_in: 3_600, token_type: 'Bearer' });
}

function fetchSequence(...responses: readonly Response[]): typeof fetch {
  const mock = vi.fn();
  for (const response of responses) mock.mockResolvedValueOnce(response);
  return mock as unknown as typeof fetch;
}

describe('AzureCredentialValidator', () => {
  it('returns true when the service principal can list VMs in the subscription', async () => {
    const validator = new AzureCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), json(200, { value: [] })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(true);
  });

  it('calls the exact VM-list surface Phase 10I sync uses, page one only', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json(200, { value: [] }));
    const validator = new AzureCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive(VALID_CREDENTIAL);

    const [vmUrl, vmInit] = fetchMock.mock.calls[1] as [string | URL, RequestInit];
    const url = new URL(vmUrl);
    expect(url.pathname).toBe('/subscriptions/33333333-3333-3333-3333-333333333333/providers/Microsoft.Compute/virtualMachines');
    expect((vmInit.headers as Record<string, string>).authorization).toBe('Bearer test-arm-token');
  });

  it('returns false when the service principal mints an invalid_client token error, not a thrown error', async () => {
    const validator = new AzureCredentialValidator({
      fetchImplementation: fetchSequence(json(401, { error: 'invalid_client' })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(false);
  });

  it('maps AuthorizationFailed to a distinct PERMISSION_DENIED error, never conflated with invalid credentials', async () => {
    const validator = new AzureCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), json(403, { error: { code: 'AuthorizationFailed' } })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toBeInstanceOf(AzureTokenValidationError);
  });

  it('maps SubscriptionNotFound to RESOURCE_NOT_FOUND', async () => {
    const validator = new AzureCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), json(404, { error: { code: 'SubscriptionNotFound' } })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('maps a 429 VM-list response to RATE_LIMITED', async () => {
    const validator = new AzureCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), new Response('', { status: 429 })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps a 5xx VM-list response to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new AzureCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), new Response('', { status: 503 })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps a token-endpoint 5xx (even with an empty body) to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new AzureCredentialValidator({ fetchImplementation: fetchSequence(new Response('', { status: 503 })) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps an aborted token-mint request (timeout) to NETWORK_TIMEOUT', async () => {
    const validator = new AzureCredentialValidator({
      fetchImplementation: vi.fn().mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })) as unknown as typeof fetch,
      timeoutMs: 5,
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('maps a network-level fetch failure (no abort) to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new AzureCredentialValidator({
      fetchImplementation: vi.fn().mockRejectedValue(new Error('getaddrinfo failure')) as unknown as typeof fetch,
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('rejects a blank credential before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new AzureCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(validator.isTokenActive('')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-GUID tenant ID before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new AzureCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(
      validator.isTokenActive(JSON.stringify({ clientId: '22222222-2222-2222-2222-222222222222', clientSecret: 'x', subscriptionId: '33333333-3333-3333-3333-333333333333', tenantId: 'not-a-guid' })),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a body over the response size bound', async () => {
    const oversized = JSON.stringify({ value: new Array(2_000_000).fill('x').join('') });
    const validator = new AzureCredentialValidator({ fetchImplementation: fetchSequence(tokenResponse(), new Response(oversized)) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('never sends the plaintext client secret in the VM-list request', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json(200, { value: [] }));
    const validator = new AzureCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive(VALID_CREDENTIAL);
    const [, vmInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.stringify(vmInit)).not.toContain('super-secret-value');
  });
});
