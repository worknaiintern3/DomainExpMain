import { Buffer } from 'node:buffer';

import {
  InvalidDomainNameError,
  normalizeDomainName,
} from '@domainpulse/database';
import { z } from 'zod';

import type {
  DiscoveredProviderDomain,
  DomainDiscoveryCapability,
  ProviderAdapter,
  ProviderDomainDiscovery,
  ProviderTokenValidation,
  ProviderTokenValidationCapability,
} from '../provider-adapter.types';
import { ProviderAdapterError, safeProviderError } from '../provider.errors';
import {
  CLOUDFLARE_API_BASE_PATH,
  CLOUDFLARE_API_ORIGIN,
  CLOUDFLARE_DEFAULT_MAX_PAGES,
  CLOUDFLARE_DEFAULT_TIMEOUT_MS,
  CLOUDFLARE_DEFAULT_ZONE_PAGE_SIZE,
  CLOUDFLARE_MAX_RESPONSE_BYTES,
  CLOUDFLARE_MAX_RETRY_AFTER_SECONDS,
  CLOUDFLARE_MAX_TOKEN_LENGTH,
  CLOUDFLARE_MAX_ZONE_PAGE_SIZE,
  CLOUDFLARE_MIN_ZONE_PAGE_SIZE,
  CLOUDFLARE_PROVIDER_KEY,
  CLOUDFLARE_TOKEN_VERIFY_PATH,
  CLOUDFLARE_ZONE_RESOURCE_TYPE,
  CLOUDFLARE_ZONES_PATH,
} from './cloudflare.constants';

type FetchImplementation = typeof fetch;

const tokenResultSchema = z.object({
  expires_on: z.string().optional(),
  id: z.string().min(1).max(32),
  not_before: z.string().optional(),
  status: z.enum(['active', 'disabled', 'expired']),
});

const tokenEnvelopeSchema = z.object({
  result: tokenResultSchema.optional(),
  success: z.boolean(),
});

const zoneSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(253),
  status: z.enum(['initializing', 'pending', 'active', 'moved']),
  type: z.enum(['full', 'partial', 'secondary', 'internal']),
});

const zonePageSchema = z.object({
  result: z.array(zoneSchema),
  result_info: z.object({
    count: z.number().int().nonnegative().optional(),
    page: z.number().int().positive().optional(),
    per_page: z.number().int().positive().optional(),
    total_count: z.number().int().nonnegative().optional(),
    total_pages: z.number().int().nonnegative().optional(),
  }).optional(),
  success: z.boolean(),
});

export interface CloudflareAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly maxPages?: number;
  readonly now?: () => number;
  readonly pageSize?: number;
  readonly timeoutMs?: number;
}

function validIsoDate(value: string | undefined): string | null {
  if (value === undefined) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
  }
  return parsed.toISOString();
}

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

function normalizeZone(value: z.infer<typeof zoneSchema>): DiscoveredProviderDomain {
  try {
    return {
      canonicalDomain: normalizeDomainName(value.name).normalizedDomainName,
      dnsHostedByProvider: value.type === 'full' && value.status === 'active',
      externalResourceId: value.id,
      providerStatus: value.status,
    };
  } catch (error) {
    if (error instanceof InvalidDomainNameError) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    throw error;
  }
}

export function parseCloudflareRetryAfter(
  value: string | null,
  now: number,
): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds)
      ? Math.min(seconds, CLOUDFLARE_MAX_RETRY_AFTER_SECONDS)
      : null;
  }
  const retryAt = Date.parse(trimmed);
  if (!Number.isFinite(retryAt)) return null;
  return Math.min(
    Math.max(0, Math.ceil((retryAt - now) / 1_000)),
    CLOUDFLARE_MAX_RETRY_AFTER_SECONDS,
  );
}

