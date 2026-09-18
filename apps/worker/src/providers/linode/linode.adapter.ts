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
  LINODE_API_BASE_PATH,
  LINODE_API_ORIGIN,
  LINODE_DEFAULT_MAX_PAGES,
  LINODE_DEFAULT_PAGE_SIZE,
  LINODE_DEFAULT_TIMEOUT_MS,
  LINODE_INSTANCE_RESOURCE_TYPE,
  LINODE_INSTANCES_PATH,
  LINODE_MAX_PAGE_SIZE,
  LINODE_MAX_RESPONSE_BYTES,
  LINODE_MAX_RETRY_AFTER_SECONDS,
  LINODE_MAX_TOKEN_LENGTH,
  LINODE_MIN_PAGE_SIZE,
  LINODE_PROVIDER_KEY,
} from './linode.constants';

type FetchImplementation = typeof fetch;

const CANONICAL_TOKEN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

// Linode's status vocabulary is documented but not treated as exhaustively
// stable here -- validated as a bounded canonical token, not a hardcoded
// zod enum, so a legitimate new status value is never mistaken for a
// malformed response.
const instanceSchema = z.object({
  created: z.string(),
  id: z.number().int().nonnegative(),
  image: z.string().nullable(),
  ipv4: z.array(z.string()).default([]),
  label: z.string().min(1).max(255),
  region: z.string().regex(CANONICAL_TOKEN).max(64),
  status: z.string().regex(CANONICAL_TOKEN).max(64),
  tags: z.array(z.string()).optional(),
  type: z.string().nullable(),
});

const instancesPageSchema = z.object({
  data: z.array(instanceSchema),
  page: z.number().int().positive(),
  pages: z.number().int().nonnegative(),
  results: z.number().int().nonnegative(),
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

function normalizeInstance(
  value: z.infer<typeof instanceSchema>,
): DiscoveredProviderServer {
  return {
    canonicalName: value.label.trim(),
    externalResourceId: String(value.id),
    hostname: null,
    operatingSystem: value.image && value.image.trim().length > 0 ? value.image.trim() : null,
    primaryIp: value.ipv4[0] ?? null,
    providerStatus: value.status,
    region: value.region,
    serverKind: value.type && value.type.trim().length > 0 ? value.type.trim() : null,
  };
}

export function parseLinodeRetryAfter(
  retryAfterHeader: string | null,
  now: number,
): number | null {
  if (retryAfterHeader === null) return null;
  const trimmed = retryAfterHeader.trim();
  if (/^\d+$/u.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds)
      ? Math.min(seconds, LINODE_MAX_RETRY_AFTER_SECONDS)
      : null;
  }
  const retryAt = Date.parse(trimmed);
  if (!Number.isFinite(retryAt)) return null;
  return Math.min(
    Math.max(0, Math.ceil((retryAt - now) / 1_000)),
    LINODE_MAX_RETRY_AFTER_SECONDS,
  );
}

export interface LinodeAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly maxPages?: number;
  readonly now?: () => number;
  readonly pageSize?: number;
  readonly timeoutMs?: number;
}

export class LinodeAdapter implements
  ProviderAdapter,
  ProviderTokenValidationCapability,
  ServerDiscoveryCapability
{
  readonly providerKey = LINODE_PROVIDER_KEY;

  private readonly fetchImplementation: FetchImplementation;
  private readonly maxPages: number;
  private readonly now: () => number;
  private readonly pageSize: number;
  private readonly timeoutMs: number;

  constructor(options: LinodeAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(
      options.maxPages ?? LINODE_DEFAULT_MAX_PAGES,
      1,
      LINODE_DEFAULT_MAX_PAGES,
    );
    this.now = options.now ?? Date.now;
    this.pageSize = validateBoundedInteger(
      options.pageSize ?? LINODE_DEFAULT_PAGE_SIZE,
      LINODE_MIN_PAGE_SIZE,
      LINODE_MAX_PAGE_SIZE,
    );
    this.timeoutMs = validateBoundedInteger(
      options.timeoutMs ?? LINODE_DEFAULT_TIMEOUT_MS,
      1,
      60_000,
    );
  }

  async validateToken(token: string): Promise<ProviderTokenValidation> {
    try {
      const value = await this.requestJson(LINODE_INSTANCES_PATH, token, {
        page: '1',
        page_size: String(LINODE_MIN_PAGE_SIZE),
      });
      const parsed = instancesPageSchema.safeParse(value);
      if (!parsed.success) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      return {
        expiresAt: null,
        notBefore: null,
        providerTokenId: 'linode-token',
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
        const value = await this.requestJson(LINODE_INSTANCES_PATH, token, {
          page: String(page),
          page_size: String(this.pageSize),
        });
        const parsed = instancesPageSchema.safeParse(value);
        if (!parsed.success) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }
        if (
          parsed.data.page !== page ||
          (parsed.data.pages === 0 ? page !== 1 : parsed.data.pages < page)
        ) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }

        for (const instance of parsed.data.data) {
          const normalized = normalizeInstance(instance);
          const prior = discovered.get(normalized.externalResourceId);
          if (prior && JSON.stringify(prior) !== JSON.stringify(normalized)) {
            throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
          }
          discovered.set(normalized.externalResourceId, normalized);
        }
        completedPages += 1;

        if (parsed.data.pages === 0 || page >= parsed.data.pages) {
          return {
            completion: 'COMPLETE',
            error: null,
            externalResourceType: LINODE_INSTANCE_RESOURCE_TYPE,
            servers: [...discovered.values()],
          };
        }
      } catch (error) {
        if (completedPages === 0) throw error;
        return {
          completion: 'PARTIAL',
          error: safeProviderError(error),
          externalResourceType: LINODE_INSTANCE_RESOURCE_TYPE,
          servers: [...discovered.values()],
        };
      }
    }

    return {
      completion: 'PARTIAL',
      error: { code: 'UPSTREAM_BAD_RESPONSE', retryAfterSeconds: null },
      externalResourceType: LINODE_INSTANCE_RESOURCE_TYPE,
      servers: [...discovered.values()],
    };
  }

  private async requestJson(
    path: string,
    token: string,
    query?: Readonly<Record<string, string>>,
  ): Promise<unknown> {
    this.assertToken(token);
    const url = new URL(`${LINODE_API_BASE_PATH}${path}`, LINODE_API_ORIGIN);
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
        declaredLength > LINODE_MAX_RESPONSE_BYTES
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
      if (Buffer.byteLength(text, 'utf8') > LINODE_MAX_RESPONSE_BYTES) {
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
      token.length > LINODE_MAX_TOKEN_LENGTH
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
          parseLinodeRetryAfter(response.headers.get('retry-after'), this.now()),
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
