import type {
  DiscoveredProviderServer,
  ProviderAdapter,
  ProviderServerDiscovery,
  ServerDiscoveryCapability,
} from '../provider-adapter.types';
import {
  ProviderAdapterError,
  ProviderReconciliationError,
} from '../provider.errors';
import type {
  ProviderServerReconciliationInput,
  ProviderServerReconciliationStore,
  ProviderServerReconciliationSummary,
  ProviderServerSyncInput,
  ProviderServerSyncResult,
} from './provider-server-reconciliation.types';

const CANONICAL_RESOURCE_TYPE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const CANONICAL_HOSTNAME = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

function validatedDiscovery(
  discovery: ProviderServerDiscovery,
): ProviderServerDiscovery {
  if (
    !CANONICAL_RESOURCE_TYPE.test(discovery.externalResourceType) ||
    discovery.externalResourceType.length > 64 ||
    (discovery.completion === 'COMPLETE' && discovery.error !== null) ||
    (discovery.completion === 'PARTIAL' && discovery.error === null)
  ) {
    throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
  }

  const servers = new Map<string, DiscoveredProviderServer>();
  for (const server of discovery.servers) {
    if (
      server.externalResourceId.trim().length === 0 ||
      server.externalResourceId.trim() !== server.externalResourceId ||
      server.externalResourceId.length > 1_024 ||
      !CANONICAL_RESOURCE_TYPE.test(server.providerStatus) ||
      server.providerStatus.length > 64 ||
      server.canonicalName.trim().length === 0 ||
      server.canonicalName.length > 255 ||
      (server.hostname !== null &&
        (server.hostname.length === 0 ||
          server.hostname.length > 253 ||
          !CANONICAL_HOSTNAME.test(server.hostname))) ||
      (server.region !== null &&
        (server.region.trim().length === 0 || server.region.length > 255)) ||
      (server.operatingSystem !== null &&
        (server.operatingSystem.trim().length === 0 ||
          server.operatingSystem.length > 255)) ||
      (server.serverKind !== null &&
        (server.serverKind.length === 0 ||
          server.serverKind.length > 255 ||
          !CANONICAL_RESOURCE_TYPE.test(server.serverKind)))
    ) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    const prior = servers.get(server.externalResourceId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(server)) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    servers.set(server.externalResourceId, server);
  }

  return { ...discovery, servers: [...servers.values()] };
}

export class ProviderServerReconciler {
  constructor(private readonly store: ProviderServerReconciliationStore) {}

  async reconcile(
    input: ProviderServerReconciliationInput,
  ): Promise<ProviderServerReconciliationSummary> {
    if (Number.isNaN(input.synchronizedAt.getTime())) {
      throw new ProviderAdapterError('INVALID_REQUEST');
    }
    const discovery = validatedDiscovery(input.discovery);

    return await this.store.withWorkspaceTransaction(
      input.workspaceId,
      input.connectionId,
      async (transaction) => {
        const providerAccountId =
          await transaction.resolveConnectionProviderAccountId(
            input.providerKey,
          );
        if (!providerAccountId) {
          throw new ProviderReconciliationError('CONNECTION_UNAVAILABLE');
        }

        let itemsCreated = 0;
        let itemsUpdated = 0;
        let itemsUnchanged = 0;
        const seenExternalResourceIds = new Set<string>();

        for (const discovered of discovery.servers) {
          seenExternalResourceIds.add(discovered.externalResourceId);

          // Stable path first: an already-linked resource always resolves
          // to the same node regardless of any attribute (e.g. IP) changing
          // upstream between syncs.
          let nodeId = await transaction.findLinkedServerNodeId(
            discovery.externalResourceType,
            discovered.externalResourceId,
          );
          if (!nodeId) {
            const server = await transaction.findOrCreateServer(
              discovered,
              providerAccountId,
              input.synchronizedAt,
            );
            nodeId = await transaction.resolveServerNodeId(server.id);
            if (!nodeId) {
              throw new ProviderReconciliationError('INTERNAL_INTEGRITY_ERROR');
            }
          }

          const outcome = await transaction.activateResourceLink({
            externalResourceId: discovered.externalResourceId,
            externalResourceType: discovery.externalResourceType,
            nodeId,
            providerStatus: discovered.providerStatus,
            synchronizedAt: input.synchronizedAt,
          });

          if (outcome === 'CREATED') itemsCreated += 1;
          else if (outcome === 'UPDATED') itemsUpdated += 1;
          else itemsUnchanged += 1;
        }

        const itemsMissing = discovery.completion === 'COMPLETE'
          ? await transaction.markMissingResources(
              discovery.externalResourceType,
              seenExternalResourceIds,
              input.synchronizedAt,
            )
          : 0;

        return {
          itemsCreated,
          itemsDiscovered: discovery.servers.length,
          itemsMissing,
          itemsUnchanged,
          itemsUpdated,
        };
      },
    );
  }
}

export class ProviderServerSyncService {
  constructor(
    private readonly adapter: ProviderAdapter & ServerDiscoveryCapability,
    private readonly reconciler: ProviderServerReconciler,
  ) {}

  async synchronize(input: ProviderServerSyncInput): Promise<ProviderServerSyncResult> {
    // The complete provider enumeration finishes before the short DB transaction
    // starts. The plaintext token is never passed to the persistence boundary.
    const discovery = await this.adapter.discoverServers(input.token);
    const summary = await this.reconciler.reconcile({
      connectionId: input.connectionId,
      discovery,
      providerKey: this.adapter.providerKey,
      synchronizedAt: input.synchronizedAt,
      workspaceId: input.workspaceId,
    });
    return {
      ...summary,
      completion: discovery.completion,
      error: discovery.error,
    };
  }
}
