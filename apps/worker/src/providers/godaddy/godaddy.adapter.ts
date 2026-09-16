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
import { ProviderAdapterError, safeProviderError } from '../provider.errors';
import {
  GODADDY_API_ORIGIN,
  GODADDY_DEFAULT_MAX_PAGES,
  GODADDY_DEFAULT_PAGE_SIZE,
  GODADDY_DEFAULT_TIMEOUT_MS,
  GODADDY_DOMAINS_PATH,
  GODADDY_DOMAIN_RESOURCE_TYPE,
  GODADDY_MAX_PAGE_SIZE,
  GODADDY_MAX_RESPONSE_BYTES,
  GODADDY_MAX_RETRY_AFTER_SECONDS,
  GODADDY_MAX_TOKEN_LENGTH,
  GODADDY_MIN_PAGE_SIZE,
  GODADDY_NAMESERVER_SUFFIX,
  GODADDY_PROVIDER_KEY,
} from './godaddy.constants';

type FetchImplementation = typeof fetch;

/**
 * GoDaddy has no dedicated token-verify endpoint (unlike Cloudflare's
 * `/user/tokens/verify`), so validation performs the smallest real read the
 * Domains v1 API supports: one domain, no extra fields.
 */
const domainListEntrySchema = z.object({
  domain: z.string().min(1).max(253),
  domainId: z.union([z.number().int().positive(), z.string().min(1)]),
  expires: z.string().optional(),
  nameServers: z.array(z.string().min(1)).optional(),
  renewAuto: z.boolean().optional(),
  status: z.string().min(1).max(64),
});
const domainListSchema = z.array(domainListEntrySchema);

export interface GoDaddyAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly maxPages?: number;
  readonly pageSize?: number;
  readonly timeoutMs?: number;
}

export function parseGoDaddyRetryAfter(value: string | null, now: number): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds)
      ? Math.min(seconds, GODADDY_MAX_RETRY_AFTER_SECONDS)
      : null;
  }
  const retryAt = Date.parse(trimmed);
  if (!Number.isFinite(retryAt)) return null;
  return Math.min(
    Math.max(0, Math.ceil((retryAt - now) / 1_000)),
    GODADDY_MAX_RETRY_AFTER_SECONDS,
  );
}

function validateBoundedInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ProviderAdapterError('INVALID_REQUEST');
  }
  return value;
}

function normalizeDomain(
  entry: z.infer<typeof domainListEntrySchema>,
): DiscoveredProviderDomain {
  try {
    return {
      canonicalDomain: normalizeDomainName(entry.domain).normalizedDomainName,
      // Heuristic, not an absolute fact from a dedicated GoDaddy API field:
      // GoDaddy exposes no "DNS hosted by us" flag, so this infers it from
      // whether any returned nameserver ends in GoDaddy's own DNS suffix.
      // `nameServers` itself can be absent (no `includes=nameServers`
      // evidence for this page); that case is `false` here, which is
      // technically "no positive evidence found" rather than a provider-
      // confirmed negative -- callers should not treat a `false` GoDaddy
      // result with the same certainty as an explicit provider flag.
      dnsHostedByProvider: (entry.nameServers ?? []).some((ns) =>
        ns.toLowerCase().endsWith(GODADDY_NAMESERVER_SUFFIX),
      ),
      externalResourceId: String(entry.domainId),
      // GoDaddy returns statuses uppercase (e.g. "ACTIVE"); the shared
      // reconciler requires DomainPulse's canonical lowercase form (see
      // CANONICAL_RESOURCE_TYPE in provider-domain-reconciliation.service.ts).
      providerStatus: entry.status.toLowerCase(),
    };
  } catch (error) {
    if (error instanceof InvalidDomainNameError) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    throw error;
  }
}

