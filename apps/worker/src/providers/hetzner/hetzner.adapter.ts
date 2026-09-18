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
  HETZNER_API_BASE_PATH,
  HETZNER_API_ORIGIN,
  HETZNER_DEFAULT_MAX_PAGES,
  HETZNER_DEFAULT_PAGE_SIZE,
  HETZNER_DEFAULT_TIMEOUT_MS,
  HETZNER_MAX_PAGE_SIZE,
  HETZNER_MAX_RESPONSE_BYTES,
  HETZNER_MAX_RETRY_AFTER_SECONDS,
  HETZNER_MAX_TOKEN_LENGTH,
  HETZNER_MIN_PAGE_SIZE,
  HETZNER_PROVIDER_KEY,
  HETZNER_SERVER_RESOURCE_TYPE,
  HETZNER_SERVERS_PATH,
  HETZNER_TOKEN_VERIFY_PATH,
} from './hetzner.constants';

type FetchImplementation = typeof fetch;

const locationsPageSchema = z.object({
  locations: z.array(z.object({ id: z.number().int() })),
});

const HETZNER_SERVER_STATUS = [
  'running',
  'initializing',
  'starting',
  'stopping',
  'off',
  'deleting',
  'migrating',
  'rebuilding',
  'unknown',
] as const;

const serverSchema = z.object({
  created: z.string(),
  datacenter: z.object({
    location: z.object({ name: z.string().min(1).max(255) }),
  }),
  id: z.number().int().nonnegative(),
  image: z
    .object({
      name: z.string().nullable().optional(),
      os_flavor: z.string().optional(),
    })
    .nullable(),
  labels: z.record(z.string(), z.string()).optional(),
  name: z.string().min(1).max(255),
  public_net: z.object({
    ipv4: z.object({ ip: z.string().min(1).max(64) }).nullable(),
    ipv6: z.object({ ip: z.string().min(1).max(64) }).nullable().optional(),
  }),
  server_type: z.object({ name: z.string().min(1).max(64) }),
  status: z.enum(HETZNER_SERVER_STATUS),
});

