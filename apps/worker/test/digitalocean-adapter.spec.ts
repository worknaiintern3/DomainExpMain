import { describe, expect, it, vi } from 'vitest';

import { DigitalOceanAdapter, parseDigitalOceanRetryAfter } from '../src/providers/digitalocean/digitalocean.adapter';
import { DIGITALOCEAN_MAX_RESPONSE_BYTES } from '../src/providers/digitalocean/digitalocean.constants';

const TEST_TOKEN = 'not-a-real-digitalocean-token';

function json(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(value), { ...init, headers });
}

function accountEnvelope(status: 'active' | 'warning' | 'locked' = 'active') {
  return { account: { status, uuid: 'account-uuid' } };
}

function droplet(
  id: number,
  name = 'web-1',
  overrides: Record<string, unknown> = {},
) {
  return {
    created_at: '2026-01-01T00:00:00Z',
    id,
    image: { distribution: 'Ubuntu', name: 'Ubuntu 22.04 x64', slug: 'ubuntu-22-04-x64' },
    name,
    networks: {
      v4: [
        { ip_address: '203.0.113.10', type: 'public' },
        { ip_address: '10.0.0.5', type: 'private' },
      ],
    },
    region: { slug: 'nyc3' },
    size_slug: 's-1vcpu-1gb',
    status: 'active',
    tags: [],
    ...overrides,
  };
}

function dropletsPage(droplets: readonly unknown[], hasNext = false) {
  return {
    droplets,
    links: hasNext ? { pages: { next: 'https://api.digitalocean.com/v2/droplets?page=2' } } : {},
    meta: { total: droplets.length },
  };
}

function adapter(
  fetchMock: ReturnType<typeof vi.fn>,
  options: { readonly maxPages?: number; readonly pageSize?: number; readonly timeoutMs?: number } = {},
): DigitalOceanAdapter {
  return new DigitalOceanAdapter({
    fetchImplementation: fetchMock as unknown as typeof fetch,
    ...options,
  });
}

