import { describe, expect, it, vi } from 'vitest';

import { LinodeAdapter, parseLinodeRetryAfter } from '../src/providers/linode/linode.adapter';
import { LINODE_MAX_RESPONSE_BYTES } from '../src/providers/linode/linode.constants';

const TEST_TOKEN = 'not-a-real-linode-token';

function json(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(value), { ...init, headers });
}

function instance(id: number, label = 'web-1', overrides: Record<string, unknown> = {}) {
  return {
    created: '2026-01-01T00:00:00',
    id,
    image: 'linode/ubuntu22.04',
    ipv4: ['203.0.113.40'],
    ipv6: '2600:3c00::1/64',
    label,
    region: 'us-east',
    status: 'running',
    tags: [],
    type: 'g6-standard-1',
    ...overrides,
  };
}

function instancesPage(data: readonly unknown[], page = 1, pages = 1) {
  return { data, page, pages, results: data.length };
}

function adapter(
  fetchMock: ReturnType<typeof vi.fn>,
  options: { readonly maxPages?: number; readonly pageSize?: number; readonly timeoutMs?: number } = {},
): LinodeAdapter {
  return new LinodeAdapter({
    fetchImplementation: fetchMock as unknown as typeof fetch,
    ...options,
  });
}

describe('Linode token validation', () => {
  it('validates via the smallest real instances read (no dedicated verify endpoint)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(instancesPage([])));
    const result = await adapter(fetchMock).validateToken(TEST_TOKEN);
    expect(result).toMatchObject({ status: 'ACTIVE', valid: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/v4/linode/instances');
  });

  it('rejects a blank/whitespace token before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    await expect(adapter(fetchMock).validateToken('   ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows an HTTP redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(instancesPage([])));
    await adapter(fetchMock).validateToken(TEST_TOKEN);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TEST_TOKEN}` });
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

  it('maps 429 and bounds Retry-After', async () => {
    const client = adapter(vi.fn().mockResolvedValue(new Response('sensitive', {
      headers: { 'retry-after': '90' },
      status: 429,
    })));
    await expect(client.validateToken(TEST_TOKEN)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 90,
    });
    expect(parseLinodeRetryAfter('not-a-date', 0)).toBeNull();
    expect(parseLinodeRetryAfter('999999999', 0)).toBe(86_400);
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

  it('rejects a declared content-length over the response size bound without reading the body', async () => {
    const oversized = new Response(JSON.stringify(instancesPage([])), {
      headers: { 'content-length': String(LINODE_MAX_RESPONSE_BYTES + 1) },
    });
    const textSpy = vi.spyOn(oversized, 'text');
    await expect(adapter(vi.fn().mockResolvedValue(oversized)).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    expect(textSpy).not.toHaveBeenCalled();
  });
});

describe('Linode instance discovery', () => {
  it('enumerates all pages via page/pages and normalizes instance fields', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(instancesPage([instance(1)], 1, 2)))
      .mockResolvedValueOnce(json(instancesPage([instance(2, 'db-1')], 2, 2)));
    const result = await adapter(fetchMock, { pageSize: 25 }).discoverServers(TEST_TOKEN);

    expect(result).toMatchObject({
      completion: 'COMPLETE',
      externalResourceType: 'linode.instance',
      servers: [
        {
          canonicalName: 'web-1',
          externalResourceId: '1',
          hostname: null,
          operatingSystem: 'linode/ubuntu22.04',
          primaryIp: '203.0.113.40',
          providerStatus: 'running',
          region: 'us-east',
          serverKind: 'g6-standard-1',
        },
        { canonicalName: 'db-1', externalResourceId: '2' },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('normalizes an instance with no ipv4 addresses to a null primaryIp', async () => {
    const noIp = instance(3, 'internal-1', { ipv4: [] });
    const result = await adapter(vi.fn().mockResolvedValue(json(instancesPage([noIp]))))
      .discoverServers(TEST_TOKEN);
    expect(result.servers).toEqual([expect.objectContaining({ primaryIp: null })]);
  });

  it('treats a single, complete page as a complete enumeration', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json(instancesPage([], 1, 0))), { pageSize: 25 })
      .discoverServers(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'COMPLETE', servers: [] });
  });

  it('returns a partial result when a later page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(instancesPage([instance(1)], 1, 2)))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(adapter(fetchMock, { pageSize: 25 }).discoverServers(TEST_TOKEN)).resolves.toMatchObject({
      completion: 'PARTIAL',
      error: { code: 'UPSTREAM_UNAVAILABLE' },
      servers: [{ externalResourceId: '1' }],
    });
  });

  it('stops at the configured safety bound instead of trusting endless pagination', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(instancesPage([instance(1)], 1, 5)))
      .mockResolvedValueOnce(json(instancesPage([instance(2)], 2, 5)));
    const result = await adapter(fetchMock, { maxPages: 2, pageSize: 25 }).discoverServers(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'PARTIAL', error: { code: 'UPSTREAM_BAD_RESPONSE' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a response whose page echo disagrees with the requested page', async () => {
    await expect(
      adapter(vi.fn().mockResolvedValue(json(instancesPage([instance(1)], 9, 9)))).discoverServers(TEST_TOKEN),
    ).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('rejects malformed instance entries', async () => {
    await expect(
      adapter(vi.fn().mockResolvedValue(json(instancesPage([{ id: 1, region: 'BAD REGION' }]))))
        .discoverServers(TEST_TOKEN),
    ).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
