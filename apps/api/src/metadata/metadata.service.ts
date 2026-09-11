import type {
  DomainDnsMetadataResponse,
  DomainMetadataResponse,
  DomainMetadataSource,
  DomainRdapMetadataResponse,
  DomainTlsMetadataResponse,
  RefreshDomainMetadataResponse,
} from '@domainpulse/contracts';
import type {
  DomainDnsMetadata,
  DomainRdapMetadata,
  DomainTlsMetadata,
} from '@domainpulse/database';

import { requireInventoryWriteAccess } from '../inventory/authorization/inventory-authorization';
import { InventoryRecordNotFoundError } from '../inventory/inventory.errors';
import type { WorkspacePrincipal } from '../workspace-context';
import type { DnsClient } from './dns/dns.client';
import type { MetadataStore, StoredDomainMetadata } from './metadata.types';
import type { RdapClient } from './rdap/rdap.client';
import { RdapRetrievalError } from './rdap/rdap.errors';
import type { TlsClient } from './tls/tls.client';
import { TlsInspectionError } from './tls/tls.errors';

const ALL_SOURCES: readonly DomainMetadataSource[] = ['rdap', 'dns', 'tls'];

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function presentRdap(row: DomainRdapMetadata | null): DomainRdapMetadataResponse | null {
  if (!row) return null;
  return {
    changedAt: iso(row.changedAt),
    expiresAt: iso(row.expiresAt),
    lastAttemptedAt: row.lastAttemptedAt.toISOString(),
    lastAttemptStatus: row.lastAttemptStatus,
    lastErrorCode: row.lastErrorCode,
    nameservers: row.nameservers,
    provenance: row.provenance === 'RDAP_RETRIEVED' ? row.provenance : null,
    registeredAt: iso(row.registeredAt),
    registrarIanaId: row.registrarIanaId,
    registrarName: row.registrarName,
    retrievedAt: iso(row.retrievedAt),
    secureDnsDelegationSigned: row.secureDnsDelegationSigned,
    sourceUrl: row.sourceUrl,
    statuses: row.statuses,
  };
}

function presentDns(row: DomainDnsMetadata | null): DomainDnsMetadataResponse | null {
  if (!row) return null;
  return {
    aRecords: row.aRecords,
    aaaaRecords: row.aaaaRecords,
    cnameRecords: row.cnameRecords,
    dsRecords: row.dsRecords,
    lastAttemptedAt: row.lastAttemptedAt.toISOString(),
    lastAttemptStatus: row.lastAttemptStatus,
    lastErrorCode: row.lastErrorCode,
    mxRecords: row.mxRecords,
    nsRecords: row.nsRecords,
    provenance: row.provenance === 'DNS_RETRIEVED' ? row.provenance : null,
    recordErrors: row.recordErrors,
    retrievedAt: iso(row.retrievedAt),
    txtRecordCount: row.txtRecordCount,
  };
}

function presentTls(row: DomainTlsMetadata | null): DomainTlsMetadataResponse | null {
  if (!row) return null;
  return {
    fingerprint256: row.fingerprint256,
    issuerCommonName: row.issuerCommonName,
    issuerOrganization: row.issuerOrganization,
    lastAttemptedAt: row.lastAttemptedAt.toISOString(),
    lastAttemptStatus: row.lastAttemptStatus,
    lastErrorCode: row.lastErrorCode,
    provenance: row.provenance === 'SSL_RETRIEVED' ? row.provenance : null,
    retrievedAt: iso(row.retrievedAt),
    serialNumber: row.serialNumber,
    subjectAltNames: row.subjectAltNames,
    subjectCommonName: row.subjectCommonName,
    validFrom: iso(row.validFrom),
    validTo: iso(row.validTo),
  };
}

function presentMetadata(
  domainId: string,
  canRefresh: boolean,
  rows: StoredDomainMetadata,
): DomainMetadataResponse {
  return {
    canRefresh,
    dns: presentDns(rows.dns),
    domainId,
    rdap: presentRdap(rows.rdap),
    tls: presentTls(rows.tls),
  };
}

export class MetadataService {
  constructor(
    private readonly store: MetadataStore,
    private readonly rdapClient: Pick<RdapClient, 'retrieve'>,
    private readonly dnsClient: Pick<DnsClient, 'retrieve'>,
    private readonly tlsClient: Pick<TlsClient, 'retrieve'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(principal: WorkspacePrincipal, domainId: string): Promise<DomainMetadataResponse> {
    const domain = await this.store.findDomain(principal.workspaceId, domainId);
    if (!domain) throw new InventoryRecordNotFoundError();
    return presentMetadata(
      domainId,
      principal.role !== 'member',
      await this.store.read(principal.workspaceId, domainId),
    );
  }

  async refresh(
    principal: WorkspacePrincipal,
    domainId: string,
    requestedSources?: readonly DomainMetadataSource[],
  ): Promise<RefreshDomainMetadataResponse> {
    requireInventoryWriteAccess(principal);
    const domain = await this.store.findDomain(principal.workspaceId, domainId);
    if (!domain) throw new InventoryRecordNotFoundError();
    const sources = requestedSources ?? ALL_SOURCES;
    const results: RefreshDomainMetadataResponse['results'] = {};

    for (const source of sources) {
      const attemptedAt = this.now();
      if (source === 'rdap') {
        try {
          const retrieval = await this.rdapClient.retrieve(domain.normalizedDomainName);
          await this.store.recordRdapSuccess(principal.workspaceId, domainId, attemptedAt, retrieval.snapshot);
          results.rdap = { errorCode: null, status: 'SUCCESS' };
        } catch (error) {
          if (!(error instanceof RdapRetrievalError)) throw error;
          await this.store.recordRdapFailure(principal.workspaceId, domainId, attemptedAt, error.code);
          results.rdap = { errorCode: error.code, status: 'FAILED' };
        }
      } else if (source === 'dns') {
        const retrieval = await this.dnsClient.retrieve(domain.normalizedDomainName);
        await this.store.recordDns(principal.workspaceId, domainId, attemptedAt, retrieval);
        results.dns = { errorCode: retrieval.errorCode, status: retrieval.status };
      } else {
        try {
          const snapshot = await this.tlsClient.retrieve(domain.normalizedDomainName);
          await this.store.recordTlsSuccess(principal.workspaceId, domainId, attemptedAt, snapshot);
          results.tls = { errorCode: null, status: 'SUCCESS' };
        } catch (error) {
          if (!(error instanceof TlsInspectionError)) throw error;
          await this.store.recordTlsFailure(principal.workspaceId, domainId, attemptedAt, error.code);
          results.tls = { errorCode: error.code, status: 'FAILED' };
        }
      }
    }

    return {
      domainId,
      metadata: presentMetadata(
        domainId,
        true,
        await this.store.read(principal.workspaceId, domainId),
      ),
      results,
    };
  }
}
