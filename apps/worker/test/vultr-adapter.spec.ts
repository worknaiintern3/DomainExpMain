import { describe, expect, it, vi } from 'vitest';

import { parseVultrRetryAfter, VultrAdapter } from '../src/providers/vultr/vultr.adapter';
import { VULTR_MAX_RESPONSE_BYTES } from '../src/providers/vultr/vultr.constants';

const TEST_TOKEN = 'not-a-real-vultr-api-key';

function json(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(value), { ...init, headers });
}

function instance(id: string, label = 'web-1', overrides: Record<string, unknown> = {}) {
  return {
    date_created: '2026-01-01T00:00:00+00:00',
    hostname: null,
    id,
    label,
    main_ip: '203.0.113.30',
    os: 'Ubuntu 22.04 x64',
    plan: 'vc2-1c-1gb',
    power_status: 'running',
    region: 'ewr',
    status: 'active',
    tags: [],
    ...overrides,
  };
}

function instancesPage(instances: readonly unknown[], next = '') {
  return { instances, meta: { links: { next }, total: instances.length } };
}

function adapter(
  fetchMock: ReturnType<typeof vi.fn>,
  options: { readonly maxPages?: number; readonly pageSize?: number; readonly timeoutMs?: number } = {},
): VultrAdapter {
  return new VultrAdapter({
    fetchImplementation: fetchMock as unknown as typeof fetch,
    ...options,
  });
}

describe('Vultr token validation', () => {
  it('validates via the smallest real instances read (no dedicated verify endpoint)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(instancesPage([])));
    const result = await adapter(fetchMock).validateToken(TEST_TOKEN);
    expect(result).toMatchObject({ status: 'ACTIVE', valid: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/v2/instances');
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

  it('returns a sanitized invalid result for an unauthorized key, not a thrown error', async () => {
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
    expect(parseVultrRetryAfter('not-a-date', 0)).toBeNull();
    expect(parseVultrRetryAfter('999999999', 0)).toBe(86_400);
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
      headers: { 'content-length': String(VULTR_MAX_RESPONSE_BYTES + 1) },
    });
    const textSpy = vi.spyOn(oversized, 'text');
    await expect(adapter(vi.fn().mockResolvedValue(oversized)).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    expect(textSpy).not.toHaveBeenCalled();
  });
});

describe('Vultr instance discovery', () => {
  it('enumerates all pages via the cursor and normalizes instance fields', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(instancesPage([instance('i-1')], 'cursor-2')))
      .mockResolvedValueOnce(json(instancesPage([instance('i-2', 'db-1')])));
    const result = await adapter(fetchMock, { pageSize: 5 }).discoverServers(TEST_TOKEN);

    expect(result).toMatchObject({
      completion: 'COMPLETE',
      externalResourceType: 'vultr.instance',
      servers: [
        {
          canonicalName: 'web-1',
          externalResourceId: 'i-1',
          hostname: null,
          operatingSystem: 'Ubuntu 22.04 x64',
          primaryIp: '203.0.113.30',
          providerStatus: 'active-running',
          region: 'ewr',
          serverKind: 'vc2-1c-1gb',
        },
        { canonicalName: 'db-1', externalResourceId: 'i-2' },
      ],
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('cursor=cursor-2');
  });

  it('treats a 0.0.0.0 main_ip sentinel as no public IP', async () => {
    const unassigned = instance('i-3', 'pending-1', { main_ip: '0.0.0.0' });
    const result = await adapter(vi.fn().mockResolvedValue(json(instancesPage([unassigned]))))
      .discoverServers(TEST_TOKEN);
    expect(result.servers).toEqual([expect.objectContaining({ primaryIp: null })]);
  });

  it('falls back to hostname, then the external id, when label is blank', async () => {
    const noLabel = instance('i-4', '', { hostname: 'db-host' });
    const result = await adapter(vi.fn().mockResolvedValue(json(instancesPage([noLabel]))))
      .discoverServers(TEST_TOKEN);
    expect(result.servers).toEqual([expect.objectContaining({ canonicalName: 'db-host' })]);
  });

  it('treats an empty cursor on the first page as a complete enumeration', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json(instancesPage([]))), { pageSize: 50 })
      .discoverServers(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'COMPLETE', servers: [] });
  });

  it('returns a partial result when a later page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(instancesPage([instance('i-1')], 'cursor-2')))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(adapter(fetchMock, { pageSize: 5 }).discoverServers(TEST_TOKEN)).resolves.toMatchObject({
      completion: 'PARTIAL',
      error: { code: 'UPSTREAM_UNAVAILABLE' },
      servers: [{ externalResourceId: 'i-1' }],
    });
  });

  it('stops at the configured safety bound instead of trusting endless pagination', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(instancesPage([instance('i-1')], 'cursor-2')))
      .mockResolvedValueOnce(json(instancesPage([instance('i-2')], 'cursor-3')));
    const result = await adapter(fetchMock, { maxPages: 2, pageSize: 5 }).discoverServers(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'PARTIAL', error: { code: 'UPSTREAM_BAD_RESPONSE' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed instance entries', async () => {
    await expect(
      adapter(vi.fn().mockResolvedValue(json(instancesPage([{ id: 'i-5', plan: 'BAD PLAN' }]))))
        .discoverServers(TEST_TOKEN),
    ).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
