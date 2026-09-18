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
import { GcpAuthClient } from './gcp.auth';
import {
  GCP_COMPUTE_API_ORIGIN,
  GCP_COMPUTE_INSTANCE_RESOURCE_TYPE,
  GCP_COMPUTE_READONLY_SCOPE,
  GCP_DEFAULT_MAX_PAGES,
  GCP_DEFAULT_PAGE_SIZE,
  GCP_DEFAULT_TIMEOUT_MS,
  GCP_MAX_RESPONSE_BYTES,
  GCP_PROVIDER_KEY,
  parseGcpCredential,
} from './gcp.constants';

type FetchImplementation = typeof fetch;

const accessConfigSchema = z.object({ natIP: z.string().optional() });
const networkInterfaceSchema = z.object({
  accessConfigs: z.array(accessConfigSchema).optional(),
  networkIP: z.string().optional(),
});
const diskSchema = z.object({
  boot: z.boolean().optional(),
  licenses: z.array(z.string()).optional(),
});
const gcpInstanceSchema = z.object({
  creationTimestamp: z.string().optional(),
  disks: z.array(diskSchema).optional(),
  id: z.string().min(1).max(64),
  labels: z.record(z.string(), z.string()).optional(),
  machineType: z.string().min(1).max(1_024),
  name: z.string().min(1).max(512),
  networkInterfaces: z.array(networkInterfaceSchema).optional(),
  status: z.string().min(1).max(64),
  zone: z.string().min(1).max(1_024),
});

const aggregatedListSchema = z.object({
  items: z.record(
    z.string(),
    z.object({ instances: z.array(gcpInstanceSchema).optional() }),
  ).optional(),
  nextPageToken: z.string().optional(),
  unreachables: z.array(z.string()).optional(),
});

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.number().optional(),
    status: z.string().optional(),
  }),
});

function lastUrlSegment(url: string): string {
  const segments = url.split('/').filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? url;
}

/** Zone naming is `<region>-<zone-letter>` (e.g. `us-central1-a` -> region `us-central1`) -- a standardized, documented GCP convention, not an inference. */
function regionFromZone(zone: string): string {
  const lastDash = zone.lastIndexOf('-');
  return lastDash > 0 ? zone.slice(0, lastDash) : zone;
}

function normalizeInstance(instance: z.infer<typeof gcpInstanceSchema>): DiscoveredCloudResource {
  const zone = lastUrlSegment(instance.zone);
  const networkInterface = instance.networkInterfaces?.[0];
  const bootDisk = instance.disks?.find((disk) => disk.boot === true) ?? instance.disks?.[0];
  let launchedAt: string | null = null;
  if (instance.creationTimestamp !== undefined) {
    const parsed = new Date(instance.creationTimestamp);
    if (Number.isNaN(parsed.getTime())) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    launchedAt = parsed.toISOString();
  }
  return {
    externalResourceId: instance.id,
    imageReference: bootDisk?.licenses?.[0] ?? null,
    instanceType: lastUrlSegment(instance.machineType),
    launchedAt,
    name: instance.name,
    privateIpAddress: networkInterface?.networkIP ?? null,
    // Lowercased to satisfy the shared reconciler's canonical status format;
    // GCP's documented instance statuses are upper-case words
    // (RUNNING/STOPPED/PROVISIONING/...).
    providerStatus: instance.status.toLowerCase(),
    publicIpAddress: networkInterface?.accessConfigs?.[0]?.natIP ?? null,
    region: regionFromZone(zone),
    resourceGroup: null,
    resourceKind: GCP_COMPUTE_INSTANCE_RESOURCE_TYPE,
    tags: instance.labels ?? {},
    zone,
  };
}

export interface GcpAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly maxPages?: number;
  readonly now?: () => number;
  readonly timeoutMs?: number;
}

function validateBoundedInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ProviderAdapterError('INVALID_REQUEST');
  }
  return value;
}

/**
 * GCP Compute Engine inventory adapter (Phase 10I). `instances.aggregatedList`
 * covers every zone (and therefore every region) in the project in one
 * paginated call -- unlike AWS EC2, there is no per-region credential
 * configuration needed.
 */
export class GcpAdapter implements ProviderAdapter, CloudResourceDiscoveryCapability {
  readonly providerKey = GCP_PROVIDER_KEY;
  readonly cloudResourceCapabilities: CloudResourceCapabilities = {
    listInstances: true,
    readNetworkAddresses: true,
    readRuntimeStatus: true,
    readTags: true,
  };

  private readonly auth: GcpAuthClient;
  private readonly fetchImplementation: FetchImplementation;
  private readonly maxPages: number;
  private readonly timeoutMs: number;

