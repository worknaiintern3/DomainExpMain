import { Buffer } from 'node:buffer';

import { z } from 'zod';

import type {
  DiscoveredProviderServer,
  ProviderAdapter,
  ProviderServerDiscovery,
  ProviderTokenValidation,
  ProviderTokenValidationCapability,
  ServerDiscoveryCapability,
} from '../provider-adapter.types';
import { ProviderAdapterError, safeProviderError } from '../provider.errors';
import {
  VULTR_API_ORIGIN,
  VULTR_DEFAULT_MAX_PAGES,
  VULTR_DEFAULT_PAGE_SIZE,
  VULTR_DEFAULT_TIMEOUT_MS,
  VULTR_INSTANCE_RESOURCE_TYPE,
  VULTR_INSTANCES_PATH,
  VULTR_MAX_PAGE_SIZE,
  VULTR_MAX_RESPONSE_BYTES,
  VULTR_MAX_RETRY_AFTER_SECONDS,
  VULTR_MAX_TOKEN_LENGTH,
  VULTR_MIN_PAGE_SIZE,
  VULTR_PROVIDER_KEY,
} from './vultr.constants';

type FetchImplementation = typeof fetch;

const CANONICAL_TOKEN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

// Vultr's documented status/power_status vocabularies are not exhaustively
// published, so these are validated as bounded canonical tokens rather than
// a hardcoded zod enum -- a legitimate value this adapter hasn't seen before
// must never be rejected as a malformed response.
const instanceSchema = z.object({
  date_created: z.string(),
  hostname: z.string().nullable().optional(),
  id: z.string().min(1).max(128),
  label: z.string().nullable().optional(),
  main_ip: z.string().min(1).max(64),
  os: z.string().nullable().optional(),
  plan: z.string().regex(CANONICAL_TOKEN).max(64),
  power_status: z.string().regex(CANONICAL_TOKEN).max(64),
  region: z.string().regex(CANONICAL_TOKEN).max(64),
  status: z.string().regex(CANONICAL_TOKEN).max(64),
  tags: z.array(z.string()).optional(),
});

const instancesPageSchema = z.object({
  instances: z.array(instanceSchema),
  meta: z.object({
    links: z.object({ next: z.string() }),
    total: z.number().int().nonnegative(),
  }),
});

const NULL_IP_PLACEHOLDER = '0.0.0.0';

function validateBoundedInteger(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ProviderAdapterError('INVALID_REQUEST');
  }
  return value;
}

function normalizeInstance(
  value: z.infer<typeof instanceSchema>,
): DiscoveredProviderServer {
  const name = (value.label && value.label.trim().length > 0
    ? value.label
    : value.hostname && value.hostname.trim().length > 0
      ? value.hostname
      : value.id
  ).trim();
  return {
    canonicalName: name,
    externalResourceId: value.id,
    hostname: null,
    operatingSystem: value.os && value.os.trim().length > 0 ? value.os.trim() : null,
    // Vultr reports an unassigned public IP as the literal 0.0.0.0
    // sentinel rather than omitting the field.
    primaryIp: value.main_ip.trim().length > 0 && value.main_ip !== NULL_IP_PLACEHOLDER
      ? value.main_ip
      : null,
    // Both halves are schema-validated canonical tokens; they are joined
    // with '-' (not ':') so the combined value still satisfies the
    // reconciler's CANONICAL_RESOURCE_TYPE contract.
    providerStatus: `${value.status}-${value.power_status}`,
    region: value.region,
    serverKind: value.plan,
  };
}

export function parseVultrRetryAfter(
  retryAfterHeader: string | null,
  now: number,
): number | null {
  if (retryAfterHeader === null) return null;
  const trimmed = retryAfterHeader.trim();
  if (/^\d+$/u.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds)
      ? Math.min(seconds, VULTR_MAX_RETRY_AFTER_SECONDS)
      : null;
  }
  const retryAt = Date.parse(trimmed);
  if (!Number.isFinite(retryAt)) return null;
  return Math.min(
    Math.max(0, Math.ceil((retryAt - now) / 1_000)),
    VULTR_MAX_RETRY_AFTER_SECONDS,
  );
}

export interface VultrAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly maxPages?: number;
  readonly now?: () => number;
  readonly pageSize?: number;
  readonly timeoutMs?: number;
}

