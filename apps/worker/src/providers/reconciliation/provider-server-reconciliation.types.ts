import type {
  DiscoveredProviderServer,
  ProviderServerDiscovery,
  SafeProviderError,
} from '../provider-adapter.types';

export interface ReconciledServerRecord {
  readonly created: boolean;
  readonly id: string;
  readonly provenance: string;
}

export interface ActivateProviderServerResourceLinkInput {
  readonly externalResourceId: string;
  readonly externalResourceType: string;
  readonly nodeId: string;
  readonly providerStatus: string;
  readonly synchronizedAt: Date;
}

export type ProviderServerResourceLinkOutcome = 'CREATED' | 'UPDATED' | 'UNCHANGED';

/**
 * Server identity has no cross-provider natural key the way a normalized
 * domain name is one, so (unlike `findOrCreateDomain`) matching happens in
 * two steps kept as two separate operations here:
 *
 * 1. `findLinkedServerNodeId` -- the *stable* path. A `provider_resource_link`
 *    already binds (connectionId, externalResourceType, externalResourceId)
 *    to a node; every re-sync of an already-discovered server must resolve
 *    through this first so it is always idempotent and never depends on a
 *    mutable attribute like the IP address.
 * 2. `findOrCreateServer` -- only reached the *first* time a given external
 *    resource id is seen. It looks for a compatible, not-yet-provider-linked
 *    `servers` row (matched on primary IP) to attach to rather than blindly
 *    duplicating user-added inventory; if none matches it creates a new
 *    `PROVIDER_API` server.
 */
export interface ProviderServerReconciliationTransaction {
  activateResourceLink(
    input: ActivateProviderServerResourceLinkInput,
  ): Promise<ProviderServerResourceLinkOutcome>;
  findLinkedServerNodeId(
    externalResourceType: string,
    externalResourceId: string,
  ): Promise<string | undefined>;
  findOrCreateServer(
    discovered: DiscoveredProviderServer,
    providerAccountId: string,
    synchronizedAt: Date,
  ): Promise<ReconciledServerRecord>;
  markMissingResources(
    externalResourceType: string,
    seenExternalResourceIds: ReadonlySet<string>,
    synchronizedAt: Date,
  ): Promise<number>;
  resolveConnectionProviderAccountId(
    providerKey: string,
  ): Promise<string | undefined>;
  resolveServerNodeId(serverId: string): Promise<string | undefined>;
}

export interface ProviderServerReconciliationStore {
  withWorkspaceTransaction<T>(
    workspaceId: string,
    connectionId: string,
    operation: (transaction: ProviderServerReconciliationTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface ProviderServerReconciliationInput {
  readonly connectionId: string;
  readonly discovery: ProviderServerDiscovery;
  readonly providerKey: string;
  readonly synchronizedAt: Date;
  readonly workspaceId: string;
}

export interface ProviderServerReconciliationSummary {
  readonly itemsCreated: number;
  readonly itemsDiscovered: number;
  readonly itemsMissing: number;
  readonly itemsUnchanged: number;
  readonly itemsUpdated: number;
}

export interface ProviderServerSyncInput {
  readonly connectionId: string;
  readonly synchronizedAt: Date;
  readonly token: string;
  readonly workspaceId: string;
}

export interface ProviderServerSyncResult extends ProviderServerReconciliationSummary {
  readonly completion: 'COMPLETE' | 'PARTIAL';
  readonly error: SafeProviderError | null;
}
