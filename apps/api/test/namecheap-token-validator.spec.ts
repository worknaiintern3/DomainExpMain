import { describe, expect, it, vi } from 'vitest';

import {
  NamecheapTokenValidationError,
  NamecheapTokenValidator,
} from '../src/provider-connections/namecheap-token-validator';

const MAX_RESPONSE_BYTES = 2_000_000;

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

function okXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <Errors></Errors>
  <CommandResponse Type="namecheap.domains.getList">
    <DomainGetListResult></DomainGetListResult>
    <Paging><TotalItems>0</TotalItems><CurrentPage>1</CurrentPage><PageSize>10</PageSize></Paging>
  </CommandResponse>
</ApiResponse>`;
}

function errorXml(number: number, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="ERROR" xmlns="http://api.namecheap.com/xml.response">
  <Errors><Error Number="${String(number)}">${message}</Error></Errors>
  <CommandResponse Type="namecheap.domains.getList"></CommandResponse>
</ApiResponse>`;
}

function fetchReturning(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as typeof fetch;
}

describe('NamecheapTokenValidator credential parsing', () => {
  it('rejects a blank/whitespace credential before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new NamecheapTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(validator.isTokenActive('   ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-JSON and JSON missing required fields before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new NamecheapTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(validator.isTokenActive('not-json')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(validator.isTokenActive(JSON.stringify({ apiKey: 'x' }))).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-IPv4 clientIp before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new NamecheapTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    const bad = JSON.stringify({ apiKey: 'k', apiUser: 'u', clientIp: 'not-an-ip', userName: 'u' });
    await expect(validator.isTokenActive(bad)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('NamecheapTokenValidator', () => {
  it('returns true for a credential that can list domains', async () => {
    const validator = new NamecheapTokenValidator({ fetchImplementation: fetchReturning(xml(okXml())) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(true);
  });

  it('maps an XML-level "API Key is invalid" error to a truthful "not active" result, not a thrown error', async () => {
    const validator = new NamecheapTokenValidator({
      fetchImplementation: fetchReturning(xml(errorXml(1_011_102, 'API Key is invalid or API access has not been enabled'))),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(false);
  });

  it('maps an XML-level "not whitelisted" IP error to a distinct PERMISSION_DENIED, never conflated with an invalid credential', async () => {
    const validator = new NamecheapTokenValidator({
      fetchImplementation: fetchReturning(xml(errorXml(1_011_147, 'IP address 203.0.113.10 is not whitelisted'))),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toBeInstanceOf(NamecheapTokenValidationError);
  });

  it('maps an unrecognized XML-level error message to the safe UNKNOWN_PROVIDER_ERROR fallback', async () => {
    const validator = new NamecheapTokenValidator({
      fetchImplementation: fetchReturning(xml(errorXml(9_999_999, 'Some new error text'))),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UNKNOWN_PROVIDER_ERROR' });
  });

  it('classifies error 1011105 ("Parameter ClientIP is invalid") as PERMISSION_DENIED by its documented numeric code, not INVALID_REQUEST from the message text', async () => {
    const validator = new NamecheapTokenValidator({
      fetchImplementation: fetchReturning(xml(errorXml(1_011_105, 'Parameter ClientIP is invalid'))),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('classifies error 1011102 by its documented numeric code even when the message text alone would not match any known fallback', async () => {
    const validator = new NamecheapTokenValidator({
      fetchImplementation: fetchReturning(xml(errorXml(1_011_102, 'A rephrased upstream message'))),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(false);
  });

  it('classifies a documented 1010xxx parameter code as INVALID_REQUEST', async () => {
    const validator = new NamecheapTokenValidator({
      fetchImplementation: fetchReturning(xml(errorXml(1_010_104, 'Parameter Command is missing'))),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('classifies the documented rate-limit code 500000 as RATE_LIMITED', async () => {
    const validator = new NamecheapTokenValidator({
      fetchImplementation: fetchReturning(xml(errorXml(500_000, 'Too many requests'))),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps HTTP-level 429 to RATE_LIMITED', async () => {
    const validator = new NamecheapTokenValidator({ fetchImplementation: fetchReturning(new Response('', { status: 429 })) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps a 5xx response to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new NamecheapTokenValidator({ fetchImplementation: fetchReturning(new Response('', { status: 503 })) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps an aborted request (timeout) to NETWORK_TIMEOUT', async () => {
    const validator = new NamecheapTokenValidator({
      fetchImplementation: vi.fn().mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }) as unknown as typeof fetch,
      timeoutMs: 5,
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('maps a network-level fetch failure (no abort) to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new NamecheapTokenValidator({
      fetchImplementation: vi.fn().mockRejectedValue(new Error('getaddrinfo failure')) as unknown as typeof fetch,
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps a malformed (non-XML) response to UPSTREAM_BAD_RESPONSE', async () => {
    const validator = new NamecheapTokenValidator({ fetchImplementation: fetchReturning(xml('not xml <<<')) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('never follows an HTTP redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xml(okXml()));
    const validator = new NamecheapTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive(VALID_CREDENTIAL);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe('error');
  });

  it('rejects a body over the response size bound', async () => {
    const oversizedXml = okXml().replace('</DomainGetListResult>', `${'x'.repeat(MAX_RESPONSE_BYTES)}</DomainGetListResult>`);
    const validator = new NamecheapTokenValidator({ fetchImplementation: fetchReturning(xml(oversizedXml)) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