export class VultrAdapter implements
  ProviderAdapter,
  ProviderTokenValidationCapability,
  ServerDiscoveryCapability
{
  readonly providerKey = VULTR_PROVIDER_KEY;

  private readonly fetchImplementation: FetchImplementation;
  private readonly maxPages: number;
  private readonly now: () => number;
  private readonly pageSize: number;
  private readonly timeoutMs: number;

  constructor(options: VultrAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(
      options.maxPages ?? VULTR_DEFAULT_MAX_PAGES,
      1,
      VULTR_DEFAULT_MAX_PAGES,
    );
    this.now = options.now ?? Date.now;
    this.pageSize = validateBoundedInteger(
      options.pageSize ?? VULTR_DEFAULT_PAGE_SIZE,
      VULTR_MIN_PAGE_SIZE,
      VULTR_MAX_PAGE_SIZE,
    );
    this.timeoutMs = validateBoundedInteger(
      options.timeoutMs ?? VULTR_DEFAULT_TIMEOUT_MS,
      1,
      60_000,
    );
  }

  async validateToken(token: string): Promise<ProviderTokenValidation> {
    try {
      const value = await this.requestJson(VULTR_INSTANCES_PATH, token, {
        per_page: '1',
      });
      const parsed = instancesPageSchema.safeParse(value);
      if (!parsed.success) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      return {
        expiresAt: null,
        notBefore: null,
        providerTokenId: 'vultr-api-key',
        status: 'ACTIVE',
        valid: true,
      };
    } catch (error) {
      if (error instanceof ProviderAdapterError && error.code === 'AUTH_INVALID') {
        return { errorCode: 'AUTH_INVALID', status: 'INVALID', valid: false };
      }
      throw error;
    }
  }

  async discoverServers(token: string): Promise<ProviderServerDiscovery> {
    const discovered = new Map<string, DiscoveredProviderServer>();
    let completedPages = 0;
    let cursor = '';

    for (let iteration = 0; iteration < this.maxPages; iteration += 1) {
      try {
        const query: Record<string, string> = { per_page: String(this.pageSize) };
        if (cursor.length > 0) query.cursor = cursor;
        const value = await this.requestJson(VULTR_INSTANCES_PATH, token, query);
        const parsed = instancesPageSchema.safeParse(value);
        if (!parsed.success) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }

        for (const instance of parsed.data.instances) {
          const normalized = normalizeInstance(instance);
          const prior = discovered.get(normalized.externalResourceId);
          if (prior && JSON.stringify(prior) !== JSON.stringify(normalized)) {
            throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
          }
          discovered.set(normalized.externalResourceId, normalized);
        }
        completedPages += 1;

        const nextCursor = parsed.data.meta.links.next;
        if (nextCursor.length === 0) {
          return {
            completion: 'COMPLETE',
            error: null,
            externalResourceType: VULTR_INSTANCE_RESOURCE_TYPE,
            servers: [...discovered.values()],
          };
        }
        cursor = nextCursor;
      } catch (error) {
        if (completedPages === 0) throw error;
        return {
          completion: 'PARTIAL',
          error: safeProviderError(error),
          externalResourceType: VULTR_INSTANCE_RESOURCE_TYPE,
          servers: [...discovered.values()],
        };
      }
    }

    return {
      completion: 'PARTIAL',
      error: { code: 'UPSTREAM_BAD_RESPONSE', retryAfterSeconds: null },
      externalResourceType: VULTR_INSTANCE_RESOURCE_TYPE,
      servers: [...discovered.values()],
    };
  }

  private async requestJson(
    path: string,
    token: string,
    query?: Readonly<Record<string, string>>,
  ): Promise<unknown> {
    this.assertToken(token);
    const url = new URL(path, VULTR_API_ORIGIN);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        headers: { Authorization: `Bearer ${token}` },
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
      if (!response.ok) {
        throw this.httpError(response);
      }
      const declaredLength = Number(response.headers.get('content-length'));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > VULTR_MAX_RESPONSE_BYTES
      ) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }

      let text: string;
      try {
        text = await response.text();
      } catch {
        throw new ProviderAdapterError(
          controller.signal.aborted
            ? 'NETWORK_TIMEOUT'
            : 'UPSTREAM_BAD_RESPONSE',
        );
      }
      if (Buffer.byteLength(text, 'utf8') > VULTR_MAX_RESPONSE_BYTES) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertToken(token: string): void {
    if (
      typeof token !== 'string' ||
      token.trim().length === 0 ||
      token.length > VULTR_MAX_TOKEN_LENGTH
    ) {
      throw new ProviderAdapterError('INVALID_REQUEST');
    }
  }

  private httpError(response: Response): ProviderAdapterError {
    switch (response.status) {
      case 400:
        return new ProviderAdapterError('INVALID_REQUEST');
      case 401:
        return new ProviderAdapterError('AUTH_INVALID');
      case 403:
        return new ProviderAdapterError('PERMISSION_DENIED');
      case 404:
        return new ProviderAdapterError('RESOURCE_NOT_FOUND');
      case 429:
        return new ProviderAdapterError(
          'RATE_LIMITED',
          parseVultrRetryAfter(response.headers.get('retry-after'), this.now()),
        );
      default:
        return new ProviderAdapterError(
          response.status >= 500 && response.status <= 599
            ? 'UPSTREAM_UNAVAILABLE'
            : 'UNKNOWN_PROVIDER_ERROR',
        );
    }
  }
}
