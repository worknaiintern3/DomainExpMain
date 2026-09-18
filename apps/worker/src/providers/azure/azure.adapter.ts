import { Buffer } from 'node:buffer';

import { z } from 'zod';

import type {
  CloudResourceCapabilities,
  CloudResourceDiscoveryCapability,
  DiscoveredCloudResource,
  ProviderCloudResourceDiscovery,
} from '../cloud-resource-adapter.types';
import type { ProviderAdapter } from '../provider-adapter.types';
import { ProviderAdapterError, safeProviderError } from '../provider.errors';
import { AzureAuthClient } from './azure.auth';
import {
  AZURE_COMPUTE_API_VERSION,
  AZURE_DEFAULT_MAX_PAGES,
  AZURE_DEFAULT_TIMEOUT_MS,
  AZURE_MANAGEMENT_ORIGIN,
  AZURE_MAX_RESPONSE_BYTES,
  AZURE_PROVIDER_KEY,
  AZURE_VIRTUAL_MACHINE_RESOURCE_TYPE,
  parseAzureCredential,
} from './azure.constants';

type FetchImplementation = typeof fetch;

const azureVmSchema = z.object({
  id: z.string().min(1).max(2_048),
  location: z.string().min(1).max(128),
  name: z.string().min(1).max(512),
  properties: z.object({
    hardwareProfile: z.object({ vmSize: z.string().min(1).max(128) }).optional(),
    provisioningState: z.string().min(1).max(64).optional(),
  }).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

const vmListPageSchema = z.object({
  nextLink: z.string().optional(),
  value: z.array(azureVmSchema),
});

const armErrorEnvelopeSchema = z.object({
  error: z.object({ code: z.string().optional() }),
});

const RESOURCE_ID_PATTERN =
  /^\/subscriptions\/[^/]+\/resourceGroups\/([^/]+)\/providers\/Microsoft\.Compute\/virtualMachines\/[^/]+$/iu;

const AZURE_MANAGEMENT_HOSTNAME = new URL(AZURE_MANAGEMENT_ORIGIN).hostname;

/**
 * `nextLink` is documented as an opaque, already-authenticated
 * management.azure.com continuation URL -- never a caller-controlled
 * redirect target -- but an upstream response (compromised, proxied, or
 * simply malformed) must never be trusted to actually point there. Host
 * equality alone is not sufficient: `http://management.azure.com/...` and
 * `https://management.azure.com.evil.example/...` both need their own
 * explicit checks, not just a `.host`/`.hostname` string comparison. This
 * requires, together: exact scheme `https:`, exact hostname (no subdomain
 * or suffix match), the implicit default HTTPS port only (no port override),
 * and no embedded userinfo (a URL's username/password are never legitimate
 * here and are a classic way to smuggle a different effective target past a
 * naive host check in some URL parsers).
 */
export function assertTrustedAzureManagementUrl(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== AZURE_MANAGEMENT_HOSTNAME ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
  }
}

function resourceGroupFromId(id: string): string | null {
  const match = RESOURCE_ID_PATTERN.exec(id);
  return match?.[1] ?? null;
}

function normalizeVm(vm: z.infer<typeof azureVmSchema>): DiscoveredCloudResource {
  return {
    externalResourceId: vm.id,
    imageReference: null,
    instanceType: vm.properties?.hardwareProfile?.vmSize ?? 'unknown',
    launchedAt: null,
    name: vm.name,
    // Azure's VM list response returns only a network-interface *resource
    // ID* reference (networkProfile.networkInterfaces[].id), never an
    // embedded IP address -- reading the actual address requires a separate
    // Microsoft.Network call, which is out of Phase 10I's EC2/Compute
    // Engine/Virtual-Machines-only scope (see cloudResourceCapabilities
    // .readNetworkAddresses below). Reporting a fabricated or inferred
    // address here would be untruthful, so both are always null.
    privateIpAddress: null,
    // Azure's `provisioningState` (Succeeded/Failed/Updating/...) reflects
    // the last deployment operation, not whether the VM is currently
    // running -- there is no confirmed runtime power-state field on this
    // list response (that requires `instanceView`, a separate capability
    // this adapter does not use). Reported honestly as the provisioning
    // state, not represented as a power/runtime status.
    providerStatus: (vm.properties?.provisioningState ?? 'unknown').toLowerCase(),
    publicIpAddress: null,
    region: vm.location,
    resourceGroup: resourceGroupFromId(vm.id),
    resourceKind: AZURE_VIRTUAL_MACHINE_RESOURCE_TYPE,
    tags: vm.tags ?? {},
    zone: null,
  };
}

export interface AzureAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly maxPages?: number;
  readonly timeoutMs?: number;
}

function validateBoundedInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ProviderAdapterError('INVALID_REQUEST');
  }
  return value;
}

/**
 * Azure Virtual Machines inventory adapter (Phase 10I). The subscription-wide
 * "List All" endpoint covers every resource group and location in one
 * paginated call, so -- like GCP and unlike AWS EC2 -- no per-region
 * credential configuration is needed.
 */