describe('DigitalOcean token validation', () => {
  it('validates via the smallest real account read (no dedicated verify endpoint)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(accountEnvelope()));
    const result = await adapter(fetchMock).validateToken(TEST_TOKEN);
    expect(result).toMatchObject({ status: 'ACTIVE', valid: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/v2/account');
  });

  it('rejects a blank/whitespace token before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    await expect(adapter(fetchMock).validateToken('   ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows an HTTP redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(accountEnvelope()));
    await adapter(fetchMock).validateToken(TEST_TOKEN);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TEST_TOKEN}` });
  });

  it('treats a locked account as a disabled credential, not a thrown error', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json(accountEnvelope('locked')))).validateToken(TEST_TOKEN);
    expect(result).toEqual({ errorCode: 'AUTH_INVALID', status: 'DISABLED', valid: false });
  });

  it('returns a sanitized invalid result for an unauthorized token, not a thrown error', async () => {
    const invalid = adapter(vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(invalid.validateToken(TEST_TOKEN)).resolves.toEqual({
      errorCode: 'AUTH_INVALID', status: 'INVALID', valid: false,
    });
  });

  it.each([
    [400, 'INVALID_REQUEST'],
    [403, 'PERMISSION_DENIED'],
    [404, 'RESOURCE_NOT_FOUND'],
    [418, 'UNKNOWN_PROVIDER_ERROR'],
    [500, 'UPSTREAM_UNAVAILABLE'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    const client = adapter(vi.fn().mockResolvedValue(new Response('', { status })));
    await expect(client.validateToken(TEST_TOKEN)).rejects.toMatchObject({ code });
  });

  it('maps 429 and bounds Retry-After from the retry-after header', async () => {
    const client = adapter(vi.fn().mockResolvedValue(new Response('sensitive', {
      headers: { 'retry-after': '90' },
      status: 429,
    })));
    await expect(client.validateToken(TEST_TOKEN)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 90,
    });
  });

  it('falls back to the RateLimit-Reset header when Retry-After is absent', () => {
    expect(parseDigitalOceanRetryAfter(null, String(1_000 + 30), 1_000_000)).toBe(30);
    expect(parseDigitalOceanRetryAfter(null, null, 0)).toBeNull();
    expect(parseDigitalOceanRetryAfter(null, String(999_999_999_999), 0)).toBe(86_400);
  });

  it('aborts a timed-out request and classifies it safely', async () => {
    const fetchMock = vi.fn((_input: unknown, init?: { readonly signal?: AbortSignal | null }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('test timeout', 'AbortError'));
        });
      }));
    await expect(adapter(fetchMock, { timeoutMs: 5 }).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('rejects malformed JSON', async () => {
    await expect(adapter(vi.fn().mockResolvedValue(new Response('{bad'))).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('classifies transport failures without retaining their details', async () => {
    const client = adapter(vi.fn().mockRejectedValue(new Error(`network failure ${TEST_TOKEN}`)));
    await expect(client.validateToken(TEST_TOKEN)).rejects.toEqual(
      expect.objectContaining({ code: 'UPSTREAM_UNAVAILABLE', message: 'Provider request failed' }),
    );
  });

  it('rejects a declared content-length over the response size bound without reading the body', async () => {
    const oversized = new Response(JSON.stringify(accountEnvelope()), {
      headers: { 'content-length': String(DIGITALOCEAN_MAX_RESPONSE_BYTES + 1) },
    });
    const textSpy = vi.spyOn(oversized, 'text');
    await expect(adapter(vi.fn().mockResolvedValue(oversized)).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    expect(textSpy).not.toHaveBeenCalled();
  });
});

describe('DigitalOcean droplet discovery', () => {
  it('enumerates all pages via links.pages.next and normalizes droplet fields', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(dropletsPage([droplet(1)], true)))
      .mockResolvedValueOnce(json(dropletsPage([droplet(2, 'db-1')], false)));
    const result = await adapter(fetchMock, { pageSize: 5 }).discoverServers(TEST_TOKEN);

    expect(result).toMatchObject({
      completion: 'COMPLETE',
      externalResourceType: 'digitalocean.droplet',
      servers: [
        {
          canonicalName: 'web-1',
          externalResourceId: '1',
          hostname: null,
          operatingSystem: 'ubuntu-22-04-x64',
          primaryIp: '203.0.113.10',
          providerStatus: 'active',
          region: 'nyc3',
          serverKind: 's-1vcpu-1gb',
        },
        { canonicalName: 'db-1', externalResourceId: '2' },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('normalizes a droplet with no public IPv4 to a null primaryIp', async () => {
    const privateOnly = droplet(3, 'internal-1', {
      networks: { v4: [{ ip_address: '10.0.0.9', type: 'private' }] },
    });
    const result = await adapter(vi.fn().mockResolvedValue(json(dropletsPage([privateOnly]))))
      .discoverServers(TEST_TOKEN);
    expect(result.servers).toEqual([expect.objectContaining({ primaryIp: null })]);
  });

  it('treats an empty first page with no next link as a complete enumeration', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json(dropletsPage([]))), { pageSize: 50 })
      .discoverServers(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'COMPLETE', servers: [] });
  });

  it('returns a partial result when a later page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(dropletsPage([droplet(1)], true)))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(adapter(fetchMock, { pageSize: 5 }).discoverServers(TEST_TOKEN)).resolves.toMatchObject({
      completion: 'PARTIAL',
      error: { code: 'UPSTREAM_UNAVAILABLE' },
      servers: [{ externalResourceId: '1' }],
    });
  });

  it('stops at the configured safety bound instead of trusting endless pagination', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(dropletsPage([droplet(1)], true)))
      .mockResolvedValueOnce(json(dropletsPage([droplet(2)], true)));
    const result = await adapter(fetchMock, { maxPages: 2, pageSize: 5 }).discoverServers(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'PARTIAL', error: { code: 'UPSTREAM_BAD_RESPONSE' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed droplet entries', async () => {
    await expect(
      adapter(vi.fn().mockResolvedValue(json(dropletsPage([{ id: 'not-a-number', name: 'bad' }]))))
        .discoverServers(TEST_TOKEN),
    ).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
