import type { ProviderDomainDiscovery, SafeProviderError } from '../provider-adapter.types';

export interface ReconciledDomainRecord {
  readonly created: boolean;
  readonly dnsProviderAccountId: string | null;
  readonly id: string;
  readonly provenance: string;
}

export interface ActivateProviderResourceLinkInput {
  readonly externalResourceId: string;
  readonly externalResourceType: string;
  readonly nodeId: string;
  readonly providerStatus: string;
  readonly synchronizedAt: Date;
}

export type ProviderResourceLinkOutcome = 'CREATED' | 'UPDATED' | 'UNCHANGED';

export interface ProviderDomainReconciliationTransaction {
  activateResourceLink(
    input: ActivateProviderResourceLinkInput,
  ): Promise<ProviderResourceLinkOutcome>;
  associateDnsProvider(
    domainId: string,
    providerAccountId: string,
    synchronizedAt: Date,
  ): Promise<boolean>;
  findOrCreateDomain(
    canonicalDomain: string,
    synchronizedAt: Date,
  ): Promise<ReconciledDomainRecord>;
  markMissingResources(
    externalResourceType: string,
    seenExternalResourceIds: ReadonlySet<string>,
    synchronizedAt: Date,
  ): Promise<number>;
  resolveConnectionProviderAccountId(
    providerKey: string,
  ): Promise<string | undefined>;
  resolveDomainNodeId(domainId: string): Promise<string | undefined>;
}

export interface ProviderDomainReconciliationStore {
  withWorkspaceTransaction<T>(
    workspaceId: string,
    connectionId: string,
    operation: (transaction: ProviderDomainReconciliationTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface ProviderDomainReconciliationInput {
  readonly connectionId: string;
  readonly discovery: ProviderDomainDiscovery;
  readonly providerKey: string;
  readonly synchronizedAt: Date;
  readonly workspaceId: string;
}

export interface ProviderDomainReconciliationSummary {
  readonly itemsCreated: number;
  readonly itemsDiscovered: number;
  readonly itemsMissing: number;
  readonly itemsUnchanged: number;
  readonly itemsUpdated: number;
}

export interface ProviderDomainSyncInput {
  readonly connectionId: string;
  readonly synchronizedAt: Date;
  readonly token: string;
  readonly workspaceId: string;
}

export interface ProviderDomainSyncResult extends ProviderDomainReconciliationSummary {
  readonly completion: 'COMPLETE' | 'PARTIAL';
  readonly error: SafeProviderError | null;
}
