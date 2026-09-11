/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it, vi } from 'vitest';

import { DnsClient, type DnsResolver } from '../src/metadata/dns/dns.client';

function resolver(overrides: Partial<DnsResolver> = {}): DnsResolver {
  return {
    resolve4: vi.fn(async () => ['203.0.113.2', '198.51.100.1', '203.0.113.2']),
    resolve6: vi.fn(async () => ['2001:db8::2', '2001:db8::1']),
    resolveCname: vi.fn(async () => ['TARGET.EXAMPLE.COM.']),
    resolveDs: vi.fn(async () => [
      { algorithm: 13, digest: 'abcd', digestType: 2, keyTag: 20 },
      { algorithm: 8, digest: 'ef01', digestType: 2, keyTag: 10 },
    ]),
    resolveMx: vi.fn(async () => [
      { exchange: 'MX2.EXAMPLE.COM.', priority: 20 },
      { exchange: 'mx1.example.com', priority: 10 },
    ]),
    resolveNs: vi.fn(async () => ['NS2.EXAMPLE.COM.', 'ns1.example.com']),
    resolveTxt: vi.fn(async () => [['private-verification-token'], ['v=spf1 private']]),
    ...overrides,
  };
}

function dnsError(code: string): Error {
  return Object.assign(new Error('raw resolver detail'), { code });
}

describe('DNS retrieval and normalization', () => {
  it('normalizes all record types deterministically and retains TXT count only', async () => {
    const result = await new DnsClient(resolver()).retrieve('example.com');
    expect(result).toEqual({
      errorCode: null,
      snapshot: {
        aRecords: ['198.51.100.1', '203.0.113.2'],
        aaaaRecords: ['2001:db8::1', '2001:db8::2'],
        cnameRecords: ['target.example.com'],
        dsRecords: [
          { algorithm: 8, digest: 'EF01', digestType: 2, keyTag: 10 },
          { algorithm: 13, digest: 'ABCD', digestType: 2, keyTag: 20 },
        ],
        mxRecords: [
          { exchange: 'mx1.example.com', priority: 10 },
          { exchange: 'mx2.example.com', priority: 20 },
        ],
        nsRecords: ['ns1.example.com', 'ns2.example.com'],
        recordErrors: {},
        txtRecordCount: 2,
      },
      status: 'SUCCESS',
    });
    expect(JSON.stringify(result)).not.toContain('private-verification-token');
    expect(JSON.stringify(result)).not.toContain('v=spf1');
  });

  it('treats normal record absence as empty data, not a resolver failure', async () => {
    const noData = () => Promise.reject(dnsError('ENODATA'));
    const result = await new DnsClient(resolver({
      resolve4: noData,
      resolve6: noData,
      resolveCname: noData,
      resolveDs: noData,
      resolveMx: noData,
      resolveNs: noData,
      resolveTxt: noData,
    })).retrieve('example.com');
    expect(result.status).toBe('SUCCESS');
    expect(result.snapshot).toMatchObject({ aRecords: [], recordErrors: {}, txtRecordCount: 0 });
  });

  it('returns usable PARTIAL results with per-record sanitized errors', async () => {
    const result = await new DnsClient(resolver({
      resolve4: vi.fn(async () => { throw dnsError('ETIMEOUT'); }),
      resolveMx: vi.fn(async () => { throw dnsError('ESERVFAIL'); }),
    })).retrieve('example.com');
    expect(result).toMatchObject({
      errorCode: 'DNS_PARTIAL_FAILURE',
      snapshot: { recordErrors: { A: 'DNS_TIMEOUT', MX: 'DNS_RESOLVER_ERROR' } },
      status: 'PARTIAL',
    });
    expect(JSON.stringify(result)).not.toContain('raw resolver detail');
  });

  it('returns FAILED only when every requested lookup has an actual failure', async () => {
    const failed = () => Promise.reject(dnsError('ESERVFAIL'));
    const result = await new DnsClient(resolver({
      resolve4: failed,
      resolve6: failed,
      resolveCname: failed,
      resolveDs: failed,
      resolveMx: failed,
      resolveNs: failed,
      resolveTxt: failed,
    })).retrieve('example.com');
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('DNS_RETRIEVAL_FAILED');
    expect(Object.keys(result.snapshot.recordErrors)).toHaveLength(7);
  });
});