export class GoDaddyAdapter implements
  ProviderAdapter,
  ProviderTokenValidationCapability,
  DomainDiscoveryCapability
{
  readonly providerKey = GODADDY_PROVIDER_KEY;
  /**
   * Describes what this adapter actually does today, not what the GoDaddy
   * API could theoretically support. `renewAuto` is parsed off the list
   * response but never surfaced anywhere (readAutoRenew: false); there is no
   * per-domain `GET /v1/domains/{domain}` details call (readDomainDetails:
   * false). `readNameservers: true` is genuinely earned: `nameServers`
   * really is fetched (`includes=nameServers`) and used to derive
   * `dnsHostedByProvider` below -- see that heuristic's own caveat.
   */
  readonly capabilities: ProviderCapabilities = {
    listDomains: true,
    manageAutoRenew: false,
    manageDnsRecords: false,
    readAutoRenew: false,
    readDnsRecords: false,
    readDomainDetails: false,
    readNameservers: true,
  };

  private readonly fetchImplementation: FetchImplementation;
  private readonly maxPages: number;
  private readonly pageSize: number;
  private readonly timeoutMs: number;

  constructor(options: GoDaddyAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(
      options.maxPages ?? GODADDY_DEFAULT_MAX_PAGES,
      1,
      GODADDY_DEFAULT_MAX_PAGES,
    );
    this.pageSize = validateBoundedInteger(
      options.pageSize ?? GODADDY_DEFAULT_PAGE_SIZE,
      GODADDY_MIN_PAGE_SIZE,
      GODADDY_MAX_PAGE_SIZE,
    );
    this.timeoutMs = validateBoundedInteger(
      options.timeoutMs ?? GODADDY_DEFAULT_TIMEOUT_MS,
      1,
      60_000,
    );
  }

  async validateToken(token: string): Promise<ProviderTokenValidation> {
    try {
      await this.requestJson({ limit: '1' }, token);
      return {
        expiresAt: null,
        notBefore: null,
        providerTokenId: 'godaddy-pat',
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
    let marker: string | undefined;
    let completedPages = 0;

    for (let page = 1; page <= this.maxPages; page += 1) {
      try {
        const query: Record<string, string> = {
          includes: 'nameServers',
          limit: String(this.pageSize),
        };
        if (marker !== undefined) query.marker = marker;

        const value = await this.requestJson(query, token);
        const parsed = domainListSchema.safeParse(value);
        if (!parsed.success) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }

        for (const entry of parsed.data) {
          const normalized = normalizeDomain(entry);
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

        if (parsed.data.length < this.pageSize) {
          return {
            completion: 'COMPLETE',
            domains: [...discovered.values()],
            error: null,
            externalResourceType: GODADDY_DOMAIN_RESOURCE_TYPE,
          };
        }
        const last = parsed.data.at(-1);
        if (!last) {
          throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
        }
        marker = last.domain;
      } catch (error) {
        if (completedPages === 0) throw error;
        return {
          completion: 'PARTIAL',
          domains: [...discovered.values()],
          error: safeProviderError(error),
          externalResourceType: GODADDY_DOMAIN_RESOURCE_TYPE,
        };
      }
    }

    return {
      completion: 'PARTIAL',
      domains: [...discovered.values()],
      error: { code: 'UPSTREAM_BAD_RESPONSE', retryAfterSeconds: null },
      externalResourceType: GODADDY_DOMAIN_RESOURCE_TYPE,
    };
  }

  private async requestJson(
    query: Readonly<Record<string, string>>,
    token: string,
  ): Promise<unknown> {
    this.assertToken(token);
    const url = new URL(GODADDY_DOMAINS_PATH, GODADDY_API_ORIGIN);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
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
        declaredLength > GODADDY_MAX_RESPONSE_BYTES
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
      if (Buffer.byteLength(text, 'utf8') > GODADDY_MAX_RESPONSE_BYTES) {
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
      token.length > GODADDY_MAX_TOKEN_LENGTH
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
          parseGoDaddyRetryAfter(response.headers.get('retry-after'), Date.now()),
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