export class AzureAdapter implements ProviderAdapter, CloudResourceDiscoveryCapability {
  readonly providerKey = AZURE_PROVIDER_KEY;
  readonly cloudResourceCapabilities: CloudResourceCapabilities = {
    listInstances: true,
    readNetworkAddresses: false,
    readRuntimeStatus: false,
    readTags: true,
  };

  private readonly auth: AzureAuthClient;
  private readonly fetchImplementation: FetchImplementation;
  private readonly maxPages: number;
  private readonly timeoutMs: number;

  constructor(options: AzureAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(options.maxPages ?? AZURE_DEFAULT_MAX_PAGES, 1, AZURE_DEFAULT_MAX_PAGES);
    this.timeoutMs = validateBoundedInteger(options.timeoutMs ?? AZURE_DEFAULT_TIMEOUT_MS, 1, 60_000);
    this.auth = new AzureAuthClient({ fetchImplementation: this.fetchImplementation, timeoutMs: this.timeoutMs });
  }

  async discoverCloudResources(token: string): Promise<ProviderCloudResourceDiscovery> {
    const credential = parseAzureCredential(token);
    const accessToken = (await this.auth.mintAccessToken(credential)).accessToken;

    const discovered = new Map<string, DiscoveredCloudResource>();
    let completedAnyPage = false;
    const firstUrl = new URL(
      `/subscriptions/${credential.subscriptionId}/providers/Microsoft.Compute/virtualMachines`,
      AZURE_MANAGEMENT_ORIGIN,
    );
    firstUrl.searchParams.set('api-version', AZURE_COMPUTE_API_VERSION);
    let nextUrl: string = firstUrl.toString();

    for (let page = 1; page <= this.maxPages; page += 1) {
      try {
        const result = await this.requestPage(nextUrl, accessToken);
        for (const vm of result.value) {
          const normalized = normalizeVm(vm);
          const prior = discovered.get(normalized.externalResourceId);
          if (prior && JSON.stringify(prior) !== JSON.stringify(normalized)) {
            throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
          }
          discovered.set(normalized.externalResourceId, normalized);
        }
        completedAnyPage = true;
        if (result.nextLink === undefined) {
          return {
            completion: 'COMPLETE',
            error: null,
            externalResourceType: AZURE_VIRTUAL_MACHINE_RESOURCE_TYPE,
            resources: [...discovered.values()],
          };
        }
        nextUrl = result.nextLink;
        if (page === this.maxPages) {
          return this.partialResult(discovered, { code: 'UPSTREAM_BAD_RESPONSE', retryAfterSeconds: null });
        }
      } catch (error) {
        if (!completedAnyPage) throw error;
        return this.partialResult(discovered, safeProviderError(error));
      }
    }

    return this.partialResult(discovered, { code: 'UPSTREAM_BAD_RESPONSE', retryAfterSeconds: null });
  }

  private partialResult(
    discovered: ReadonlyMap<string, DiscoveredCloudResource>,
    error: NonNullable<ProviderCloudResourceDiscovery['error']>,
  ): ProviderCloudResourceDiscovery {
    return {
      completion: 'PARTIAL',
      error,
      externalResourceType: AZURE_VIRTUAL_MACHINE_RESOURCE_TYPE,
      resources: [...discovered.values()],
    };
  }

  private async requestPage(url: string, accessToken: string): Promise<z.infer<typeof vmListPageSchema>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        headers: { authorization: `Bearer ${accessToken}` },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      throw new ProviderAdapterError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    }

    try {
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > AZURE_MAX_RESPONSE_BYTES) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      let text: string;
      try {
        text = await response.text();
      } catch {
        throw new ProviderAdapterError(
          controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_BAD_RESPONSE',
        );
      }
      if (Buffer.byteLength(text, 'utf8') > AZURE_MAX_RESPONSE_BYTES) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text) as unknown;
      } catch {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      if (!response.ok) {
        throw this.httpError(response.status, parsedJson);
      }
      const result = vmListPageSchema.safeParse(parsedJson);
      if (!result.success) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      if (result.data.nextLink !== undefined) {
        assertTrustedAzureManagementUrl(result.data.nextLink);
      }
      return result.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  private httpError(status: number, body: unknown): ProviderAdapterError {
    const parsed = armErrorEnvelopeSchema.safeParse(body);
    const code = parsed.success ? parsed.data.error.code : undefined;
    if (status === 401 || (code !== undefined && code.includes('InvalidAuthenticationToken'))) {
      return new ProviderAdapterError('AUTH_INVALID');
    }
    if (status === 403 || code === 'AuthorizationFailed') return new ProviderAdapterError('PERMISSION_DENIED');
    if (status === 404 || code === 'SubscriptionNotFound') return new ProviderAdapterError('RESOURCE_NOT_FOUND');
    if (status === 429) return new ProviderAdapterError('RATE_LIMITED');
    if (status >= 500) return new ProviderAdapterError('UPSTREAM_UNAVAILABLE');
    if (status === 400) return new ProviderAdapterError('INVALID_REQUEST');
    return new ProviderAdapterError('UNKNOWN_PROVIDER_ERROR');
  }
}
