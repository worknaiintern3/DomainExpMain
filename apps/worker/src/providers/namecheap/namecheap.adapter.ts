import { Buffer } from 'node:buffer';

import {
  InvalidDomainNameError,
  normalizeDomainName,
} from '@domainpulse/database';
import { XMLParser } from 'fast-xml-parser';
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
  InvalidNamecheapCredentialError,
  NAMECHEAP_API_ORIGIN,
  NAMECHEAP_API_PATH,
  NAMECHEAP_DEFAULT_MAX_PAGES,
  NAMECHEAP_DEFAULT_PAGE_SIZE,
  NAMECHEAP_DEFAULT_TIMEOUT_MS,
  NAMECHEAP_DOMAIN_RESOURCE_TYPE,
  NAMECHEAP_GET_LIST_COMMAND,
  NAMECHEAP_MAX_PAGE_SIZE,
  NAMECHEAP_MAX_RESPONSE_BYTES,
  NAMECHEAP_MAX_RETRY_AFTER_SECONDS,
  NAMECHEAP_MIN_PAGE_SIZE,
  NAMECHEAP_PROVIDER_KEY,
  parseNamecheapCredential,
  type NamecheapCredential,
} from './namecheap.constants';

type FetchImplementation = typeof fetch;

const xmlParser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** Namecheap always returns HTTP 200; boolean XML attributes arrive as the literal strings "true"/"false". */
const xmlBoolean = z
  .union([z.literal('true'), z.literal('false')])
  .transform((value) => value === 'true');

const errorEntrySchema = z.object({
  '#text': z.string().optional(),
  '@_Number': z.union([z.string(), z.number()]).optional(),
});

const domainEntrySchema = z.object({
  '@_AutoRenew': xmlBoolean,
  '@_Expires': z.string().min(1),
  '@_ID': z.union([z.string(), z.number()]),
  '@_IsExpired': xmlBoolean,
  '@_IsOurDNS': xmlBoolean,
  '@_Name': z.string().min(1).max(253),
});

const pagingSchema = z.object({
  CurrentPage: z.union([z.string(), z.number()]),
  PageSize: z.union([z.string(), z.number()]),
  TotalItems: z.union([z.string(), z.number()]),
});

function asArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value as readonly T[];
  return [value as T];
}

function toInt(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseNamecheapRetryAfter(value: string | null, now: number): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds)
      ? Math.min(seconds, NAMECHEAP_MAX_RETRY_AFTER_SECONDS)
      : null;
  }
  const retryAt = Date.parse(trimmed);
  if (!Number.isFinite(retryAt)) return null;
  return Math.min(
    Math.max(0, Math.ceil((retryAt - now) / 1_000)),
    NAMECHEAP_MAX_RETRY_AFTER_SECONDS,
  );
}

/**
 * Namecheap communicates API-level failures through the XML body
 * (`ApiResponse Status="ERROR"` + `<Errors><Error Number="...">message</Error></Errors>`)
 * rather than HTTP status, unlike Cloudflare/GoDaddy. `Number` is Namecheap's
 * own stable, structured error code and is authoritative where a mapping is
 * documented/verified -- notably 1011105 ("Parameter ClientIP is invalid")
 * is genuinely a client-IP-not-authorized/PERMISSION_DENIED failure, NOT a
 * generic bad request, even though its message text alone would suggest
 * INVALID_REQUEST. Only when the numeric code is absent or unrecognized does
 * classification fall back to the documented, stable message substrings,
 * and only as a last resort to a safe generic code -- it never guesses a
 * more specific (and possibly wrong) canonical code from a vague message.
 */
const NAMECHEAP_NUMERIC_ERROR_CODES: Readonly<Record<string, ProviderAdapterError['code']>> = {
  // "API Key is invalid or API access has not been enabled": a truthful
  // statement about the credential itself.
  '1011102': 'AUTH_INVALID',
  // "Parameter ClientIP is invalid": the submitted ClientIp is not one of
  // the account's whitelisted addresses -- an authorization failure, not a
  // malformed request.
  '1011105': 'PERMISSION_DENIED',
  // "Too many requests".
  '500000': 'RATE_LIMITED',
};

