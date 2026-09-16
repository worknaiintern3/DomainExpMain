import { describe, expect, it, vi } from 'vitest';

import { HostingerAdapter, parseHostingerRetryAfter } from '../src/providers/hostinger/hostinger.adapter';
import { HOSTINGER_MAX_RESPONSE_BYTES } from '../src/providers/hostinger/hostinger.constants';

const TEST_TOKEN = 'not-a-real-hostinger-api-token';

function json(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(value), { ...init, headers });
}

function domainEntry(id: number, domain: string, status = 'active') {
  return { domain, id, status };
}

function adapter(
  fetchMock: ReturnType<typeof vi.fn>,
  options: { readonly timeoutMs?: number } = {},
): HostingerAdapter {
  return new HostingerAdapter({
    fetchImplementation: fetchMock as unknown as typeof fetch,
    ...options,
  });
}

describe('Hostinger token validation', () => {
  it('validates via the portfolio read (no dedicated verify endpoint) and reports honest capabilities', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    const hostinger = adapter(fetchMock);
    await expect(hostinger.validateToken(TEST_TOKEN)).resolves.toMatchObject({ status: 'ACTIVE', valid: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://developers.hostinger.com/api/domains/v1/portfolio');
    expect(hostinger.capabilities).toMatchObject({
      listDomains: true,
      manageDnsRecords: false,
      readAutoRenew: false,
      readNameservers: false,
    });
  });

  it('rejects a blank/whitespace token before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    await expect(adapter(fetchMock).validateToken('   ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows an HTTP redirect and sends a Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([]));
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
    const hostinger = adapter(vi.fn().mockResolvedValue(new Response('', { status })));
    await expect(hostinger.validateToken(TEST_TOKEN)).rejects.toMatchObject({ code });
  });

  it('maps 429 and bounds Retry-After', async () => {
    const hostinger = adapter(vi.fn().mockResolvedValue(new Response('sensitive', {
      headers: { 'retry-after': '30' },
      status: 429,
    })));
    await expect(hostinger.validateToken(TEST_TOKEN)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 30 });
    expect(parseHostingerRetryAfter('not-a-date', 0)).toBeNull();
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
    const hostinger = adapter(vi.fn().mockRejectedValue(new Error(`network failure ${TEST_TOKEN}`)));
    await expect(hostinger.validateToken(TEST_TOKEN)).rejects.toEqual(
      expect.objectContaining({ code: 'UPSTREAM_UNAVAILABLE', message: 'Provider request failed' }),
    );
  });

  it('rejects a declared content-length over the response size bound without reading the body', async () => {
    const oversized = new Response('[]', {
      headers: { 'content-length': String(HOSTINGER_MAX_RESPONSE_BYTES + 1) },
    });
    const textSpy = vi.spyOn(oversized, 'text');
    await expect(adapter(vi.fn().mockResolvedValue(oversized)).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    expect(textSpy).not.toHaveBeenCalled();
  });

  it('rejects an actual body over the response size bound even without a content-length header', async () => {
    const oversizedBody = JSON.stringify([domainEntry(1, 'x'.repeat(HOSTINGER_MAX_RESPONSE_BYTES))]);
    const response = new Response(oversizedBody);
    response.headers.delete('content-length');
    await expect(adapter(vi.fn().mockResolvedValue(response)).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});

describe('Hostinger domain discovery', () => {
  it('normalizes the unpaginated portfolio into a complete enumeration', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([
      domainEntry(1, 'Example.COM.', 'active'),
      domainEntry(2, 'other.example', 'expired'),
    ]));
    const result = await adapter(fetchMock).discoverDomains(TEST_TOKEN);

    expect(result).toEqual({
      completion: 'COMPLETE',
      domains: [
        // null, not false: the bulk portfolio has no nameserver evidence,
        // so DNS hosting is genuinely unknown here, not confirmed absent.
        { canonicalDomain: 'example.com', dnsHostedByProvider: null, externalResourceId: '1', providerStatus: 'active' },
        { canonicalDomain: 'other.example', dnsHostedByProvider: null, externalResourceId: '2', providerStatus: 'expired' },
      ],
      error: null,
      externalResourceType: 'hostinger.domain',
    });
  });

  it('treats an empty account as a complete empty enumeration', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json([]))).discoverDomains(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'COMPLETE', domains: [] });
  });

  it('throws (not a hollow PARTIAL result) when the single portfolio read fails, consistent with a first-page failure elsewhere', async () => {
    await expect(
      adapter(vi.fn().mockResolvedValue(new Response('', { status: 503 }))).discoverDomains(TEST_TOKEN),
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('rejects malformed domain entries', async () => {
    await expect(
      adapter(vi.fn().mockResolvedValue(json([{ domain: '*bad.example', id: 1, status: 'active' }])))
        .discoverDomains(TEST_TOKEN),
    ).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
