import { describe, expect, it, vi } from 'vitest';

import { CloudflareAdapter, parseCloudflareRetryAfter } from '../src/providers/cloudflare/cloudflare.adapter';
import { CLOUDFLARE_MAX_RESPONSE_BYTES } from '../src/providers/cloudflare/cloudflare.constants';

const TEST_TOKEN = 'not-a-real-cloudflare-token';

function json(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(value), {
    ...init,
    headers,
  });
}

function tokenResponse(status: 'active' | 'disabled' | 'expired' = 'active') {
  return {
    result: {
      expires_on: '2030-01-01T00:00:00Z',
      id: 'token-id-safe-metadata',
      not_before: '2026-01-01T00:00:00Z',
      status,
    },
    success: true,
  };
}

function zone(
  id: string,
  name: string,
  type: 'full' | 'partial' | 'secondary' | 'internal' = 'full',
  status: 'initializing' | 'pending' | 'active' | 'moved' = 'active',
) {
  return { id, name, status, type };
}

function page(
  currentPage: number,
  totalPages: number,
  result: readonly ReturnType<typeof zone>[],
) {
  return {
    result,
    result_info: {
      count: result.length,
      page: currentPage,
      per_page: 50,
      total_count: result.length,
      total_pages: totalPages,
    },
    success: true,
  };
}

function adapter(fetchMock: ReturnType<typeof vi.fn>, options: {
  readonly maxPages?: number;
  readonly timeoutMs?: number;
} = {}): CloudflareAdapter {
  return new CloudflareAdapter({
    fetchImplementation: fetchMock as unknown as typeof fetch,
    ...options,
  });
}