function classifyByNumericCode(code: string | undefined): ProviderAdapterError['code'] | null {
  if (code === undefined) return null;
  const known = NAMECHEAP_NUMERIC_ERROR_CODES[code];
  if (known) return known;
  // Documented pattern (e.g. 1010104 "Parameter Command is missing"): the
  // 1010xxx range is Namecheap's generic missing/invalid-parameter family,
  // distinct from the 1011xxx access-control family above.
  if (/^1010\d{3}$/u.test(code)) return 'INVALID_REQUEST';
  return null;
}

function classifyNamecheapErrorMessage(message: string): ProviderAdapterError['code'] {
  const text = message.toLowerCase();
  if (text.includes('not whitelisted') || text.includes('is not registered')) {
    return 'PERMISSION_DENIED';
  }
  if (text.includes('api key is invalid') || text.includes('api access has not been enabled')) {
    return 'AUTH_INVALID';
  }
  if (text.includes('too many requests') || text.includes('rate limit')) {
    return 'RATE_LIMITED';
  }
  if (text.includes('parameter') && (text.includes('missing') || text.includes('invalid'))) {
    return 'INVALID_REQUEST';
  }
  return 'UNKNOWN_PROVIDER_ERROR';
}

function classifyNamecheapError(number: string | undefined, message: string): ProviderAdapterError {
  const code = classifyByNumericCode(number) ?? classifyNamecheapErrorMessage(message);
  return new ProviderAdapterError(code);
}

function normalizeDomain(
  entry: z.infer<typeof domainEntrySchema>,
): DiscoveredProviderDomain {
  try {
    return {
      canonicalDomain: normalizeDomainName(entry['@_Name']).normalizedDomainName,
      dnsHostedByProvider: entry['@_IsOurDNS'],
      externalResourceId: String(entry['@_ID']),
      // Lowercase to match the shared reconciler's canonical status format
      // (see CANONICAL_RESOURCE_TYPE in provider-domain-reconciliation.service.ts).
      providerStatus: entry['@_IsExpired'] ? 'expired' : 'active',
    };
  } catch (error) {
    if (error instanceof InvalidDomainNameError) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    throw error;
  }
}

export interface NamecheapAdapterOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly maxPages?: number;
  readonly pageSize?: number;
  readonly timeoutMs?: number;
}

