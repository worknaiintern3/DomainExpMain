import type { ProviderCloudResourceDiscovery } from '../cloud-resource-adapter.types';
import type { SafeProviderError } from '../provider-adapter.types';
import type { ProviderResourceLinkOutcome } from './provider-domain-reconciliation.types';

export interface ReconciledCloudResourceRecord {
  readonly created: boolean;
  readonly id: string;
}

export interface UpsertCloudResourceInput {
  readonly externalResourceId: string;
  readonly name: string;
  readonly providerAccountId: string;
  readonly region: string | null;
  readonly resourceType: string;
  readonly synchronizedAt: Date;
}

export interface ActivateCloudResourceLinkInput {
  readonly externalMetadata: Record<string, unknown>;
  readonly externalResourceId: string;
  readonly externalResourceType: string;
  readonly nodeId: string;
  readonly synchronizedAt: Date;
}

export interface ProviderCloudResourceReconciliationTransaction {
  activateResourceLink(
    input: ActivateCloudResourceLinkInput,
  ): Promise<ProviderResourceLinkOutcome>;
  markMissingResources(
    externalResourceType: string,
    seenExternalResourceIds: ReadonlySet<string>,
    synchronizedAt: Date,
  ): Promise<number>;
  resolveCloudResourceNodeId(cloudResourceId: string): Promise<string | undefined>;
  resolveConnectionProviderAccountId(
    providerKey: string,
  ): Promise<string | undefined>;
  upsertCloudResource(input: UpsertCloudResourceInput): Promise<ReconciledCloudResourceRecord>;
}

export interface ProviderCloudResourceReconciliationStore {
  withWorkspaceTransaction<T>(
    workspaceId: string,
    connectionId: string,
    operation: (transaction: ProviderCloudResourceReconciliationTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface ProviderCloudResourceReconciliationInput {
  readonly connectionId: string;
  readonly discovery: ProviderCloudResourceDiscovery;
  readonly providerKey: string;
  readonly synchronizedAt: Date;
  readonly workspaceId: string;
}

export interface ProviderCloudResourceReconciliationSummary {
  readonly itemsCreated: number;
  readonly itemsDiscovered: number;
  readonly itemsMissing: number;
  readonly itemsUnchanged: number;
  readonly itemsUpdated: number;
}

/** Shape-compatible with `ProviderDomainSyncInput`/`Result` (see provider-sync.types.ts's `ProviderSyncService`): the worker's sync executor dispatches to either kind through one structural interface, so this is not re-declared there -- only satisfied by it. */
export interface ProviderCloudResourceSyncInput {
  readonly connectionId: string;
  readonly synchronizedAt: Date;
  readonly token: string;
  readonly workspaceId: string;
}

export interface ProviderCloudResourceSyncResult extends ProviderCloudResourceReconciliationSummary {
  readonly completion: 'COMPLETE' | 'PARTIAL';
  readonly error: SafeProviderError | null;
}
