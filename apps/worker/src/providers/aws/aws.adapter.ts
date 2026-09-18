import { Buffer } from 'node:buffer';

import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

import type {
  CloudResourceCapabilities,
  CloudResourceDiscoveryCapability,
  DiscoveredCloudResource,
  ProviderCloudResourceDiscovery,
} from '../cloud-resource-adapter.types';
import type { ProviderAdapter } from '../provider-adapter.types';
import { ProviderAdapterError, safeProviderError } from '../provider.errors';
import {
  AWS_DEFAULT_MAX_PAGES,
  AWS_DEFAULT_MAX_RESULTS,
  AWS_DEFAULT_TIMEOUT_MS,
  AWS_EC2_API_VERSION,
  AWS_EC2_INSTANCE_RESOURCE_TYPE,
  AWS_MAX_RESPONSE_BYTES,
  AWS_PROVIDER_KEY,
  parseAwsCredential,
  type AwsCredential,
} from './aws.constants';
import { signAwsQueryRequest } from './aws.sigv4';

type FetchImplementation = typeof fetch;

const xmlParser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  isArray: (name) => name === 'item',
  parseAttributeValue: false,
  trimValues: true,
});

function asArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value as readonly T[];
  return [value] as readonly T[];
}

/**
 * Every AWS "query" protocol service (EC2, STS) reports errors either as
 * `<Response><Errors><Error>...` (EC2) or `<ErrorResponse><Error>...`
 * (STS). This reads whichever shape is present rather than assuming one --
 * classification is driven by the returned `Code`, which is AWS's own
 * stable, documented error identifier and authoritative over HTTP status.
 */
const AWS_ERROR_CODE_TO_PROVIDER_CODE: Readonly<Record<string, ProviderAdapterError['code']>> = {
  AccessDenied: 'PERMISSION_DENIED',
  AccessDeniedException: 'PERMISSION_DENIED',
  AuthFailure: 'AUTH_INVALID',
  InvalidAction: 'INVALID_REQUEST',
  InvalidClientTokenId: 'AUTH_INVALID',
  InvalidParameterValue: 'INVALID_REQUEST',
  MissingAuthenticationToken: 'AUTH_INVALID',
  MissingParameter: 'INVALID_REQUEST',
  RequestLimitExceeded: 'RATE_LIMITED',
  SignatureDoesNotMatch: 'AUTH_INVALID',
  Throttling: 'RATE_LIMITED',
  ThrottlingException: 'RATE_LIMITED',
  UnauthorizedOperation: 'PERMISSION_DENIED',
  UnrecognizedClientException: 'AUTH_INVALID',
  ValidationError: 'INVALID_REQUEST',
};

export function classifyAwsErrorCode(code: string | undefined): ProviderAdapterError['code'] {
  if (code === undefined) return 'UNKNOWN_PROVIDER_ERROR';
  return AWS_ERROR_CODE_TO_PROVIDER_CODE[code] ?? 'UNKNOWN_PROVIDER_ERROR';
}

export function extractAwsErrorCode(xmlText: string): string | undefined {
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(xmlText) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const ec2Errors = asArray(
    ((parsed.Response as Record<string, unknown> | undefined)?.Errors as { Error?: unknown } | undefined)?.Error,
  );
  const stsError = (parsed.ErrorResponse as Record<string, unknown> | undefined)?.Error;
  const first = ec2Errors[0] ?? stsError;
  if (typeof first !== 'object' || first === null) return undefined;
  const code = (first as Record<string, unknown>).Code;
  return typeof code === 'string' ? code : undefined;
}

const tagItemSchema = z.object({
  key: z.string().min(1).max(256).optional(),
  value: z.string().max(1_024).optional(),
});

/**
 * fast-xml-parser parses a self-closing/empty element (e.g. `<tagSet/>` or
 * `<reservationSet/>`, which AWS genuinely sends for "no items here") as the
 * string `""`, not `{}` -- an empty-object schema would otherwise reject a
 * perfectly valid, documented zero-result response as malformed. This
 * normalizes that one shape to `{}` before the object schema runs; every
 * other unexpected value still fails validation as before.
 */
