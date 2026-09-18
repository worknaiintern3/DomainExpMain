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
  DIGITALOCEAN_API_ORIGIN,
  DIGITALOCEAN_DEFAULT_MAX_PAGES,
  DIGITALOCEAN_DEFAULT_PAGE_SIZE,
  DIGITALOCEAN_DEFAULT_TIMEOUT_MS,
  DIGITALOCEAN_DROPLET_RESOURCE_TYPE,
  DIGITALOCEAN_DROPLETS_PATH,
  DIGITALOCEAN_MAX_PAGE_SIZE,
  DIGITALOCEAN_MAX_RESPONSE_BYTES,
  DIGITALOCEAN_MAX_RETRY_AFTER_SECONDS,
  DIGITALOCEAN_MAX_TOKEN_LENGTH,
  DIGITALOCEAN_MIN_PAGE_SIZE,
  DIGITALOCEAN_PROVIDER_KEY,
  DIGITALOCEAN_TOKEN_VERIFY_PATH,
} from './digitalocean.constants';

type FetchImplementation = typeof fetch;

// GET /v2/account -- DigitalOcean has no dedicated token-verify endpoint
// (see godaddy-token-validator.ts for the same precedent), so this is the
// smallest authenticated read that both confirms the token and reports the
// account's own reported status.
const accountResultSchema = z.object({
  status: z.enum(['active', 'warning', 'locked']),
  uuid: z.string().min(1).max(128).optional(),
});
const accountEnvelopeSchema = z.object({ account: accountResultSchema });

const dropletImageSchema = z.object({
  distribution: z.string().optional(),
  name: z.string().optional(),
  slug: z.string().nullable().optional(),
});

const dropletNetworkV4Schema = z.object({
  ip_address: z.string().min(1).max(64),
  type: z.enum(['public', 'private']),
});

const dropletSchema = z.object({
  created_at: z.string(),
  id: z.number().int().nonnegative(),
  image: dropletImageSchema.nullable(),
  name: z.string().min(1).max(255),
  networks: z.object({
    v4: z.array(dropletNetworkV4Schema),
  }),
  region: z.object({ slug: z.string().min(1).max(64) }),
  size_slug: z.string().min(1).max(64),
  status: z.enum(['new', 'active', 'off', 'archive']),
  tags: z.array(z.string()).optional(),
});

const dropletsPageSchema = z.object({
  droplets: z.array(dropletSchema),
  links: z
    .object({
      pages: z.object({ next: z.string().optional() }).optional(),
    })
    .optional(),
  meta: z.object({ total: z.number().int().nonnegative() }).optional(),
});

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

function normalizeDroplet(
  value: z.infer<typeof dropletSchema>,
): DiscoveredProviderServer {
  const publicIp = value.networks.v4.find((net) => net.type === 'public');
  const operatingSystem =
    value.image?.slug ?? value.image?.distribution ?? value.image?.name ?? null;
  return {
    canonicalName: value.name.trim(),
    externalResourceId: String(value.id),
    hostname: null,
    operatingSystem: operatingSystem && operatingSystem.trim().length > 0
      ? operatingSystem.trim()
      : null,
    primaryIp: publicIp?.ip_address ?? null,
    providerStatus: value.status,
    region: value.region.slug,
    serverKind: value.size_slug,
  };
}

export function parseDigitalOceanRetryAfter(
  retryAfterHeader: string | null,
  rateLimitResetHeader: string | null,
  now: number,
): number | null {
  if (retryAfterHeader !== null && /^\d+$/u.test(retryAfterHeader.trim())) {
    const seconds = Number(retryAfterHeader.trim());
    return Number.isSafeInteger(seconds)
      ? Math.min(seconds, DIGITALOCEAN_MAX_RETRY_AFTER_SECONDS)
      : null;
  }
  if (rateLimitResetHeader !== null && /^\d+$/u.test(rateLimitResetHeader.trim())) {
    const resetEpochSeconds = Number(rateLimitResetHeader.trim());
    if (!Number.isSafeInteger(resetEpochSeconds)) return null;
    return Math.min(
      Math.max(0, resetEpochSeconds - Math.floor(now / 1_000)),
      DIGITALOCEAN_MAX_RETRY_AFTER_SECONDS,
    );
  }
  return null;
}

