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
  ProviderCapabilities,
  ProviderDomainDiscovery,
  ProviderTokenValidation,
  ProviderTokenValidationCapability,
} from '../provider-adapter.types';
import { ProviderAdapterError } from '../provider.errors';
import {
  HOSTINGER_API_ORIGIN,
  HOSTINGER_DEFAULT_TIMEOUT_MS,
  HOSTINGER_DOMAINS_PORTFOLIO_PATH,
  HOSTINGER_DOMAIN_RESOURCE_TYPE,
  HOSTINGER_MAX_RESPONSE_BYTES,
  HOSTINGER_MAX_RETRY_AFTER_SECONDS,
  HOSTINGER_MAX_TOKEN_LENGTH,
  HOSTINGER_PROVIDER_KEY,
} from './hostinger.constants';

type FetchImplementation = typeof fetch;

/**
 * Hostinger has no dedicated token-verify endpoint, so validation performs
 * the same portfolio read discovery uses. The documented
 * `DomainsV1DomainDomainResource` model has no auto-renew field and the
 * portfolio list has no pagination parameters (it returns every domain in
 * one array) -- see hostinger.constants.ts.
 */
const domainEntrySchema = z.object({
  domain: z.string().min(1).max(253),
  id: z.union([z.number().int().positive(), z.string().min(1)]),
  status: z.string().min(1).max(64),
});
const domainListSchema = z.array(domainEntrySchema);

export interface HostingerAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly timeoutMs?: number;
}

export function parseHostingerRetryAfter(value: string | null, now: number): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds)
      ? Math.min(seconds, HOSTINGER_MAX_RETRY_AFTER_SECONDS)
      : null;
  }
  const retryAt = Date.parse(trimmed);
  if (!Number.isFinite(retryAt)) return null;
  return Math.min(
    Math.max(0, Math.ceil((retryAt - now) / 1_000)),
    HOSTINGER_MAX_RETRY_AFTER_SECONDS,
  );
}

function normalizeDomain(
  entry: z.infer<typeof domainEntrySchema>,
): DiscoveredProviderDomain {
  try {
    return {
      // The portfolio list has no nameserver field (only the per-domain
      // details endpoint does); bulk discovery deliberately never makes an
      // N+1 details call per domain just to infer DNS hosting. This is
      // genuinely *unknown*, not a confirmed negative -- reporting `false`
      // here would be a fabricated claim, so this reports `null` (see
      // DiscoveredProviderDomain's tri-state contract).
      canonicalDomain: normalizeDomainName(entry.domain).normalizedDomainName,
      dnsHostedByProvider: null,
      externalResourceId: String(entry.id),
      // Lowercased defensively (casing isn't pinned down in Hostinger's
      // published model docs) to satisfy the shared reconciler's canonical
      // status format (see CANONICAL_RESOURCE_TYPE in
      // provider-domain-reconciliation.service.ts).
      providerStatus: entry.status.toLowerCase(),
    };
  } catch (error) {
    if (error instanceof InvalidDomainNameError) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    throw error;
  }
}

export class HostingerAdapter implements
  ProviderAdapter,
  ProviderTokenValidationCapability,
  DomainDiscoveryCapability
{
  readonly providerKey = HOSTINGER_PROVIDER_KEY;
  /**
   * Describes what this adapter actually does today: only the unpaginated
   * portfolio list is ever called. There is no per-domain
   * `GET /api/domains/v1/portfolio/{domain}` details call, so
   * readDomainDetails is false even though that endpoint exists upstream.
   */
  readonly capabilities: ProviderCapabilities = {
    listDomains: true,
    manageAutoRenew: false,
    manageDnsRecords: false,
    readAutoRenew: false,
    readDnsRecords: false,
    readDomainDetails: false,
    readNameservers: false,
  };

  private readonly fetchImplementation: FetchImplementation;
  private readonly timeoutMs: number;

  constructor(options: HostingerAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = validateBoundedInteger(
      options.timeoutMs ?? HOSTINGER_DEFAULT_TIMEOUT_MS,
      1,
      60_000,
    );
  }

  async validateToken(token: string): Promise<ProviderTokenValidation> {
    try {
      await this.requestPortfolio(token);
      return {
        expiresAt: null,
        notBefore: null,
        providerTokenId: 'hostinger-api-token',
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
    // The portfolio has no pagination -- this single read is always "page
    // one", so, consistent with Cloudflare/GoDaddy/Namecheap's
    // `completedPages === 0` rule, a failure here throws (surfacing as a
    // FAILED sync run) rather than resolving as a hollow PARTIAL result.
    const entries = await this.requestPortfolio(token);
    const discovered = new Map<string, DiscoveredProviderDomain>();
    for (const entry of entries) {
      const normalized = normalizeDomain(entry);
      const prior = discovered.get(normalized.externalResourceId);
      if (
        prior &&
        (prior.canonicalDomain !== normalized.canonicalDomain ||
          prior.providerStatus !== normalized.providerStatus)
      ) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      discovered.set(normalized.externalResourceId, normalized);
    }
    return {
      completion: 'COMPLETE',
      domains: [...discovered.values()],
      error: null,
      externalResourceType: HOSTINGER_DOMAIN_RESOURCE_TYPE,
    };
  }

  private async requestPortfolio(
    token: string,
  ): Promise<readonly z.infer<typeof domainEntrySchema>[]> {
    this.assertToken(token);
    const url = new URL(HOSTINGER_DOMAINS_PORTFOLIO_PATH, HOSTINGER_API_ORIGIN);

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
        declaredLength > HOSTINGER_MAX_RESPONSE_BYTES
      ) {
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
      if (Buffer.byteLength(text, 'utf8') > HOSTINGER_MAX_RESPONSE_BYTES) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      const result = domainListSchema.safeParse(parsed);
      if (!result.success) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      return result.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertToken(token: string): void {
    if (
      typeof token !== 'string' ||
      token.trim().length === 0 ||
      token.length > HOSTINGER_MAX_TOKEN_LENGTH
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
          parseHostingerRetryAfter(response.headers.get('retry-after'), Date.now()),
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

function validateBoundedInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ProviderAdapterError('INVALID_REQUEST');
  }
  return value;
}
