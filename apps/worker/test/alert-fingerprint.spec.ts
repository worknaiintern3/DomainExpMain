import { describe, expect, it } from 'vitest';

import {
  daysUntil,
  dnsFingerprint,
  tlsFingerprint,
} from '../src/alerts/alert-fingerprint';
import type {
  AlertDnsSnapshot,
  AlertTlsSnapshot,
} from '../src/alerts/alert.types';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function dnsSnapshot(
  overrides: Partial<AlertDnsSnapshot> = {},
): AlertDnsSnapshot {
  return {
    aRecords: ['93.184.216.34'],
    aaaaRecords: ['2606:2800:220:1:248:1893:25c8:1946'],
    cnameRecords: [],
    dsRecords: [],
    lastAttemptStatus: 'SUCCESS',
    mxRecords: [{ exchange: 'mail.example.com', priority: 10 }],
    nsRecords: ['ns1.example.com', 'ns2.example.com'],
    retrievedAt: NOW,
    txtRecordCount: 2,
    ...overrides,
  };
}

function tlsSnapshot(
  overrides: Partial<AlertTlsSnapshot> = {},
): AlertTlsSnapshot {
  return {
    fingerprint256: 'AA:BB:CC',
    issuerCommonName: 'Example CA',
    issuerOrganization: 'Example Org',
    lastAttemptStatus: 'SUCCESS',
    retrievedAt: NOW,
    serialNumber: '01:02',
    subjectAltNames: ['example.com', 'www.example.com'],
    subjectCommonName: 'example.com',
    validFrom: new Date('2025-01-01T00:00:00.000Z'),
    validTo: new Date('2027-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('alert fingerprints', () => {
  it('computes whole days remaining with floor semantics', () => {
    expect(daysUntil(new Date('2026-03-08T00:00:00.000Z'), NOW)).toBe(7);
    expect(daysUntil(new Date('2026-03-08T12:00:00.000Z'), NOW)).toBe(7);
    expect(daysUntil(new Date('2026-02-28T12:00:00.000Z'), NOW)).toBe(-1);
    expect(daysUntil(NOW, NOW)).toBe(0);
  });

  it('is deterministic for identical DNS snapshots', () => {
    expect(dnsFingerprint(dnsSnapshot())).toBe(dnsFingerprint(dnsSnapshot()));
  });

  it('normalizes DNS ordering and casing before hashing', () => {
    const reordered = dnsSnapshot({
      aRecords: ['93.184.216.34'],
      mxRecords: [{ exchange: 'MAIL.EXAMPLE.COM.', priority: 10 }],
      nsRecords: ['NS2.EXAMPLE.COM.', 'ns1.example.com'],
    });
    expect(dnsFingerprint(reordered)).toBe(dnsFingerprint(dnsSnapshot()));
  });

  it('changes the DNS fingerprint when record data changes', () => {
    expect(
      dnsFingerprint(dnsSnapshot({ aRecords: ['93.184.216.35'] })),
    ).not.toBe(dnsFingerprint(dnsSnapshot()));
    expect(
      dnsFingerprint(dnsSnapshot({ txtRecordCount: 3 })),
    ).not.toBe(dnsFingerprint(dnsSnapshot()));
  });

  it('ignores record-level errors so partial noise does not flap DNS identity', () => {
    const withErrors = dnsSnapshot({ lastAttemptStatus: 'PARTIAL' });
    expect(dnsFingerprint(withErrors)).toBe(dnsFingerprint(dnsSnapshot()));
  });

  it('is deterministic for identical TLS snapshots', () => {
    expect(tlsFingerprint(tlsSnapshot())).toBe(tlsFingerprint(tlsSnapshot()));
  });

  it('changes the TLS fingerprint when certificate identity changes', () => {
    expect(
      tlsFingerprint(tlsSnapshot({ serialNumber: 'FF:00' })),
    ).not.toBe(tlsFingerprint(tlsSnapshot()));
    expect(
      tlsFingerprint(
        tlsSnapshot({ subjectAltNames: ['example.com', 'api.example.com'] }),
      ),
    ).not.toBe(tlsFingerprint(tlsSnapshot()));
  });
});
