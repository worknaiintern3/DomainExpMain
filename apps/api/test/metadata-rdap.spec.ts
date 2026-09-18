/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it, vi } from 'vitest';

import { RdapClient, normalizeRdapResponse } from '../src/metadata/rdap/rdap.client';
import { RdapRetrievalError } from '../src/metadata/rdap/rdap.errors';

const safeLookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
const bootstrap = {
  services: [[['com'], ['https://rdap.registry.example/v1/']]],
};
const lookupBody = {
  entities: [{
    handle: 'REGISTRAR-1',
    publicIds: [{ identifier: '999', type: 'IANA Registrar ID' }],
    roles: ['registrar'],
    vcardArray: ['vcard', [
      ['version', {}, 'text', '4.0'],
      ['fn', {}, 'text', 'Example Registrar'],
      ['email', {}, 'text', 'private@example.test'],
    ]],
  }, {
    roles: ['registrant'],
    vcardArray: ['vcard', [['fn', {}, 'text', 'Private Person']]],
  }],
  events: [
    { eventAction: 'registration', eventDate: '2020-01-02T03:04:05Z' },
    { eventAction: 'expiration', eventDate: '2030-01-02T03:04:05Z' },
    { eventAction: 'last changed', eventDate: '2025-01-02T03:04:05Z' },
  ],
  nameservers: [{ ldhName: 'NS2.EXAMPLE.COM.' }, { ldhName: 'ns1.example.com' }, { ldhName: 'ns1.example.com' }],
  secureDNS: { delegationSigned: true },
  status: ['active', 'client transfer prohibited', 'active'],
};

function json(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return new Response(JSON.stringify(value), {
    ...init,
    headers,
  });
}

function client(fetchMock: ReturnType<typeof vi.fn>, options: { maxRedirects?: number; maxResponseBytes?: number } = {}) {
  return new RdapClient({
    fetchImplementation: fetchMock as unknown as typeof fetch,
    hostLookup: safeLookup,
    ...options,
  });
}

describe('RDAP normalization and privacy', () => {
  it('normalizes registrar, IANA ID, dates, statuses, nameservers, and delegation signal', () => {
    const result = normalizeRdapResponse(lookupBody, 'https://rdap.registry.example/v1/domain/example.com');
    expect(result).toMatchObject({
      changedAt: new Date('2025-01-02T03:04:05Z'),
      expiresAt: new Date('2030-01-02T03:04:05Z'),
      nameservers: ['ns1.example.com', 'ns2.example.com'],
      registeredAt: new Date('2020-01-02T03:04:05Z'),
      registrarIanaId: '999',
      registrarName: 'Example Registrar',
      secureDnsDelegationSigned: true,
      statuses: ['active', 'client transfer prohibited'],
    });
    expect(JSON.stringify(result)).not.toContain('private@example.test');
    expect(JSON.stringify(result)).not.toContain('Private Person');
  });

  it('treats missing optional fields as a usable response', () => {
    expect(normalizeRdapResponse({}, 'https://rdap.example/domain/example.com')).toMatchObject({
      nameservers: [],
      registrarName: null,
      secureDnsDelegationSigned: null,
      statuses: [],
    });
  });
});

describe('RDAP discovery and network behavior', () => {
  it('parses and caches IANA bootstrap data and selects the matching TLD service', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(bootstrap))
      .mockResolvedValueOnce(json(lookupBody))
      .mockResolvedValueOnce(json(lookupBody));
    const rdap = client(fetchMock);
    await rdap.retrieve('Example.COM');
    await rdap.retrieve('second.com');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('https://rdap.registry.example/v1/domain/example.com');
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe('https://rdap.registry.example/v1/domain/second.com');
  });

  it.each([
    [404, 'RDAP_LOOKUP_NOT_FOUND'],
    [503, 'RDAP_LOOKUP_HTTP_ERROR'],
  ] as const)('maps lookup HTTP %s to %s', async (status, code) => {
    const rdap = client(vi.fn()
      .mockResolvedValueOnce(json(bootstrap))
      .mockResolvedValueOnce(new Response('', { status })));
    await expect(rdap.retrieve('example.com')).rejects.toMatchObject({ code });
  });

  it('maps bootstrap and lookup timeouts without exposing network details', async () => {
    const timeout = new DOMException('sensitive timeout detail', 'TimeoutError');
    await expect(client(vi.fn().mockRejectedValue(timeout)).retrieve('example.com'))
      .rejects.toMatchObject({ code: 'RDAP_BOOTSTRAP_TIMEOUT' });
    await expect(client(vi.fn().mockResolvedValueOnce(json(bootstrap)).mockRejectedValueOnce(timeout)).retrieve('example.com'))
      .rejects.toMatchObject({ code: 'RDAP_LOOKUP_TIMEOUT' });
  });

  it('rejects malformed JSON and oversized responses', async () => {
    const invalid = client(vi.fn()
      .mockResolvedValueOnce(json(bootstrap))
      .mockResolvedValueOnce(new Response('{invalid')));
    await expect(invalid.retrieve('example.com')).rejects.toMatchObject({ code: 'RDAP_RESPONSE_INVALID' });

    const oversized = client(vi.fn()
      .mockResolvedValueOnce(json(bootstrap))
      .mockResolvedValueOnce(new Response('x'.repeat(200))), { maxResponseBytes: 100 });
    await expect(oversized.retrieve('example.com')).rejects.toMatchObject({ code: 'RDAP_RESPONSE_TOO_LARGE' });
  });

  it('rejects unsafe discovered URLs before issuing the lookup', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({
      services: [[['com'], ['https://localhost/rdap/']]],
    }));
    await expect(client(fetchMock).retrieve('example.com')).rejects.toMatchObject({ code: 'RDAP_UNSAFE_URL' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('validates and follows bounded manual redirects', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(bootstrap))
      .mockResolvedValueOnce(new Response('', { headers: { location: 'https://other.example/domain/example.com' }, status: 302 }))
      .mockResolvedValueOnce(json(lookupBody));
    await expect(client(fetchMock).retrieve('example.com')).resolves.toMatchObject({ snapshot: { registrarIanaId: '999' } });
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe('https://other.example/domain/example.com');
  });

  it('rejects redirects beyond the configured maximum', async () => {
    const redirect = () => new Response('', { headers: { location: 'https://next.example/rdap' }, status: 302 });
    const rdap = client(vi.fn()
      .mockResolvedValueOnce(json(bootstrap))
      .mockResolvedValueOnce(redirect())
      .mockResolvedValueOnce(redirect()), { maxRedirects: 1 });
    await expect(rdap.retrieve('example.com')).rejects.toMatchObject({ code: 'RDAP_TOO_MANY_REDIRECTS' });
  });

  it('rejects invalid domains and unsupported TLDs canonically', async () => {
    await expect(client(vi.fn()).retrieve('localhost')).rejects.toBeInstanceOf(RdapRetrievalError);
    const rdap = client(vi.fn().mockResolvedValueOnce(json(bootstrap)));
    await expect(rdap.retrieve('example.invalid')).rejects.toMatchObject({ code: 'RDAP_TLD_UNSUPPORTED' });
  });
});