const serversPageSchema = z.object({
  meta: z
    .object({
      pagination: z.object({
        last_page: z.number().int().nullable().optional(),
        next_page: z.number().int().nullable().optional(),
        page: z.number().int().positive(),
        per_page: z.number().int().positive(),
        total_entries: z.number().int().nonnegative().optional(),
      }),
    })
    .optional(),
  servers: z.array(serverSchema),
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

function normalizeServer(
  value: z.infer<typeof serverSchema>,
): DiscoveredProviderServer {
  const operatingSystem = value.image?.name ?? value.image?.os_flavor ?? null;
  return {
    canonicalName: value.name.trim(),
    externalResourceId: String(value.id),
    hostname: null,
    operatingSystem: operatingSystem && operatingSystem.trim().length > 0
      ? operatingSystem.trim()
      : null,
    primaryIp: value.public_net.ipv4?.ip ?? null,
    providerStatus: value.status,
    region: value.datacenter.location.name,
    serverKind: value.server_type.name,
  };
}

export function parseHetznerRetryAfter(
  retryAfterHeader: string | null,
  rateLimitResetHeader: string | null,
  now: number,
): number | null {
  if (retryAfterHeader !== null && /^\d+$/u.test(retryAfterHeader.trim())) {
    const seconds = Number(retryAfterHeader.trim());
    return Number.isSafeInteger(seconds)
      ? Math.min(seconds, HETZNER_MAX_RETRY_AFTER_SECONDS)
      : null;
  }
  if (rateLimitResetHeader !== null && /^\d+$/u.test(rateLimitResetHeader.trim())) {
    const resetEpochSeconds = Number(rateLimitResetHeader.trim());
    if (!Number.isSafeInteger(resetEpochSeconds)) return null;
    return Math.min(
      Math.max(0, resetEpochSeconds - Math.floor(now / 1_000)),
      HETZNER_MAX_RETRY_AFTER_SECONDS,
    );
  }
  return null;
}

export interface HetznerAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly maxPages?: number;
  readonly now?: () => number;
  readonly pageSize?: number;
  readonly timeoutMs?: number;
}

export class HetznerAdapter implements
  ProviderAdapter,
  ProviderTokenValidationCapability,
  ServerDiscoveryCapability
{
  readonly providerKey = HETZNER_PROVIDER_KEY;

  private readonly fetchImplementation: FetchImplementation;
  private readonly maxPages: number;
  private readonly now: () => number;
  private readonly pageSize: number;
  private readonly timeoutMs: number;

  constructor(options: HetznerAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(
      options.maxPages ?? HETZNER_DEFAULT_MAX_PAGES,
      1,
      HETZNER_DEFAULT_MAX_PAGES,
    );
    this.now = options.now ?? Date.now;
    this.pageSize = validateBoundedInteger(
      options.pageSize ?? HETZNER_DEFAULT_PAGE_SIZE,
      HETZNER_MIN_PAGE_SIZE,
      HETZNER_MAX_PAGE_SIZE,
    );
    this.timeoutMs = validateBoundedInteger(
      options.timeoutMs ?? HETZNER_DEFAULT_TIMEOUT_MS,
      1,
      60_000,
    );
  }

  async validateToken(token: string): Promise<ProviderTokenValidation> {
    try {
      const value = await this.requestJson(HETZNER_TOKEN_VERIFY_PATH, token, {
        per_page: '1',
      });
      const parsed = locationsPageSchema.safeParse(value);
      if (!parsed.success) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      return {
        expiresAt: null,
        notBefore: null,
        providerTokenId: 'hetzner-token',
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

    for (let page = 1; page <= this.maxPages; page += 1) {
      try {
        const value = await this.requestJson(HETZNER_SERVERS_PATH, token, {
          page: String(page),
          per_page: String(this.pageSize),
        });
        const parsed = serversPageSchema.safeParse(value);
        if (!parsed.success) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }
        const pagination = parsed.data.meta?.pagination;
        if (
          !pagination ||
          pagination.page !== page ||
          pagination.per_page !== this.pageSize
        ) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }

        for (const server of parsed.data.servers) {
          const normalized = normalizeServer(server);
          const prior = discovered.get(normalized.externalResourceId);
          if (prior && JSON.stringify(prior) !== JSON.stringify(normalized)) {
            throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
          }
          discovered.set(normalized.externalResourceId, normalized);
        }
        completedPages += 1;

        if (!pagination.next_page) {
          return {
            completion: 'COMPLETE',
            error: null,
            externalResourceType: HETZNER_SERVER_RESOURCE_TYPE,
            servers: [...discovered.values()],
          };
        }
      } catch (error) {
        if (completedPages === 0) throw error;
        return {
          completion: 'PARTIAL',
          error: safeProviderError(error),
          externalResourceType: HETZNER_SERVER_RESOURCE_TYPE,
          servers: [...discovered.values()],
        };
      }
    }

    return {
      completion: 'PARTIAL',
      error: { code: 'UPSTREAM_BAD_RESPONSE', retryAfterSeconds: null },
      externalResourceType: HETZNER_SERVER_RESOURCE_TYPE,
      servers: [...discovered.values()],
    };
  }

  private async requestJson(
    path: string,
    token: string,
    query?: Readonly<Record<string, string>>,
  ): Promise<unknown> {
    this.assertToken(token);
    const url = new URL(
      `${HETZNER_API_BASE_PATH}${path}`,
      HETZNER_API_ORIGIN,
    );
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
        declaredLength > HETZNER_MAX_RESPONSE_BYTES
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
      if (Buffer.byteLength(text, 'utf8') > HETZNER_MAX_RESPONSE_BYTES) {
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
      token.length > HETZNER_MAX_TOKEN_LENGTH
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
          parseHetznerRetryAfter(
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
