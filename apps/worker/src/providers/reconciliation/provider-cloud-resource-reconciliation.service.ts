import type {
  CloudResourceDiscoveryCapability,
  DiscoveredCloudResource,
  ProviderCloudResourceDiscovery,
} from '../cloud-resource-adapter.types';
import type { ProviderAdapter } from '../provider-adapter.types';
import {
  ProviderAdapterError,
  ProviderReconciliationError,
} from '../provider.errors';
import type {
  ProviderCloudResourceReconciliationInput,
  ProviderCloudResourceReconciliationStore,
  ProviderCloudResourceReconciliationSummary,
  ProviderCloudResourceSyncInput,
  ProviderCloudResourceSyncResult,
} from './provider-cloud-resource-reconciliation.types';

const CANONICAL_RESOURCE_TYPE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const MAX_TAG_ENTRIES = 64;
const MAX_TAG_KEY_LENGTH = 256;
const MAX_TAG_VALUE_LENGTH = 1_024;

/**
 * Validates and de-duplicates a cloud-resource discovery batch before it
 * reaches the reconciler -- the same defense-in-depth role
 * `validatedDiscovery` plays for domains in
 * provider-domain-reconciliation.service.ts, adapted to the cloud-resource
 * shape (no canonical-domain normalization; region/zone/IPs/tags instead).
 */
function validatedDiscovery(
  discovery: ProviderCloudResourceDiscovery,
): ProviderCloudResourceDiscovery {
  if (
    !CANONICAL_RESOURCE_TYPE.test(discovery.externalResourceType) ||
    discovery.externalResourceType.length > 64 ||
    (discovery.completion === 'COMPLETE' && discovery.error !== null) ||
    (discovery.completion === 'PARTIAL' && discovery.error === null)
  ) {
    throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
  }

  const resources = new Map<string, (typeof discovery.resources)[number]>();
  for (const resource of discovery.resources) {
    if (
      resource.externalResourceId.trim().length === 0 ||
      resource.externalResourceId.trim() !== resource.externalResourceId ||
      resource.externalResourceId.length > 1_024 ||
      resource.name.trim().length === 0 ||
      resource.name.length > 512 ||
      resource.instanceType.trim().length === 0 ||
      resource.instanceType.length > 256 ||
      resource.providerStatus.trim().length === 0 ||
      resource.providerStatus.length > 128 ||
      (resource.region !== null && resource.region.trim().length === 0) ||
      (resource.resourceGroup !== null &&
        (resource.resourceGroup.trim().length === 0 || resource.resourceGroup.length > 256)) ||
      Object.keys(resource.tags).length > MAX_TAG_ENTRIES ||
      // Defensive cross-check: an adapter's per-resource `resourceKind` must
      // always agree with the discovery batch's own declared
      // `externalResourceType` -- these are two independently-set fields
      // (see DiscoveredCloudResource / ProviderCloudResourceDiscovery) that
      // should never disagree for a single adapter's single discovery call.
      // A mismatch means the adapter itself is internally inconsistent (or
      // an upstream response was misattributed), and reconciling it would
      // silently mix resource kinds under one external-resource-type
      // bucket, so this fails closed rather than reconciling on trust.
      resource.resourceKind !== discovery.externalResourceType
    ) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    for (const [key, value] of Object.entries(resource.tags)) {
      if (
        key.length === 0 ||
        key.length > MAX_TAG_KEY_LENGTH ||
        typeof value !== 'string' ||
        value.length > MAX_TAG_VALUE_LENGTH
      ) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
    }
    const prior = resources.get(resource.externalResourceId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(resource)) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    resources.set(resource.externalResourceId, resource);
  }

  return { ...discovery, resources: [...resources.values()] };
}

function externalMetadataFor(
  resource: DiscoveredCloudResource,
): Record<string, unknown> {
  return {
    imageReference: resource.imageReference,
    instanceType: resource.instanceType,
    launchedAt: resource.launchedAt,
    privateIpAddress: resource.privateIpAddress,
    providerStatus: resource.providerStatus,
    publicIpAddress: resource.publicIpAddress,
    resourceGroup: resource.resourceGroup,
    tags: resource.tags,
    zone: resource.zone,
  };
}

/**
 * Provider-neutral reconciliation for cloud VM inventory. This is a
 * deliberately separate abstraction from `ProviderDomainReconciler`, not a
 * clone of it: `cloud_resources` has no canonical-name identity to dedupe on
 * (domains dedupe by `normalizedDomainName`; cloud resources are keyed by
 * `(providerAccountId, resourceType, externalResourceId)`), carries no
 * DNS-hosting association step, and its rich provider-reported fields
 * (instance type, image, IPs, tags, zone) have no equivalent domain column
 * -- they live entirely in `provider_resource_links.external_metadata`. One
 * instance of this reconciler is shared by every Phase 10I cloud adapter
 * (AWS/GCP/Azure), exactly as one `ProviderDomainReconciler` is shared by
 * every registrar adapter.
 */
export class ProviderCloudResourceReconciler {
  constructor(private readonly store: ProviderCloudResourceReconciliationStore) {}

  async reconcile(
    input: ProviderCloudResourceReconciliationInput,
  ): Promise<ProviderCloudResourceReconciliationSummary> {
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

        for (const resource of discovery.resources) {
          seenExternalResourceIds.add(resource.externalResourceId);
          const record = await transaction.upsertCloudResource({
            externalResourceId: resource.externalResourceId,
            name: resource.name,
            providerAccountId,
            region: resource.region,
            resourceType: discovery.externalResourceType,
            synchronizedAt: input.synchronizedAt,
          });
          const nodeId = await transaction.resolveCloudResourceNodeId(record.id);
          if (!nodeId) {
            throw new ProviderReconciliationError('INTERNAL_INTEGRITY_ERROR');
          }
          const outcome = await transaction.activateResourceLink({
            externalMetadata: externalMetadataFor(resource),
            externalResourceId: resource.externalResourceId,
            externalResourceType: discovery.externalResourceType,
            nodeId,
            synchronizedAt: input.synchronizedAt,
          });

          if (record.created || outcome === 'CREATED') itemsCreated += 1;
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
          itemsDiscovered: discovery.resources.length,
          itemsMissing,
          itemsUnchanged,
          itemsUpdated,
        };
      },
    );
  }
}

export class ProviderCloudResourceSyncService {
  constructor(
    private readonly adapter: ProviderAdapter & CloudResourceDiscoveryCapability,
    private readonly reconciler: ProviderCloudResourceReconciler,
  ) {}

  async synchronize(
    input: ProviderCloudResourceSyncInput,
  ): Promise<ProviderCloudResourceSyncResult> {
    // The complete provider enumeration finishes before the short DB
    // transaction starts, and the plaintext token never crosses into the
    // persistence boundary -- mirrors ProviderDomainSyncService.synchronize.
    const discovery = await this.adapter.discoverCloudResources(input.token);
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
