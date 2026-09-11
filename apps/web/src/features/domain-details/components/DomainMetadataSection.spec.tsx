import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { DomainMetadataResponse } from '@/api/types';
import { DomainMetadataSection } from './DomainMetadataSection';

const attemptedAt = '2030-01-02T03:04:05.000Z';
const metadata: DomainMetadataResponse = {
  canRefresh: true,
  dns: {
    aRecords: ['203.0.113.1'],
    aaaaRecords: ['2001:db8::1'],
    cnameRecords: [],
    dsRecords: [{ algorithm: 13, digest: 'ABCD', digestType: 2, keyTag: 100 }],
    lastAttemptedAt: attemptedAt,
    lastAttemptStatus: 'PARTIAL',
    lastErrorCode: 'DNS_PARTIAL_FAILURE',
    mxRecords: [{ exchange: 'mx.example.com', priority: 10 }],
    nsRecords: ['ns1.example.com'],
    provenance: 'DNS_RETRIEVED',
    recordErrors: { CNAME: 'DNS_RESOLVER_ERROR' },
    retrievedAt: attemptedAt,
    txtRecordCount: 3,
  },
  domainId: '00000000-0000-4000-8000-000000000001',
  rdap: {
    changedAt: attemptedAt,
    expiresAt: '2031-01-02T03:04:05.000Z',
    lastAttemptedAt: attemptedAt,
    lastAttemptStatus: 'SUCCESS',
    lastErrorCode: null,
    nameservers: ['ns1.example.com'],
    provenance: 'RDAP_RETRIEVED',
    registeredAt: '2020-01-02T03:04:05.000Z',
    registrarIanaId: '999',
    registrarName: 'Example Registrar',
    retrievedAt: attemptedAt,
    secureDnsDelegationSigned: true,
    sourceUrl: 'https://rdap.example/domain/example.com',
    statuses: ['active'],
  },
  tls: {
    fingerprint256: 'AA:BB:CC',
    issuerCommonName: 'Example CA',
    issuerOrganization: 'Example Trust',
    lastAttemptedAt: attemptedAt,
    lastAttemptStatus: 'SUCCESS',
    lastErrorCode: null,
    provenance: 'SSL_RETRIEVED',
    retrievedAt: attemptedAt,
    serialNumber: '01AB',
    subjectAltNames: ['example.com', 'www.example.com'],
    subjectCommonName: 'example.com',
    validFrom: '2029-01-02T03:04:05.000Z',
    validTo: '2031-01-02T03:04:05.000Z',
  },
};

function render(input: Partial<React.ComponentProps<typeof DomainMetadataSection>> = {}): string {
  return renderToStaticMarkup(<DomainMetadataSection
    error={null}
    loading={false}
    metadata={metadata}
    notice={null}
    onRefresh={vi.fn()}
    onRetry={vi.fn()}
    refreshing={false}
    {...input}
  />);
}

describe('DomainMetadataSection', () => {
  it('renders successful and partial RDAP, DNS, and TLS snapshots truthfully', () => {
    const html = render();
    expect(html).toContain('Example Registrar');
    expect(html).toContain('Delegation signed');
    expect(html).toContain('Partial result retrieved');
    expect(html).toContain('3 TXT records detected');
    expect(html).toContain('CNAME: Dns Resolver Error');
    expect(html).toContain('Example CA');
    expect(html).toContain('AA:BB:CC');
    expect(html).not.toContain('DNSSEC validated');
    expect(html).not.toContain('Healthy');
    expect(html).not.toContain('Online');
  });

  it('shows three never-checked cards without fake data and keeps members read-only', () => {
    const html = render({ metadata: { canRefresh: false, dns: null, domainId: metadata.domainId, rdap: null, tls: null } });
    expect(html.match(/Not checked yet/gu)).toHaveLength(3);
    expect(html).toContain('Read-only access');
    expect(html).not.toContain('Refresh metadata');
    expect(html).not.toContain('Example Registrar');
  });

  it('distinguishes a failed latest attempt while retaining a stale snapshot', () => {
    const html = render({
      metadata: {
        ...metadata,
        rdap: metadata.rdap && {
          ...metadata.rdap,
          lastAttemptStatus: 'FAILED',
          lastErrorCode: 'RDAP_LOOKUP_TIMEOUT',
        },
      },
    });
    expect(html).toContain('Latest refresh failed. Showing data retrieved on');
    expect(html).toContain('Example Registrar');
    expect(html).toContain('Latest attempt: Rdap Lookup Timeout');
  });

  it('renders loading, refresh, and API error states', () => {
    expect(render({ loading: true, metadata: null })).toContain('Loading retrieved metadata...');
    expect(render({ refreshing: true })).toContain('Refreshing metadata...');
    const error = render({ error: 'Metadata request failed.', metadata: null });
    expect(error).toContain('Metadata request failed.');
    expect(error).toContain('Retry');
  });

  it('never renders DNS TXT contents because the public model contains count only', () => {
    const html = render();
    expect(html).not.toContain('v=spf1');
    expect(html).not.toContain('verification-token');
  });
});