function emptyableObject<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? {} : value), schema);
}

const instanceSchema = z.object({
  imageId: z.string().min(1).max(64).optional(),
  instanceId: z.string().min(1).max(64),
  instanceState: z.object({ name: z.string().min(1).max(32) }),
  instanceType: z.string().min(1).max(64),
  ipAddress: z.string().min(1).max(64).optional(),
  launchTime: z.string().optional(),
  placement: emptyableObject(z.object({ availabilityZone: z.string().min(1).max(32).optional() })).optional(),
  privateIpAddress: z.string().min(1).max(64).optional(),
  tagSet: emptyableObject(z.object({ item: z.array(tagItemSchema).optional() })).optional(),
});

const reservationSchema = z.object({
  instancesSet: emptyableObject(z.object({ item: z.array(instanceSchema).optional() })).optional(),
});

const describeInstancesSchema = z.object({
  DescribeInstancesResponse: z.object({
    nextToken: z.string().optional(),
    reservationSet: emptyableObject(z.object({ item: z.array(reservationSchema).optional() })).optional(),
  }),
});

function normalizeInstance(
  instance: z.infer<typeof instanceSchema>,
  region: string,
): DiscoveredCloudResource {
  const tags: Record<string, string> = {};
  for (const tag of instance.tagSet?.item ?? []) {
    if (tag.key !== undefined && tag.value !== undefined) {
      tags[tag.key] = tag.value;
    }
  }
  let launchedAt: string | null = null;
  if (instance.launchTime !== undefined) {
    const parsed = new Date(instance.launchTime);
    if (Number.isNaN(parsed.getTime())) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    launchedAt = parsed.toISOString();
  }
  return {
    externalResourceId: instance.instanceId,
    imageReference: instance.imageId ?? null,
    instanceType: instance.instanceType,
    launchedAt,
    // EC2 has no dedicated resource name; `Name` is a conventional tag, not
    // a field of the resource itself. Falling back to the instance ID keeps
    // `name` truthfully non-blank without fabricating a display name AWS
    // never returned.
    name: tags.Name ?? instance.instanceId,
    privateIpAddress: instance.privateIpAddress ?? null,
    // Lowercased defensively to satisfy the shared reconciler's canonical
    // status format even though AWS's documented instance-state names are
    // already lowercase words (pending/running/stopping/stopped/...).
    providerStatus: instance.instanceState.name.toLowerCase(),
    publicIpAddress: instance.ipAddress ?? null,
    region,
    resourceGroup: null,
    resourceKind: AWS_EC2_INSTANCE_RESOURCE_TYPE,
    tags,
    zone: instance.placement?.availabilityZone ?? null,
  };
}

export interface AwsAdapterOptions {
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
 * AWS EC2 inventory adapter (Phase 10I). Discovers instances across every
 * region the connection's credential names -- EC2's DescribeInstances is
 * fully region-scoped (unlike GCP's/Azure's account-/subscription-wide list
 * APIs), so there is no single call that enumerates "all AWS regions" for an
 * account; see AwsCredential.regions.
 */
export class AwsAdapter implements ProviderAdapter, CloudResourceDiscoveryCapability {
  readonly providerKey = AWS_PROVIDER_KEY;
  readonly cloudResourceCapabilities: CloudResourceCapabilities = {
    listInstances: true,
    readNetworkAddresses: true,
    readRuntimeStatus: true,
    readTags: true,
  };

  private readonly fetchImplementation: FetchImplementation;
  private readonly maxPages: number;
  private readonly nowMs: () => number;
  private readonly timeoutMs: number;

  constructor(options: AwsAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(options.maxPages ?? AWS_DEFAULT_MAX_PAGES, 1, AWS_DEFAULT_MAX_PAGES);
    this.nowMs = options.now ?? Date.now;
    this.timeoutMs = validateBoundedInteger(options.timeoutMs ?? AWS_DEFAULT_TIMEOUT_MS, 1, 60_000);
  }