  constructor(options: GcpAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(options.maxPages ?? GCP_DEFAULT_MAX_PAGES, 1, GCP_DEFAULT_MAX_PAGES);
    this.timeoutMs = validateBoundedInteger(options.timeoutMs ?? GCP_DEFAULT_TIMEOUT_MS, 1, 60_000);
    this.auth = new GcpAuthClient({
      fetchImplementation: this.fetchImplementation,
      timeoutMs: this.timeoutMs,
      ...(options.now !== undefined ? { now: options.now } : {}),
    });
  }

  async discoverCloudResources(token: string): Promise<ProviderCloudResourceDiscovery> {
    const credential = parseGcpCredential(token);
    const accessToken = (await this.auth.mintAccessToken(credential, GCP_COMPUTE_READONLY_SCOPE)).accessToken;

    const discovered = new Map<string, DiscoveredCloudResource>();
    let completedAnyPage = false;
    let sawUnreachable = false;
    let pageToken: string | undefined;

    for (let page = 1; page <= this.maxPages; page += 1) {
      try {
        const result = await this.requestAggregatedListPage(credential.projectId, accessToken, pageToken);
        for (const zoneEntry of Object.values(result.items ?? {})) {
          for (const instance of zoneEntry.instances ?? []) {
            const normalized = normalizeInstance(instance);
            const prior = discovered.get(normalized.externalResourceId);
            if (prior && JSON.stringify(prior) !== JSON.stringify(normalized)) {
              throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
            }
            discovered.set(normalized.externalResourceId, normalized);
          }
        }
        if ((result.unreachables ?? []).length > 0) {
          sawUnreachable = true;
        }
        completedAnyPage = true;
        pageToken = result.nextPageToken;
        if (pageToken === undefined) break;
        if (page === this.maxPages) {
          return this.partialResult(discovered, { code: 'UPSTREAM_BAD_RESPONSE', retryAfterSeconds: null });
        }
      } catch (error) {
        if (!completedAnyPage) throw error;
        return this.partialResult(discovered, safeProviderError(error));
      }
    }

    if (sawUnreachable) {
      // Some zones could not be reached this pass -- a genuinely partial
      // enumeration, not a truthful complete one, even though every page
      // that *did* return succeeded.
      return this.partialResult(discovered, { code: 'UPSTREAM_UNAVAILABLE', retryAfterSeconds: null });
    }

    return {
      completion: 'COMPLETE',
      error: null,
      externalResourceType: GCP_COMPUTE_INSTANCE_RESOURCE_TYPE,
      resources: [...discovered.values()],
    };
  }

  private partialResult(
    discovered: ReadonlyMap<string, DiscoveredCloudResource>,
    error: NonNullable<ProviderCloudResourceDiscovery['error']>,
  ): ProviderCloudResourceDiscovery {
    return {
      completion: 'PARTIAL',
      error,
      externalResourceType: GCP_COMPUTE_INSTANCE_RESOURCE_TYPE,
      resources: [...discovered.values()],
    };
  }

  private async requestAggregatedListPage(
    projectId: string,
    accessToken: string,
    pageToken: string | undefined,
  ): Promise<z.infer<typeof aggregatedListSchema>> {
    const url = new URL(`/compute/v1/projects/${projectId}/aggregated/instances`, GCP_COMPUTE_API_ORIGIN);
    url.searchParams.set('maxResults', String(GCP_DEFAULT_PAGE_SIZE));
    url.searchParams.set('returnPartialSuccess', 'true');
    if (pageToken !== undefined) {
      url.searchParams.set('pageToken', pageToken);
    }

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
      if (Number.isFinite(declaredLength) && declaredLength > GCP_MAX_RESPONSE_BYTES) {
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
      if (Buffer.byteLength(text, 'utf8') > GCP_MAX_RESPONSE_BYTES) {
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
      const result = aggregatedListSchema.safeParse(parsedJson);
      if (!result.success) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      return result.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  private httpError(status: number, body: unknown): ProviderAdapterError {
    const parsed = errorEnvelopeSchema.safeParse(body);
    const gcpStatus = parsed.success ? parsed.data.error.status : undefined;
    if (status === 401 || gcpStatus === 'UNAUTHENTICATED') return new ProviderAdapterError('AUTH_INVALID');
    if (status === 403 || gcpStatus === 'PERMISSION_DENIED') return new ProviderAdapterError('PERMISSION_DENIED');
    if (status === 404 || gcpStatus === 'NOT_FOUND') return new ProviderAdapterError('RESOURCE_NOT_FOUND');
    if (status === 429 || gcpStatus === 'RESOURCE_EXHAUSTED') return new ProviderAdapterError('RATE_LIMITED');
    if (status >= 500) return new ProviderAdapterError('UPSTREAM_UNAVAILABLE');
    if (status === 400) return new ProviderAdapterError('INVALID_REQUEST');
    return new ProviderAdapterError('UNKNOWN_PROVIDER_ERROR');
  }
}
