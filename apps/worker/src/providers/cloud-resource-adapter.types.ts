import type { ProviderAdapter, SafeProviderError } from './provider-adapter.types';

/**
 * Phase 10I: the cloud-VM analogue of `DiscoveredProviderDomain`
 * (provider-adapter.types.ts). Cloud resources (AWS EC2 / GCP Compute Engine
 * / Azure Virtual Machines) are a structurally different inventory shape
 * than registrar/DNS domains -- there is no canonical name to dedupe on, no
 * DNS-hosting association, and the provider-reported operational fields
 * (instance type, image, IPs, tags, region/zone) have no equivalent in
 * `DiscoveredProviderDomain` -- so this is a distinct, additive discovery
 * contract rather than a reuse of the domain one. `resourceKind` is the
 * canonical (lowercase, `^[a-z0-9]+(?:[._-][a-z0-9]+)*$`) type stored in both
 * `cloud_resources.resource_type` and `provider_resource_links
 * .external_resource_type` (matching the check constraints on those
 * columns).
 */
export interface DiscoveredCloudResource {
  readonly externalResourceId: string;
  readonly imageReference: string | null;
  readonly instanceType: string;
  readonly launchedAt: string | null;
  readonly name: string;
  readonly privateIpAddress: string | null;
  readonly providerStatus: string;
  readonly publicIpAddress: string | null;
  readonly region: string | null;
  /** Azure's logical resource-group container (`null` for AWS/GCP, which have no equivalent concept). Parsed from the ARM resource ID, since Azure's VM list response does not return it as its own field. */
  readonly resourceGroup: string | null;
  readonly resourceKind: string;
  readonly tags: Readonly<Record<string, string>>;
  readonly zone: string | null;
}

export interface ProviderCloudResourceDiscovery {
  readonly completion: 'COMPLETE' | 'PARTIAL';
  readonly error: SafeProviderError | null;
  readonly externalResourceType: string;
  readonly resources: readonly DiscoveredCloudResource[];
}

export interface CloudResourceDiscoveryCapability {
  discoverCloudResources(token: string): Promise<ProviderCloudResourceDiscovery>;
}

/**
 * Explicit, honest capability flags for a cloud-VM adapter -- mirrors the
 * intent of `ProviderCapabilities` for registrar adapters. A `false` flag
 * must never be worked around by inference, scraping, or fabricated data.
 * `readNetworkAddresses` is `false` for adapters whose list API does not
 * embed IP addresses in the same response (e.g. Azure's VM list returns only
 * a NIC resource-ID reference, not the address itself -- fetching it would
 * require calling Microsoft.Network, which is out of Phase 10I's scope).
 */
export interface CloudResourceCapabilities {
  readonly listInstances: boolean;
  readonly readNetworkAddresses: boolean;
  readonly readRuntimeStatus: boolean;
  readonly readTags: boolean;
}

export type CloudResourceAdapter = ProviderAdapter & CloudResourceDiscoveryCapability & {
  readonly cloudResourceCapabilities: CloudResourceCapabilities;
};
