/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest';

import type { DnsRetrieval } from '../../api/src/metadata/dns/dns.client';
import type { MetadataStore } from '../../api/src/metadata/metadata.types';
import { RdapRetrievalError } from '../../api/src/metadata/rdap/rdap.errors';
import { TlsInspectionError } from '../../api/src/metadata/tls/tls.errors';
import {
  MetadataMonitoringExecutor,
  type MonitoringExecutorDependencies,
} from '../src/monitoring/monitoring.executor';
import type { ClaimedMonitoringRun } from '../src/monitoring/monitoring.types';

const run: ClaimedMonitoringRun = {
  attemptNo: 1,
  domainId: '10000000-0000-4000-8000-000000000001',
  idempotencyKey: 'scheduled:1',
  leaseExpiresAt: new Date('2026-01-01T00:05:00.000Z'),
  runId: '20000000-0000-4000-8000-000000000001',
  targetId: '30000000-0000-4000-8000-000000000001',
  workspaceId: '40000000-0000-4000-8000-000000000001',
};

const rdapSnapshot = {
  changedAt: null,
  expiresAt: null,
  nameservers: [],
  registeredAt: null,
  registrarIanaId: null,
  registrarName: null,
  secureDnsDelegationSigned: null,
  sourceUrl: 'https://rdap.invalid/domain/example.com',
  statuses: [],
};

const tlsSnapshot = {
  fingerprint256: null,
  issuerCommonName: null,
  issuerOrganization: null,
  serialNumber: null,
  subjectAltNames: [],
  subjectCommonName: 'example.com',
  validFrom: new Date('2025-01-01T00:00:00.000Z'),
  validTo: new Date('2027-01-01T00:00:00.000Z'),
};

function dnsResult(
  status: DnsRetrieval['status'] = 'SUCCESS',
  recordErrors: DnsRetrieval['snapshot']['recordErrors'] = {},
): DnsRetrieval {
  return {
    errorCode: status === 'SUCCESS' ? null : status === 'PARTIAL'
      ? 'DNS_PARTIAL_FAILURE'
      : 'DNS_RETRIEVAL_FAILED',
    snapshot: {
      aRecords: [],
      aaaaRecords: [],
      cnameRecords: [],
      dsRecords: [],
      mxRecords: [],
      nsRecords: [],
      recordErrors,
      txtRecordCount: 0,
    },
    status,
  };
}

function metadataStore(): MetadataStore {
  return {
    findDomain: vi.fn(),
    read: vi.fn(),
    recordDns: vi.fn(),
    recordRdapFailure: vi.fn(),
    recordRdapSuccess: vi.fn(),
    recordTlsFailure: vi.fn(),
    recordTlsSuccess: vi.fn(),
  };
}

function dependencies(
  overrides: Partial<MonitoringExecutorDependencies> = {},
): MonitoringExecutorDependencies {
  return {
    dns: { retrieve: vi.fn(async () => dnsResult()) },
    metadata: metadataStore(),
    rdap: { retrieve: vi.fn(async () => ({ snapshot: rdapSnapshot })) },
    tls: { retrieve: vi.fn(async () => tlsSnapshot) },
    ...overrides,
  };
}

function executor(deps: MonitoringExecutorDependencies): MetadataMonitoringExecutor {
  let monotonic = 10;
  return new MetadataMonitoringExecutor(deps, {
    monotonicNow: () => {
      monotonic += 5;
      return monotonic;
    },
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('metadata monitoring executor', () => {
  it('runs and persists all three Phase 8 retrieval clients independently', async () => {
    const deps = dependencies();
    const result = await executor(deps).execute(run, {
      normalizedDomainName: 'example.com',
    });
    expect(result).toMatchObject({
      durationMs: 5,
      errorCode: null,
      retryable: false,
      sourcesAttempted: ['rdap', 'dns', 'tls'],
      sourcesSucceeded: ['rdap', 'dns', 'tls'],
      status: 'SUCCESS',
    });
    expect(deps.metadata.recordRdapSuccess).toHaveBeenCalledOnce();
    expect(deps.metadata.recordDns).toHaveBeenCalledOnce();
    expect(deps.metadata.recordTlsSuccess).toHaveBeenCalledOnce();
  });

  it('retains usable DNS partial data and marks the overall run partial', async () => {
    const deps = dependencies({
      dns: {
        retrieve: vi.fn(async () => dnsResult('PARTIAL', { A: 'DNS_TIMEOUT' })),
      },
    });
    const result = await executor(deps).execute(run, {
      normalizedDomainName: 'example.com',
    });
    expect(result).toMatchObject({
      errorCode: 'MONITORING_PARTIAL_FAILURE',
      retryable: true,
      sourcesSucceeded: ['rdap', 'dns', 'tls'],
      status: 'PARTIAL',
    });
    expect(deps.metadata.recordDns).toHaveBeenCalledWith(
      run.workspaceId,
      run.domainId,
      expect.any(Date),
      expect.objectContaining({ status: 'PARTIAL' }),
    );
  });

  it('continues remaining sources after a transient RDAP failure', async () => {
    const deps = dependencies({
      rdap: {
        retrieve: vi.fn(async () => {
          throw new RdapRetrievalError('RDAP_LOOKUP_TIMEOUT');
        }),
      },
    });
    const result = await executor(deps).execute(run, {
      normalizedDomainName: 'example.com',
    });
    expect(result).toMatchObject({
      retryable: true,
      sourcesSucceeded: ['dns', 'tls'],
      status: 'PARTIAL',
    });
    expect(deps.metadata.recordRdapFailure).toHaveBeenCalledWith(
      run.workspaceId,
      run.domainId,
      expect.any(Date),
      'RDAP_LOOKUP_TIMEOUT',
    );
    expect(deps.metadata.recordDns).toHaveBeenCalledOnce();
    expect(deps.metadata.recordTlsSuccess).toHaveBeenCalledOnce();
  });

  it('classifies all unavailable sources as failed without leaking exceptions', async () => {
    const deps = dependencies({
      dns: { retrieve: vi.fn(async () => dnsResult('FAILED', { A: 'DNS_RESOLVER_ERROR' })) },
      rdap: { retrieve: vi.fn(async () => { throw new Error('sensitive RDAP detail'); }) },
      tls: { retrieve: vi.fn(async () => { throw new TlsInspectionError('TLS_CONNECTION_FAILED'); }) },
    });
    const result = await executor(deps).execute(run, {
      normalizedDomainName: 'example.com',
    });
    expect(result).toMatchObject({
      errorCode: 'MONITORING_ALL_SOURCES_FAILED',
      retryable: true,
      sourcesSucceeded: [],
      status: 'FAILED',
    });
    expect(JSON.stringify(result)).not.toContain('sensitive');
  });

  it('treats metadata persistence failure as transient while other sources finish', async () => {
    const metadata = metadataStore();
    vi.mocked(metadata.recordTlsSuccess).mockRejectedValueOnce(new Error('database detail'));
    const deps = dependencies({ metadata });
    const result = await executor(deps).execute(run, {
      normalizedDomainName: 'example.com',
    });
    expect(result).toMatchObject({
      retryable: true,
      sourcesSucceeded: ['rdap', 'dns'],
      status: 'PARTIAL',
    });
    expect(JSON.stringify(result)).not.toContain('database detail');
  });
});