describe('Cloudflare token validation', () => {
  it('returns only normalized safe metadata for a valid token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(tokenResponse()));
    const result = await adapter(fetchMock).validateToken(TEST_TOKEN);

    expect(result).toEqual({
      expiresAt: '2030-01-01T00:00:00.000Z',
      notBefore: '2026-01-01T00:00:00.000Z',
      providerTokenId: 'token-id-safe-metadata',
      status: 'ACTIVE',
      valid: true,
    });
    expect(JSON.stringify(result)).not.toContain(TEST_TOKEN);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
    );
  });

  it('returns a sanitized invalid result for rejected, disabled, and expired tokens', async () => {
    const invalid = adapter(vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(invalid.validateToken(TEST_TOKEN)).resolves.toEqual({
      errorCode: 'AUTH_INVALID', status: 'INVALID', valid: false,
    });

    for (const status of ['disabled', 'expired'] as const) {
      await expect(adapter(vi.fn().mockResolvedValue(json(tokenResponse(status)))).validateToken(TEST_TOKEN))
        .resolves.toMatchObject({ errorCode: 'AUTH_INVALID', valid: false });
    }
  });

  it.each([
    [400, 'INVALID_REQUEST'],
    [403, 'PERMISSION_DENIED'],
    [404, 'RESOURCE_NOT_FOUND'],
    [418, 'UNKNOWN_PROVIDER_ERROR'],
    [500, 'UPSTREAM_UNAVAILABLE'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    const cloudflare = adapter(
      vi.fn().mockResolvedValue(new Response('', { status })),
    );
    await expect(cloudflare.validateToken(TEST_TOKEN)).rejects.toMatchObject({ code });
  });

  it('maps 429 and bounds Retry-After without exposing the response body', async () => {
    const cloudflare = adapter(vi.fn().mockResolvedValue(new Response('sensitive', {
      headers: { 'retry-after': '120' },
      status: 429,
    })));
    await expect(cloudflare.validateToken(TEST_TOKEN)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Provider request failed',
      retryAfterSeconds: 120,
    });
    expect(parseCloudflareRetryAfter('999999999', 0)).toBe(86_400);
    expect(parseCloudflareRetryAfter('not-a-date', 0)).toBeNull();
    expect(parseCloudflareRetryAfter('Thu, 01 Jan 2026 00:01:00 GMT', Date.parse('2026-01-01T00:00:00Z')))
      .toBe(60);
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

  it('rejects malformed JSON and invalid successful schemas', async () => {
    await expect(adapter(vi.fn().mockResolvedValue(new Response('{bad'))).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    await expect(adapter(vi.fn().mockResolvedValue(json({ success: true }))).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('classifies transport failures without retaining their details', async () => {
    const cloudflare = adapter(
      vi.fn().mockRejectedValue(new Error(`network failure ${TEST_TOKEN}`)),
    );
    await expect(cloudflare.validateToken(TEST_TOKEN)).rejects.toEqual(
      expect.objectContaining({
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'Provider request failed',
      }),
    );
  });

  it('rejects a blank/whitespace token before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    await expect(adapter(fetchMock).validateToken('   ')).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows an HTTP redirect (always requests redirect: "error")', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(tokenResponse()));
    await adapter(fetchMock).validateToken(TEST_TOKEN);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe('error');
  });

  it('rejects a declared content-length over the response size bound without reading the body', async () => {
    const oversized = new Response('{}', {
      headers: { 'content-length': String(CLOUDFLARE_MAX_RESPONSE_BYTES + 1) },
    });
    const textSpy = vi.spyOn(oversized, 'text');
    await expect(adapter(vi.fn().mockResolvedValue(oversized)).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    expect(textSpy).not.toHaveBeenCalled();
  });

  it('rejects an actual body over the response size bound even without a content-length header', async () => {
    const oversizedBody = JSON.stringify({
      result: { id: 'x'.repeat(CLOUDFLARE_MAX_RESPONSE_BYTES), status: 'active' },
      success: true,
    });
    const response = new Response(oversizedBody);
    response.headers.delete('content-length');
    await expect(adapter(vi.fn().mockResolvedValue(response)).validateToken(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});

describe('Cloudflare zone discovery', () => {
  it('treats a validated empty first page as a complete enumeration', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json(page(1, 0, []))))
      .discoverDomains(TEST_TOKEN);
    expect(result).toMatchObject({ completion: 'COMPLETE', domains: [] });
  });

  it('enumerates all pages with bounded parameters and normalized DNS evidence', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(page(1, 2, [zone('zone-1', 'Example.COM.', 'full')])))
      .mockResolvedValueOnce(json(page(2, 2, [zone('zone-2', 'other.example', 'partial')])));
    const result = await adapter(fetchMock).discoverDomains(TEST_TOKEN);

    expect(result).toEqual({
      completion: 'COMPLETE',
      domains: [
        {
          canonicalDomain: 'example.com',
          dnsHostedByProvider: true,
          externalResourceId: 'zone-1',
          providerStatus: 'active',
        },
        {
          canonicalDomain: 'other.example',
          dnsHostedByProvider: false,
          externalResourceId: 'zone-2',
          providerStatus: 'active',
        },
      ],
      error: null,
      externalResourceType: 'cloudflare.zone',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('page=1&per_page=50');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('page=2&per_page=50');
  });

  it('uses the canonical IDNA normalizer and preserves distinct external identities', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json(page(1, 1, [
      zone('zone-unicode', 'b\u00fccher.example'),
      zone('zone-ascii', 'xn--bcher-kva.example'),
    ])))).discoverDomains(TEST_TOKEN);

    expect(result.domains).toHaveLength(2);
    expect(result.domains.map(({ canonicalDomain }) => canonicalDomain))
      .toEqual(['xn--bcher-kva.example', 'xn--bcher-kva.example']);
  });

  it('requires active full-zone evidence before asserting Cloudflare DNS hosting', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(json(page(1, 1, [
      zone('zone-active', 'active.example'),
      zone('zone-pending', 'pending.example', 'full', 'pending'),
      zone('zone-partial', 'partial.example', 'partial'),
    ])))).discoverDomains(TEST_TOKEN);
    expect(result.domains.map(({ dnsHostedByProvider }) => dnsHostedByProvider))
      .toEqual([true, false, false]);
  });

  it('returns a partial result when a later page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(page(1, 2, [zone('zone-1', 'example.com')])))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(adapter(fetchMock).discoverDomains(TEST_TOKEN)).resolves.toMatchObject({
      completion: 'PARTIAL',
      domains: [{ externalResourceId: 'zone-1' }],
      error: { code: 'UPSTREAM_UNAVAILABLE' },
    });
  });

  it('keeps an empty successful page partial when the following page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(page(1, 2, [])))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(adapter(fetchMock).discoverDomains(TEST_TOKEN)).resolves.toMatchObject({
      completion: 'PARTIAL',
      domains: [],
      error: { code: 'UPSTREAM_UNAVAILABLE' },
    });
  });

  it('stops at the configured safety bound instead of trusting endless pagination', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(page(1, 10, [zone('zone-1', 'one.example')])))
      .mockResolvedValueOnce(json(page(2, 10, [zone('zone-2', 'two.example')])));
    const result = await adapter(fetchMock, { maxPages: 2 }).discoverDomains(TEST_TOKEN);
    expect(result).toMatchObject({
      completion: 'PARTIAL',
      error: { code: 'UPSTREAM_BAD_RESPONSE' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects inconsistent pagination and malformed zones', async () => {
    await expect(adapter(vi.fn().mockResolvedValue(json(page(2, 2, [])))).discoverDomains(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    await expect(adapter(vi.fn().mockResolvedValue(json(page(1, 1, [zone('zone-1', '*bad.example')])))).discoverDomains(TEST_TOKEN))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