  async discoverCloudResources(token: string): Promise<ProviderCloudResourceDiscovery> {
    const credential = parseAwsCredential(token);
    const discovered = new Map<string, DiscoveredCloudResource>();
    let completedAnyPage = false;

    for (const region of credential.regions) {
      let nextToken: string | undefined;
      for (let page = 1; page <= this.maxPages; page += 1) {
        try {
          const result = await this.requestDescribeInstancesPage(credential, region, nextToken);
          for (const instance of result.instances) {
            const normalized = normalizeInstance(instance, region);
            const prior = discovered.get(normalized.externalResourceId);
            if (prior && JSON.stringify(prior) !== JSON.stringify(normalized)) {
              throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
            }
            discovered.set(normalized.externalResourceId, normalized);
          }
          completedAnyPage = true;
          nextToken = result.nextToken;
          if (nextToken === undefined) break;
          if (page === this.maxPages) {
            return this.partialResult(discovered, {
              code: 'UPSTREAM_BAD_RESPONSE',
              retryAfterSeconds: null,
            });
          }
        } catch (error) {
          if (!completedAnyPage) throw error;
          return this.partialResult(discovered, safeProviderError(error));
        }
      }
    }

    return {
      completion: 'COMPLETE',
      error: null,
      externalResourceType: AWS_EC2_INSTANCE_RESOURCE_TYPE,
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
      externalResourceType: AWS_EC2_INSTANCE_RESOURCE_TYPE,
      resources: [...discovered.values()],
    };
  }

  private async requestDescribeInstancesPage(
    credential: AwsCredential,
    region: string,
    nextToken: string | undefined,
  ): Promise<{ instances: readonly z.infer<typeof instanceSchema>[]; nextToken: string | undefined }> {
    const host = `ec2.${region}.amazonaws.com`;
    const params = new URLSearchParams({
      Action: 'DescribeInstances',
      MaxResults: String(AWS_DEFAULT_MAX_RESULTS),
      Version: AWS_EC2_API_VERSION,
    });
    if (nextToken !== undefined) {
      params.set('NextToken', nextToken);
    }
    const body = params.toString();
    const signed = signAwsQueryRequest({
      body,
      credentials: credential,
      host,
      now: new Date(this.nowMs()),
      region,
      service: 'ec2',
    });

    const text = await this.postAndReadBody(signed.url, signed.headers, body);
    let parsedXml: unknown;
    try {
      parsedXml = xmlParser.parse(text) as unknown;
    } catch {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    const result = describeInstancesSchema.safeParse(parsedXml);
    if (!result.success) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    const instances = (result.data.DescribeInstancesResponse.reservationSet?.item ?? [])
      .flatMap((reservation) => reservation.instancesSet?.item ?? []);
    return { instances, nextToken: result.data.DescribeInstancesResponse.nextToken };
  }

  private async postAndReadBody(
    url: string,
    headers: Readonly<Record<string, string>>,
    body: string,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        body,
        headers,
        method: 'POST',
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
      if (Number.isFinite(declaredLength) && declaredLength > AWS_MAX_RESPONSE_BYTES) {
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
      if (Buffer.byteLength(text, 'utf8') > AWS_MAX_RESPONSE_BYTES) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      if (!response.ok) {
        throw this.httpError(response.status, text);
      }
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  private httpError(status: number, body: string): ProviderAdapterError {
    // Neither EC2 nor STS document a Retry-After header on throttling
    // responses (unlike Cloudflare/GoDaddy/Hostinger's REST APIs), so
    // retryAfterSeconds is honestly reported as unknown (null) rather than
    // guessing a wait duration AWS never communicated.
    const awsCode = extractAwsErrorCode(body);
    if (awsCode !== undefined) {
      return new ProviderAdapterError(classifyAwsErrorCode(awsCode));
    }
    if (status === 401) return new ProviderAdapterError('AUTH_INVALID');
    if (status === 403) return new ProviderAdapterError('PERMISSION_DENIED');
    if (status === 429) return new ProviderAdapterError('RATE_LIMITED');
    if (status >= 500 && status <= 599) return new ProviderAdapterError('UPSTREAM_UNAVAILABLE');
    if (status === 400) return new ProviderAdapterError('INVALID_REQUEST');
    return new ProviderAdapterError('UNKNOWN_PROVIDER_ERROR');
  }
}