export class CloudflareAdapter implements
  ProviderAdapter,
  ProviderTokenValidationCapability,
  DomainDiscoveryCapability
{
  readonly providerKey = CLOUDFLARE_PROVIDER_KEY;

  private readonly fetchImplementation: FetchImplementation;
  private readonly maxPages: number;
  private readonly now: () => number;
  private readonly pageSize: number;
  private readonly timeoutMs: number;

  constructor(options: CloudflareAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(
      options.maxPages ?? CLOUDFLARE_DEFAULT_MAX_PAGES,
      1,
      CLOUDFLARE_DEFAULT_MAX_PAGES,
    );
    this.now = options.now ?? Date.now;
    this.pageSize = validateBoundedInteger(
      options.pageSize ?? CLOUDFLARE_DEFAULT_ZONE_PAGE_SIZE,
      CLOUDFLARE_MIN_ZONE_PAGE_SIZE,
      CLOUDFLARE_MAX_ZONE_PAGE_SIZE,
    );
    this.timeoutMs = validateBoundedInteger(
      options.timeoutMs ?? CLOUDFLARE_DEFAULT_TIMEOUT_MS,
      1,
      60_000,
    );
  }

  async validateToken(token: string): Promise<ProviderTokenValidation> {
    try {
      const value = await this.requestJson(CLOUDFLARE_TOKEN_VERIFY_PATH, token);
      const parsed = tokenEnvelopeSchema.safeParse(value);
      if (!parsed.success) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      if (!parsed.data.success) {
        return { errorCode: 'AUTH_INVALID', status: 'INVALID', valid: false };
      }
      const result = parsed.data.result;
      if (!result) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      if (result.status !== 'active') {
        return {
          errorCode: 'AUTH_INVALID',
          status: result.status === 'disabled' ? 'DISABLED' : 'EXPIRED',
          valid: false,
        };
      }
      return {
        expiresAt: validIsoDate(result.expires_on),
        notBefore: validIsoDate(result.not_before),
        providerTokenId: result.id,
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

  async discoverDomains(token: string): Promise<ProviderDomainDiscovery> {
    const discovered = new Map<string, DiscoveredProviderDomain>();
    let completedPages = 0;

    for (let page = 1; page <= this.maxPages; page += 1) {
      try {
        const value = await this.requestJson(CLOUDFLARE_ZONES_PATH, token, {
          page: String(page),
          per_page: String(this.pageSize),
        });
        const parsed = zonePageSchema.safeParse(value);
        if (!parsed.success) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }
        if (!parsed.data.success) {
          throw new ProviderAdapterError('UNKNOWN_PROVIDER_ERROR');
        }
        const info = parsed.data.result_info;
        const totalPages = info?.total_pages;
        if (
          info?.page !== page ||
          info.per_page !== this.pageSize ||
          totalPages === undefined ||
          (totalPages === 0 ? page !== 1 : totalPages < page) ||
          (info.count !== undefined && info.count !== parsed.data.result.length) ||
          (totalPages === 0 && parsed.data.result.length > 0)
        ) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }

        for (const zone of parsed.data.result) {
          const normalized = normalizeZone(zone);
          const prior = discovered.get(normalized.externalResourceId);
          if (
            prior &&
            (prior.canonicalDomain !== normalized.canonicalDomain ||
              prior.dnsHostedByProvider !== normalized.dnsHostedByProvider ||
              prior.providerStatus !== normalized.providerStatus)
          ) {
            throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
          }
          discovered.set(normalized.externalResourceId, normalized);
        }
        completedPages += 1;

        if (totalPages === 0 || page >= totalPages) {
          return {
            completion: 'COMPLETE',
            domains: [...discovered.values()],
            error: null,
            externalResourceType: CLOUDFLARE_ZONE_RESOURCE_TYPE,
          };
        }
      } catch (error) {
        if (completedPages === 0) throw error;
        return {
          completion: 'PARTIAL',
          domains: [...discovered.values()],
          error: safeProviderError(error),
          externalResourceType: CLOUDFLARE_ZONE_RESOURCE_TYPE,
        };
      }
    }

    return {
      completion: 'PARTIAL',
      domains: [...discovered.values()],
      error: {
        code: 'UPSTREAM_BAD_RESPONSE',
        retryAfterSeconds: null,
      },
      externalResourceType: CLOUDFLARE_ZONE_RESOURCE_TYPE,
    };
  }

  private async requestJson(
    path: string,
    token: string,
    query?: Readonly<Record<string, string>>,
  ): Promise<unknown> {
    this.assertToken(token);
    const url = new URL(`${CLOUDFLARE_API_BASE_PATH}${path}`, CLOUDFLARE_API_ORIGIN);
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
        declaredLength > CLOUDFLARE_MAX_RESPONSE_BYTES
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
      if (Buffer.byteLength(text, 'utf8') > CLOUDFLARE_MAX_RESPONSE_BYTES) {
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
      token.length > CLOUDFLARE_MAX_TOKEN_LENGTH
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
          parseCloudflareRetryAfter(response.headers.get('retry-after'), this.now()),
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
