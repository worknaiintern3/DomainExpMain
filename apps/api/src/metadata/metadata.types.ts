import type {
  DomainDnsMetadata,
  DomainRdapMetadata,
  DomainTlsMetadata,
  WorkspaceTransactionHost,
} from '@domainpulse/database';

import type { DnsRetrieval } from './dns/dns.client';
import type { RdapSnapshot } from './rdap/rdap.types';
import type { TlsSnapshot } from './tls/tls.client';

export interface MetadataDomainIdentity {
  readonly domainName: string;
  readonly id: string;
  readonly normalizedDomainName: string;
}

export interface StoredDomainMetadata {
  readonly dns: DomainDnsMetadata | null;
  readonly rdap: DomainRdapMetadata | null;
  readonly tls: DomainTlsMetadata | null;
}

export interface MetadataStore {
  findDomain(workspaceId: string, domainId: string): Promise<MetadataDomainIdentity | undefined>;
  read(workspaceId: string, domainId: string): Promise<StoredDomainMetadata>;
  recordDns(workspaceId: string, domainId: string, attemptedAt: Date, result: DnsRetrieval): Promise<void>;
  recordRdapFailure(workspaceId: string, domainId: string, attemptedAt: Date, errorCode: string): Promise<void>;
  recordRdapSuccess(workspaceId: string, domainId: string, attemptedAt: Date, snapshot: RdapSnapshot): Promise<void>;
  recordTlsFailure(workspaceId: string, domainId: string, attemptedAt: Date, errorCode: string): Promise<void>;
  recordTlsSuccess(workspaceId: string, domainId: string, attemptedAt: Date, snapshot: TlsSnapshot): Promise<void>;
}

export type MetadataDatabaseHost = WorkspaceTransactionHost;
