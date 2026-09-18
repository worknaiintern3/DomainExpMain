import { describe, expect, it, vi } from 'vitest';

import { NamecheapAdapter, parseNamecheapRetryAfter } from '../src/providers/namecheap/namecheap.adapter';
import { NAMECHEAP_MAX_RESPONSE_BYTES } from '../src/providers/namecheap/namecheap.constants';

const VALID_CREDENTIAL = JSON.stringify({
  apiKey: 'not-a-real-namecheap-api-key',
  apiUser: 'domainpulse-user',
  clientIp: '203.0.113.10',
  userName: 'domainpulse-user',
});

function xml(body: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'text/xml');
  return new Response(body, { ...init, headers });
}

function domainXml(
  id: number,
  name: string,
  { autoRenew = true, isExpired = false, isOurDns = true }: {
    readonly autoRenew?: boolean;
    readonly isExpired?: boolean;
    readonly isOurDns?: boolean;
  } = {},
): string {
  return `<Domain ID="${String(id)}" Name="${name}" Created="01/01/2020" Expires="01/01/2030" IsExpired="${String(isExpired)}" IsLocked="false" AutoRenew="${String(autoRenew)}" WhoisGuard="ENABLED" IsPremium="false" IsOurDNS="${String(isOurDns)}"/>`;
}

function listResponseXml(
  domains: readonly string[],
  { currentPage = 1, pageSize = 100, totalItems }: {
    readonly currentPage?: number;
    readonly pageSize?: number;
    readonly totalItems?: number;
  } = {},
): string {
  const total = totalItems ?? domains.length;
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <Errors></Errors>
  <CommandResponse Type="namecheap.domains.getList">
    <DomainGetListResult>${domains.join('')}</DomainGetListResult>
    <Paging>
      <TotalItems>${String(total)}</TotalItems>
      <CurrentPage>${String(currentPage)}</CurrentPage>
      <PageSize>${String(pageSize)}</PageSize>
    </Paging>
  </CommandResponse>
</ApiResponse>`;
}

function errorResponseXml(number: number, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="ERROR" xmlns="http://api.namecheap.com/xml.response">
  <Errors>
    <Error Number="${String(number)}">${message}</Error>
  </Errors>
  <CommandResponse Type="namecheap.domains.getList"></CommandResponse>
</ApiResponse>`;
}

function adapter(
  fetchMock: ReturnType<typeof vi.fn>,
  options: { readonly maxPages?: number; readonly pageSize?: number; readonly timeoutMs?: number } = {},
): NamecheapAdapter {
  return new NamecheapAdapter({
    fetchImplementation: fetchMock as unknown as typeof fetch,
    ...options,
  });
}

