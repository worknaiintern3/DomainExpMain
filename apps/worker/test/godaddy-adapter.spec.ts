import { describe, expect, it, vi } from 'vitest';

import { GoDaddyAdapter, parseGoDaddyRetryAfter } from '../src/providers/godaddy/godaddy.adapter';
import { GODADDY_MAX_RESPONSE_BYTES } from '../src/providers/godaddy/godaddy.constants';

const TEST_TOKEN = 'not-a-real-godaddy-pat';

function json(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(value), { ...init, headers });
}

function domainEntry(
  domain: string,
  domainId: number,
  status = 'ACTIVE',
  nameServers?: readonly string[],
) {
  return {
    domain,
    domainId,
    expires: '2030-01-01T00:00:00.000Z',
    nameServers,
    renewAuto: true,
    status,
  };
}

function adapter(
  fetchMock: ReturnType<typeof vi.fn>,
  options: { readonly maxPages?: number; readonly pageSize?: number; readonly timeoutMs?: number } = {},
): GoDaddyAdapter {
  return new GoDaddyAdapter({
    fetchImplementation: fetchMock as unknown as typeof fetch,
    ...options,
  });
}

describe('GoDaddy token validation', () => {
  it('validates via the smallest real domain-list read (no dedicated verify endpoint) and reports honest capabilities', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    const cf = adapter(fetchMock);
    const result = await cf.validateToken(TEST_TOKEN);
    expect(result).toMatchObject({ status: 'ACTIVE', valid: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('limit=1');
    // Truthful capabilities: listDomains/readNameservers are genuinely
    // exercised by this adapter; readAutoRenew/readDomainDetails are not
    // (renewAuto is parsed but never surfaced, and there is no per-domain
    // details call), so both must be false even though GoDaddy's API
    // supports them.
    expect(cf.capabilities).toMatchObject({
      listDomains: true,
      manageDnsRecords: false,
      readAutoRenew: false,
      readDomainDetails: false,
      readNameservers: true,
    });
  });

  it('rejects a blank/whitespace token before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    await expect(adapter(fetchMock).validateToken('   ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows an HTTP redirect', async () => {
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
    const godaddy = adapter(vi.fn().mockResolvedValue(new Response('', { status })));
    await expect(godaddy.validateToken(TEST_TOKEN)).rejects.toMatchObject({ code });
  });

  it('maps 429 and bounds Retry-After', async () => {
    const godaddy = adapter(vi.fn().mockResolvedValue(new Response('sensitive', {
      headers: { 'retry-after': '90' },
      status: 429,
    })));
    await expect(godaddy.validateToken(TEST_TOKEN)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 90,
    });
    expect(parseGoDaddyRetryAfter('not-a-date', 0)).toBeNull();
    expect(parseGoDaddyRetryAfter('999999999', 0)).toBe(86_400);
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
    const godaddy = adapter(vi.fn().mockRejectedValue(new Error(`network failure ${TEST_TOKEN}`)));
    await expect(godaddy.validateToken(TEST_TOKEN)).rejects.toEqual(
      expect.objectContaining({ code: 'UPSTREAM_UNAVAILABLE', message: 'Provider request failed' }),
    );
  });

  it('rejects a declared content-length over the response size bound without reading the body', async () => {
    const oversized = new Response('[]', {
      headers: { 'content-length': String(GODADDY_MAX_RESPONSE_BYTES + 1) },
    });
    const textSpy = vi.spyOn(oversized, 'text');
    await expect(adapter(vi.fn().mockResolvedValue(oversized)).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    expect(textSpy).not.toHaveBeenCalled();
  });

  it('rejects an actual body over the response size bound even without a content-length header', async () => {
    const oversizedBody = JSON.stringify([domainEntry('x'.repeat(GODADDY_MAX_RESPONSE_BYTES), 1)]);
    const response = new Response(oversizedBody);
    response.headers.delete('content-length');
    await expect(adapter(vi.fn().mockResolvedValue(response)).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});

describe('GoDaddy domain discovery', () => {
  it('enumerates all pages with cursor pagination and normalized DNS-hosting evidence', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json([
        domainEntry('Example.COM.', 1, 'ACTIVE', ['ns1.domaincontrol.com', 'ns2.domaincontrol.com']),
      ], { headers: { 'content-length': '9999' } }))
      .mockResolvedValueOnce(json([]));
    const result = await adapter(fetchMock, { pageSize: 1 }).discoverDomains(TEST_TOKEN);

    expect(result).toMatchObject({
      completion: 'COMPLETE',
      domains: [
        {
          canonicalDomain: 'example.com',
          dnsHostedByProvider: true,
          externalResourceId: '1',
          // Normalized to lowercase from GoDaddy's uppercase "ACTIVE" to
          // satisfy the shared reconciler's canonical status format.
          providerStatus: 'active',
        },
      ],
      externalResourceType: 'godaddy.domain',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('includes=nameServers');
    // The cursor must be the raw value GoDaddy returned, not our normalized form.
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('marker=Example.COM.');
  });

  it('treats a domain without GoDaddy nameservers as not DNS-hosted by the provider', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json([
      domainEntry('elsewhere.example', 2, 'ACTIVE', ['ns1.elsewhere.example']),
    ])), { pageSize: 50 }).discoverDomains(TEST_TOKEN);
    expect(result.domains).toEqual([
      expect.objectContaining({ dnsHostedByProvider: false, externalResourceId: '2' }),
    ]);
  });

  it('treats a first short page as a complete enumeration', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json([])), { pageSize: 50 })
      .discoverDomains(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'COMPLETE', domains: [] });
  });

  it('returns a partial result when a later page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json([domainEntry('one.example', 1)]))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(adapter(fetchMock, { pageSize: 1 }).discoverDomains(TEST_TOKEN)).resolves.toMatchObject({
      completion: 'PARTIAL',
      domains: [{ externalResourceId: '1' }],
      error: { code: 'UPSTREAM_UNAVAILABLE' },
    });
  });

  it('stops at the configured safety bound instead of trusting endless pagination', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json([domainEntry('one.example', 1)]))
      .mockResolvedValueOnce(json([domainEntry('two.example', 2)]));
    const result = await adapter(fetchMock, { maxPages: 2, pageSize: 1 }).discoverDomains(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'PARTIAL', error: { code: 'UPSTREAM_BAD_RESPONSE' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed domain entries', async () => {
    await expect(
      adapter(vi.fn().mockResolvedValue(json([{ domain: '*bad.example', domainId: 1, status: 'ACTIVE' }])))
        .discoverDomains(TEST_TOKEN),
    ).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
