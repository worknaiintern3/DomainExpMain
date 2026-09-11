/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { InventoryRecordNotFoundError, InventoryWriteForbiddenError } from '../src/inventory/inventory.errors';
import type { MetadataStore } from '../src/metadata/metadata.types';
import { MetadataService } from '../src/metadata/metadata.service';
import { RdapRetrievalError } from '../src/metadata/rdap/rdap.errors';
import { TlsInspectionError } from '../src/metadata/tls/tls.errors';
import type { WorkspacePrincipal } from '../src/workspace-context';

const workspaceId = randomUUID();
const domainId = randomUUID();
const now = new Date('2030-01-02T03:04:05.000Z');

function principal(role: WorkspacePrincipal['role']): WorkspacePrincipal {
  return {
    membershipId: randomUUID(),
    role,
    sessionId: randomUUID(),
    userId: randomUUID(),
    workspaceId,
  };
}

function storeMock(): MetadataStore {
  return {
    findDomain: vi.fn(async () => ({
      domainName: 'Displayed.Example',
      id: domainId,
      normalizedDomainName: 'stored.example',
    })),
    read: vi.fn(async () => ({ dns: null, rdap: null, tls: null })),
    recordDns: vi.fn(async () => undefined),
    recordRdapFailure: vi.fn(async () => undefined),
    recordRdapSuccess: vi.fn(async () => undefined),
    recordTlsFailure: vi.fn(async () => undefined),
    recordTlsSuccess: vi.fn(async () => undefined),
  };
}

const rdapSnapshot = {
  changedAt: null,
  expiresAt: null,
  nameservers: [],
  registeredAt: null,
  registrarIanaId: null,
  registrarName: 'Registrar',
  secureDnsDelegationSigned: null,
  sourceUrl: 'https://rdap.example/domain/stored.example',
  statuses: [],
};
const dnsPartial = {
  errorCode: 'DNS_PARTIAL_FAILURE' as const,
  snapshot: {
    aRecords: ['203.0.113.1'],
    aaaaRecords: [],
    cnameRecords: [],
    dsRecords: [],
    mxRecords: [],
    nsRecords: [],
    recordErrors: { MX: 'DNS_RESOLVER_ERROR' },
    txtRecordCount: 0,
  },
  status: 'PARTIAL' as const,
};
const tlsSnapshot = {
  fingerprint256: 'AA',
  issuerCommonName: 'CA',
  issuerOrganization: null,
  serialNumber: '01',
  subjectAltNames: ['stored.example'],
  subjectCommonName: 'stored.example',
  validFrom: new Date('2029-01-01T00:00:00Z'),
  validTo: new Date('2031-01-01T00:00:00Z'),
};

describe('MetadataService', () => {
  it('allows member reads and truthfully returns never-checked sources', async () => {
    const service = new MetadataService(
      storeMock(),
      { retrieve: vi.fn() },
      { retrieve: vi.fn() },
      { retrieve: vi.fn() },
    );
    await expect(service.get(principal('member'), domainId)).resolves.toEqual({
      canRefresh: false,
      dns: null,
      domainId,
      rdap: null,
      tls: null,
    });
  });

  it('denies member refresh before any network or persistence work', async () => {
    const store = storeMock();
    const rdap = { retrieve: vi.fn() };
    const service = new MetadataService(store, rdap, { retrieve: vi.fn() }, { retrieve: vi.fn() });
    await expect(service.refresh(principal('member'), domainId)).rejects.toBeInstanceOf(InventoryWriteForbiddenError);
    expect(store.findDomain).not.toHaveBeenCalled();
    expect(rdap.retrieve).not.toHaveBeenCalled();
  });

  it.each(['owner', 'admin'] as const)('runs all sources for %s, independently maps failures, and uses the stored domain', async (role) => {
    const store = storeMock();
    const rdap = { retrieve: vi.fn(async () => { throw new RdapRetrievalError('RDAP_LOOKUP_NOT_FOUND'); }) };
    const dns = { retrieve: vi.fn(async () => dnsPartial) };
    const tls = { retrieve: vi.fn(async () => tlsSnapshot) };
    const service = new MetadataService(store, rdap, dns, tls, () => now);

    const result = await service.refresh(principal(role), domainId);
    expect(result.results).toEqual({
      dns: { errorCode: 'DNS_PARTIAL_FAILURE', status: 'PARTIAL' },
      rdap: { errorCode: 'RDAP_LOOKUP_NOT_FOUND', status: 'FAILED' },
      tls: { errorCode: null, status: 'SUCCESS' },
    });
    expect(rdap.retrieve).toHaveBeenCalledWith('stored.example');
    expect(dns.retrieve).toHaveBeenCalledWith('stored.example');
    expect(tls.retrieve).toHaveBeenCalledWith('stored.example');
    expect(store.recordRdapFailure).toHaveBeenCalledWith(workspaceId, domainId, now, 'RDAP_LOOKUP_NOT_FOUND');
    expect(store.recordDns).toHaveBeenCalledWith(workspaceId, domainId, now, dnsPartial);
    expect(store.recordTlsSuccess).toHaveBeenCalledWith(workspaceId, domainId, now, tlsSnapshot);
  });

  it('runs only explicitly requested sources', async () => {
    const store = storeMock();
    const rdap = { retrieve: vi.fn(async () => ({ snapshot: rdapSnapshot })) };
    const dns = { retrieve: vi.fn() };
    const tls = { retrieve: vi.fn() };
    const service = new MetadataService(store, rdap, dns, tls, () => now);
    const result = await service.refresh(principal('owner'), domainId, ['rdap']);
    expect(result.results).toEqual({ rdap: { errorCode: null, status: 'SUCCESS' } });
    expect(store.recordRdapSuccess).toHaveBeenCalledWith(workspaceId, domainId, now, rdapSnapshot);
    expect(dns.retrieve).not.toHaveBeenCalled();
    expect(tls.retrieve).not.toHaveBeenCalled();
  });

  it('maps expected TLS failure but propagates unexpected programming failures', async () => {
    const store = storeMock();
    const tls = { retrieve: vi.fn(async () => { throw new TlsInspectionError('TLS_CONNECT_TIMEOUT'); }) };
    const service = new MetadataService(store, { retrieve: vi.fn() }, { retrieve: vi.fn() }, tls, () => now);
    await expect(service.refresh(principal('owner'), domainId, ['tls'])).resolves.toMatchObject({
      results: { tls: { errorCode: 'TLS_CONNECT_TIMEOUT', status: 'FAILED' } },
    });
    expect(store.recordTlsFailure).toHaveBeenCalledWith(workspaceId, domainId, now, 'TLS_CONNECT_TIMEOUT');

    const programmingError = new TypeError('programming fault');
    tls.retrieve.mockRejectedValueOnce(programmingError);
    await expect(service.refresh(principal('owner'), domainId, ['tls'])).rejects.toBe(programmingError);
  });

  it('keeps nonexistent and inaccessible domains on the same not-found path', async () => {
    const store = storeMock();
    vi.mocked(store.findDomain).mockResolvedValue(undefined);
    const service = new MetadataService(store, { retrieve: vi.fn() }, { retrieve: vi.fn() }, { retrieve: vi.fn() });
    await expect(service.get(principal('owner'), domainId)).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
    await expect(service.refresh(principal('owner'), domainId)).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
  });
});