export interface DigitalOceanAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly maxPages?: number;
  readonly now?: () => number;
  readonly pageSize?: number;
  readonly timeoutMs?: number;
}

export class DigitalOceanAdapter implements
  ProviderAdapter,
  ProviderTokenValidationCapability,
  ServerDiscoveryCapability
{
  readonly providerKey = DIGITALOCEAN_PROVIDER_KEY;

  private readonly fetchImplementation: FetchImplementation;
  private readonly maxPages: number;
  private readonly now: () => number;
  private readonly pageSize: number;
  private readonly timeoutMs: number;

  constructor(options: DigitalOceanAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(
      options.maxPages ?? DIGITALOCEAN_DEFAULT_MAX_PAGES,
      1,
      DIGITALOCEAN_DEFAULT_MAX_PAGES,
    );
    this.now = options.now ?? Date.now;
    this.pageSize = validateBoundedInteger(
      options.pageSize ?? DIGITALOCEAN_DEFAULT_PAGE_SIZE,
      DIGITALOCEAN_MIN_PAGE_SIZE,
      DIGITALOCEAN_MAX_PAGE_SIZE,
    );
    this.timeoutMs = validateBoundedInteger(
      options.timeoutMs ?? DIGITALOCEAN_DEFAULT_TIMEOUT_MS,
      1,
      60_000,
    );
  }

  async validateToken(token: string): Promise<ProviderTokenValidation> {
    try {
      const value = await this.requestJson(DIGITALOCEAN_TOKEN_VERIFY_PATH, token);
      const parsed = accountEnvelopeSchema.safeParse(value);
      if (!parsed.success) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      if (parsed.data.account.status === 'locked') {
        return { errorCode: 'AUTH_INVALID', status: 'DISABLED', valid: false };
      }
      return {
        expiresAt: null,
        notBefore: null,
        providerTokenId: parsed.data.account.uuid ?? 'digitalocean-account',
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
    let nextPage = 1;

    for (let iteration = 0; iteration < this.maxPages; iteration += 1) {
      try {
        const value = await this.requestJson(DIGITALOCEAN_DROPLETS_PATH, token, {
          page: String(nextPage),
          per_page: String(this.pageSize),
        });
        const parsed = dropletsPageSchema.safeParse(value);
        if (!parsed.success) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }

        for (const droplet of parsed.data.droplets) {
          const normalized = normalizeDroplet(droplet);
          const prior = discovered.get(normalized.externalResourceId);
          if (prior && JSON.stringify(prior) !== JSON.stringify(normalized)) {
            throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
          }
          discovered.set(normalized.externalResourceId, normalized);
        }
        completedPages += 1;

        const hasNext = Boolean(parsed.data.links?.pages?.next);
        if (!hasNext) {
          return {
            completion: 'COMPLETE',
            error: null,
            externalResourceType: DIGITALOCEAN_DROPLET_RESOURCE_TYPE,
            servers: [...discovered.values()],
          };
        }
        nextPage += 1;
      } catch (error) {
        if (completedPages === 0) throw error;
        return {
          completion: 'PARTIAL',
          error: safeProviderError(error),
          externalResourceType: DIGITALOCEAN_DROPLET_RESOURCE_TYPE,
          servers: [...discovered.values()],
        };
      }
    }

    return {
      completion: 'PARTIAL',
      error: { code: 'UPSTREAM_BAD_RESPONSE', retryAfterSeconds: null },
      externalResourceType: DIGITALOCEAN_DROPLET_RESOURCE_TYPE,
      servers: [...discovered.values()],
    };
  }

  private async requestJson(
    path: string,
    token: string,
    query?: Readonly<Record<string, string>>,
  ): Promise<unknown> {
    this.assertToken(token);
    const url = new URL(path, DIGITALOCEAN_API_ORIGIN);
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
        declaredLength > DIGITALOCEAN_MAX_RESPONSE_BYTES
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
      if (Buffer.byteLength(text, 'utf8') > DIGITALOCEAN_MAX_RESPONSE_BYTES) {
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
      token.length > DIGITALOCEAN_MAX_TOKEN_LENGTH
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
          parseDigitalOceanRetryAfter(
            response.headers.get('retry-after'),
            response.headers.get('ratelimit-reset'),
            this.now(),
          ),
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