export class NamecheapAdapter implements
  ProviderAdapter,
  ProviderTokenValidationCapability,
  DomainDiscoveryCapability
{
  readonly providerKey = NAMECHEAP_PROVIDER_KEY;
  /**
   * Describes what this adapter actually does today. `AutoRenew` is parsed
   * off getList but never surfaced (readAutoRenew: false); there is no
   * separate `domains.getInfo` call (readDomainDetails: false).
   * `readNameservers` stays false: `IsOurDNS` drives `dnsHostedByProvider`
   * below but is a pre-computed provider boolean, never a raw nameserver
   * value this adapter reads.
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
  private readonly maxPages: number;
  private readonly pageSize: number;
  private readonly timeoutMs: number;

  constructor(options: NamecheapAdapterOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxPages = validateBoundedInteger(
      options.maxPages ?? NAMECHEAP_DEFAULT_MAX_PAGES,
      1,
      NAMECHEAP_DEFAULT_MAX_PAGES,
    );
    this.pageSize = validateBoundedInteger(
      options.pageSize ?? NAMECHEAP_DEFAULT_PAGE_SIZE,
      NAMECHEAP_MIN_PAGE_SIZE,
      NAMECHEAP_MAX_PAGE_SIZE,
    );
    this.timeoutMs = validateBoundedInteger(
      options.timeoutMs ?? NAMECHEAP_DEFAULT_TIMEOUT_MS,
      1,
      60_000,
    );
  }

  /** `token` carries the JSON-encoded {apiUser, apiKey, userName, clientIp} credential (see namecheap.constants.ts). */
  async validateToken(token: string): Promise<ProviderTokenValidation> {
    try {
      const credential = this.parseCredential(token);
      await this.getListPage(credential, 1, NAMECHEAP_MIN_PAGE_SIZE);
      return {
        expiresAt: null,
        notBefore: null,
        providerTokenId: 'namecheap-api-credential',
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
    const credential = this.parseCredential(token);
    const discovered = new Map<string, DiscoveredProviderDomain>();
    let completedPages = 0;
    let itemsSeenAcrossPages = 0;

    for (let page = 1; page <= this.maxPages; page += 1) {
      try {
        const { domains, paging } = await this.getListPage(credential, page, this.pageSize);
        for (const entry of domains) {
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
        itemsSeenAcrossPages += domains.length;

        // Uses the actual count of items received (not page * requested
        // page size) so a server-side page-size cap never causes premature
        // or missed termination.
        if (domains.length === 0 || itemsSeenAcrossPages >= paging.totalItems) {
          return {
            completion: 'COMPLETE',
            domains: [...discovered.values()],
            error: null,
            externalResourceType: NAMECHEAP_DOMAIN_RESOURCE_TYPE,
          };
        }
      } catch (error) {
        if (completedPages === 0) throw error;
        return {
          completion: 'PARTIAL',
          domains: [...discovered.values()],
          error: safeProviderError(error),
          externalResourceType: NAMECHEAP_DOMAIN_RESOURCE_TYPE,
        };
      }
    }

    return {
      completion: 'PARTIAL',
      domains: [...discovered.values()],
      error: { code: 'UPSTREAM_BAD_RESPONSE', retryAfterSeconds: null },
      externalResourceType: NAMECHEAP_DOMAIN_RESOURCE_TYPE,
    };
  }

  private parseCredential(token: string): NamecheapCredential {
    try {
      return parseNamecheapCredential(token);
    } catch (error) {
      if (error instanceof InvalidNamecheapCredentialError) {
        throw new ProviderAdapterError('INVALID_REQUEST');
      }
      throw error;
    }
  }

  private async getListPage(
    credential: NamecheapCredential,
    page: number,
    pageSize: number,
  ): Promise<{
    readonly domains: readonly z.infer<typeof domainEntrySchema>[];
    readonly paging: { readonly pageSize: number; readonly totalItems: number };
  }> {
    const url = new URL(NAMECHEAP_API_PATH, NAMECHEAP_API_ORIGIN);
    url.searchParams.set('ApiUser', credential.apiUser);
    url.searchParams.set('ApiKey', credential.apiKey);
    url.searchParams.set('UserName', credential.userName);
    url.searchParams.set('ClientIp', credential.clientIp);
    url.searchParams.set('Command', NAMECHEAP_GET_LIST_COMMAND);
    url.searchParams.set('Page', String(page));
    url.searchParams.set('PageSize', String(pageSize));

    const body = await this.requestXml(url);

    const root = body?.ApiResponse as Record<string, unknown> | undefined;
    if (!root || typeof root !== 'object') {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    const status = root['@_Status'];
    if (status !== 'OK' && status !== 'ERROR') {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    if (status === 'ERROR') {
      const errors = asArray(
        (root.Errors as { Error?: unknown } | undefined)?.Error,
      );
      const first = errorEntrySchema.safeParse(errors[0]);
      throw classifyNamecheapError(
        first.success ? String(first.data['@_Number'] ?? '') || undefined : undefined,
        first.success ? (first.data['#text'] ?? '') : '',
      );
    }

    const commandResponse = root.CommandResponse as Record<string, unknown> | undefined;
    if (!commandResponse || typeof commandResponse !== 'object') {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    const listResult = commandResponse.DomainGetListResult as
      | { Domain?: unknown }
      | undefined;
    const rawDomains = asArray(listResult?.Domain);
    const domains: z.infer<typeof domainEntrySchema>[] = [];
    for (const raw of rawDomains) {
      const parsed = domainEntrySchema.safeParse(raw);
      if (!parsed.success) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      domains.push(parsed.data);
    }

    const paging = pagingSchema.safeParse(commandResponse.Paging);
    if (!paging.success) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    const totalItems = toInt(paging.data.TotalItems);
    const responsePageSize = toInt(paging.data.PageSize);
    if (!Number.isFinite(totalItems) || !Number.isFinite(responsePageSize) || responsePageSize <= 0) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }

    return { domains, paging: { pageSize: responsePageSize, totalItems } };
  }

  private async requestXml(url: URL): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
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
        declaredLength > NAMECHEAP_MAX_RESPONSE_BYTES
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
      if (Buffer.byteLength(text, 'utf8') > NAMECHEAP_MAX_RESPONSE_BYTES) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      try {
        return xmlParser.parse(text) as Record<string, unknown>;
      } catch {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
    } finally {
      clearTimeout(timeout);
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
          parseNamecheapRetryAfter(response.headers.get('retry-after'), Date.now()),
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