describe('Namecheap credential parsing', () => {
  it('rejects a blank/whitespace credential before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    await expect(adapter(fetchMock).validateToken('   ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-JSON and JSON missing required fields before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    await expect(adapter(fetchMock).validateToken('not-json')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(
      adapter(fetchMock).validateToken(JSON.stringify({ apiKey: 'x' })),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-IPv4 clientIp before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const bad = JSON.stringify({
      apiKey: 'k', apiUser: 'u', clientIp: 'not-an-ip', userName: 'u',
    });
    await expect(adapter(fetchMock).validateToken(bad)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Namecheap token validation', () => {
  it('validates via the smallest real domain-list read and reports honest capabilities', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xml(listResponseXml([])));
    const nc = adapter(fetchMock);
    await expect(nc.validateToken(VALID_CREDENTIAL)).resolves.toMatchObject({ status: 'ACTIVE', valid: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('Command=namecheap.domains.getList');
    expect(nc.capabilities).toMatchObject({ listDomains: true, manageDnsRecords: false, readDnsRecords: false });
  });

  it('never follows an HTTP redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xml(listResponseXml([])));
    await adapter(fetchMock).validateToken(VALID_CREDENTIAL);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe('error');
  });

  it('maps an XML-level "API Key is invalid" error to a truthful "not active" result, not a thrown error', async () => {
    const nc = adapter(vi.fn().mockResolvedValue(
      xml(errorResponseXml(1011102, 'API Key is invalid or API access has not been enabled')),
    ));
    await expect(nc.validateToken(VALID_CREDENTIAL)).resolves.toEqual({
      errorCode: 'AUTH_INVALID', status: 'INVALID', valid: false,
    });
  });

  it('maps an XML-level "not whitelisted" IP error to a distinct PERMISSION_DENIED, never conflated with an invalid key', async () => {
    const nc = adapter(vi.fn().mockResolvedValue(
      xml(errorResponseXml(1011147, 'IP address 203.0.113.10 is not whitelisted')),
    ));
    await expect(nc.validateToken(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('maps an unrecognized XML-level error message to the safe UNKNOWN_PROVIDER_ERROR fallback, never fabricating a more specific code', async () => {
    const nc = adapter(vi.fn().mockResolvedValue(xml(errorResponseXml(9_999_999, 'Some new error text'))));
    await expect(nc.validateToken(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UNKNOWN_PROVIDER_ERROR' });
  });

  it('classifies error 1011105 ("Parameter ClientIP is invalid") as PERMISSION_DENIED by its documented numeric code, not INVALID_REQUEST from the message text', async () => {
    const nc = adapter(vi.fn().mockResolvedValue(xml(errorResponseXml(1_011_105, 'Parameter ClientIP is invalid'))));
    await expect(nc.validateToken(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('classifies error 1011102 by its documented numeric code even when the message text alone would not match any known fallback', async () => {
    const nc = adapter(vi.fn().mockResolvedValue(xml(errorResponseXml(1_011_102, 'A rephrased upstream message'))));
    await expect(nc.validateToken(VALID_CREDENTIAL)).resolves.toMatchObject({ status: 'INVALID', valid: false });
  });

  it('classifies a documented 1010xxx parameter code as INVALID_REQUEST', async () => {
    const nc = adapter(vi.fn().mockResolvedValue(xml(errorResponseXml(1_010_104, 'Parameter Command is missing'))));
    await expect(nc.validateToken(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('classifies the documented rate-limit code 500000 as RATE_LIMITED', async () => {
    const nc = adapter(vi.fn().mockResolvedValue(xml(errorResponseXml(500_000, 'Too many requests'))));
    await expect(nc.validateToken(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it.each([
    [400, 'INVALID_REQUEST'],
    [403, 'PERMISSION_DENIED'],
    [404, 'RESOURCE_NOT_FOUND'],
    [418, 'UNKNOWN_PROVIDER_ERROR'],
    [500, 'UPSTREAM_UNAVAILABLE'],
  ] as const)('maps HTTP-level %s (transport failure, not the XML error model) to %s', async (status, code) => {
    const nc = adapter(vi.fn().mockResolvedValue(new Response('', { status })));
    await expect(nc.validateToken(VALID_CREDENTIAL)).rejects.toMatchObject({ code });
  });

  it('maps HTTP-level 429 and bounds Retry-After', async () => {
    const nc = adapter(vi.fn().mockResolvedValue(new Response('', {
      headers: { 'retry-after': '45' },
      status: 429,
    })));
    await expect(nc.validateToken(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 45 });
    expect(parseNamecheapRetryAfter('not-a-date', 0)).toBeNull();
  });

  it('aborts a timed-out request and classifies it safely', async () => {
    const fetchMock = vi.fn((_input: unknown, init?: { readonly signal?: AbortSignal | null }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('test timeout', 'AbortError'));
        });
      }));
    await expect(adapter(fetchMock, { timeoutMs: 5 }).validateToken(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('classifies transport failures without retaining their details', async () => {
    const nc = adapter(vi.fn().mockRejectedValue(new Error('network failure with secret in it')));
    await expect(nc.validateToken(VALID_CREDENTIAL)).rejects.toEqual(
      expect.objectContaining({ code: 'UPSTREAM_UNAVAILABLE', message: 'Provider request failed' }),
    );
  });

  it('rejects malformed (non-XML) responses', async () => {
    await expect(adapter(vi.fn().mockResolvedValue(xml('not xml at all <<<'))).validateToken(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('rejects a response missing the ApiResponse root', async () => {
    await expect(adapter(vi.fn().mockResolvedValue(xml('<Unexpected/>'))).validateToken(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('rejects a declared content-length over the response size bound without reading the body', async () => {
    const oversized = xml(listResponseXml([]), {
      headers: { 'content-length': String(NAMECHEAP_MAX_RESPONSE_BYTES + 1) },
    });
    const textSpy = vi.spyOn(oversized, 'text');
    await expect(adapter(vi.fn().mockResolvedValue(oversized)).validateToken(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    expect(textSpy).not.toHaveBeenCalled();
  });

  it('rejects an actual body over the response size bound even without a content-length header', async () => {
    const oversizedXml = listResponseXml([domainXml(1, 'a'.repeat(NAMECHEAP_MAX_RESPONSE_BYTES))]);
    const response = xml(oversizedXml);
    response.headers.delete('content-length');
    await expect(adapter(vi.fn().mockResolvedValue(response)).validateToken(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});

describe('Namecheap domain discovery', () => {
  it('normalizes domains and maps IsOurDNS/IsExpired truthfully', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xml(listResponseXml([
      domainXml(1, 'Example.COM.', { isOurDns: true }),
      domainXml(2, 'other.example', { isExpired: true, isOurDns: false }),
    ])));
    const result = await adapter(fetchMock).discoverDomains(VALID_CREDENTIAL);

    expect(result).toEqual({
      completion: 'COMPLETE',
      domains: [
        {
          canonicalDomain: 'example.com',
          dnsHostedByProvider: true,
          externalResourceId: '1',
          providerStatus: 'active',
        },
        {
          canonicalDomain: 'other.example',
          dnsHostedByProvider: false,
          externalResourceId: '2',
          providerStatus: 'expired',
        },
      ],
      error: null,
      externalResourceType: 'namecheap.domain',
    });
  });

  it('treats a single-result page (Domain is an object, not an array) as one domain', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xml(listResponseXml([domainXml(1, 'solo.example')])));
    const result = await adapter(fetchMock).discoverDomains(VALID_CREDENTIAL);
    expect(result.domains).toHaveLength(1);
  });

  it('treats a zero-result account as a complete empty enumeration', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(xml(listResponseXml([])))).discoverDomains(VALID_CREDENTIAL);
    expect(result).toMatchObject({ completion: 'COMPLETE', domains: [] });
  });

  it('paginates using Page/PageSize/TotalItems until every domain is seen', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(xml(listResponseXml([domainXml(1, 'one.example')], { currentPage: 1, pageSize: 1, totalItems: 2 })))
      .mockResolvedValueOnce(xml(listResponseXml([domainXml(2, 'two.example')], { currentPage: 2, pageSize: 1, totalItems: 2 })));
    const result = await adapter(fetchMock, { pageSize: 10 }).discoverDomains(VALID_CREDENTIAL);

    expect(result).toMatchObject({ completion: 'COMPLETE' });
    expect(result.domains.map((d) => d.externalResourceId)).toEqual(['1', '2']);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('Page=1');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('Page=2');
  });

  it('returns a partial result when a later page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(xml(listResponseXml([domainXml(1, 'one.example')], { pageSize: 1, totalItems: 2 })))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(adapter(fetchMock, { pageSize: 10 }).discoverDomains(VALID_CREDENTIAL)).resolves.toMatchObject({
      completion: 'PARTIAL',
      domains: [{ externalResourceId: '1' }],
      error: { code: 'UPSTREAM_UNAVAILABLE' },
    });
  });

  it('stops at the configured safety bound instead of trusting an inconsistent TotalItems', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(xml(listResponseXml([domainXml(1, 'one.example')], { pageSize: 1, totalItems: 9_999 })))
      .mockResolvedValueOnce(xml(listResponseXml([domainXml(2, 'two.example')], { pageSize: 1, totalItems: 9_999 })));
    const result = await adapter(fetchMock, { maxPages: 2, pageSize: 10 }).discoverDomains(VALID_CREDENTIAL);
    expect(result).toMatchObject({ completion: 'PARTIAL', error: { code: 'UPSTREAM_BAD_RESPONSE' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed domain entries', async () => {
    await expect(
      adapter(vi.fn().mockResolvedValue(xml(listResponseXml(['<Domain ID="1" Name="*bad.example" Expires="x" IsExpired="false" IsOurDNS="false" AutoRenew="false"/>']))))
        .discoverDomains(VALID_CREDENTIAL),
    ).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
