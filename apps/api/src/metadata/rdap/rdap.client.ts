import { domainToASCII } from 'node:url';

import type { HostLookup } from '../network/public-network';
import {
  assertSafeHttpsUrl,
  systemHostLookup,
  UnsafeNetworkTargetError,
} from '../network/public-network';
import { RdapRetrievalError, type RdapErrorCode } from './rdap.errors';
import type { RdapRetrieval, RdapSnapshot } from './rdap.types';

const IANA_DNS_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;

type FetchImplementation = typeof fetch;

interface BootstrapCache {
  expiresAt: number;
  services: ReadonlyMap<string, readonly string[]>;
}

export interface RdapClientOptions {
  readonly bootstrapCacheTtlMs?: number;
  readonly fetchImplementation?: FetchImplementation;
  readonly hostLookup?: HostLookup;
  readonly maxRedirects?: number;
  readonly maxResponseBytes?: number;
  readonly now?: () => number;
  readonly timeoutMs?: number;
}

interface JsonFetchResult {
  readonly body: unknown;
  readonly finalUrl: string;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function nonBlankString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizedStrings(values: unknown, normalize: (value: string) => string): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.flatMap((value) => {
    const stringValue = nonBlankString(value);
    return stringValue ? [normalize(stringValue)] : [];
  }))].sort();
}

function parseBootstrap(value: unknown): ReadonlyMap<string, readonly string[]> {
  const servicesValue = objectValue(value)?.services;
  if (!Array.isArray(servicesValue)) throw new RdapRetrievalError('RDAP_BOOTSTRAP_INVALID');
  const services = new Map<string, readonly string[]>();
  for (const service of servicesValue) {
    if (!Array.isArray(service) || service.length !== 2) continue;
    const tlds = normalizedStrings(service[0], (item) => item.toLowerCase());
    const urls = normalizedStrings(service[1], (item) => item);
    if (urls.length === 0) continue;
    for (const tld of tlds) services.set(tld, urls);
  }
  if (services.size === 0) throw new RdapRetrievalError('RDAP_BOOTSTRAP_INVALID');
  return services;
}

function vcardName(entity: Record<string, unknown>): string | null {
  const vcard = entity.vcardArray;
  if (!Array.isArray(vcard) || !Array.isArray(vcard[1])) return null;
  for (const property of vcard[1]) {
    if (!Array.isArray(property) || property[0] !== 'fn') continue;
    return nonBlankString(property[3]) ?? null;
  }
  return null;
}

function registrarFields(body: Record<string, unknown>): {
  registrarIanaId: string | null;
  registrarName: string | null;
} {
  if (!Array.isArray(body.entities)) return { registrarIanaId: null, registrarName: null };
  for (const entityValue of body.entities) {
    const entity = objectValue(entityValue);
    if (!entity || !Array.isArray(entity.roles) || !entity.roles.includes('registrar')) continue;
    let registrarIanaId: string | null = null;
    if (Array.isArray(entity.publicIds)) {
      for (const publicIdValue of entity.publicIds) {
        const publicId = objectValue(publicIdValue);
        if (nonBlankString(publicId?.type)?.toLowerCase() === 'iana registrar id') {
          registrarIanaId = nonBlankString(publicId?.identifier) ?? null;
          break;
        }
      }
    }
    return {
      registrarIanaId,
      registrarName: vcardName(entity) ?? nonBlankString(entity.handle) ?? null,
    };
  }
  return { registrarIanaId: null, registrarName: null };
}

export function normalizeRdapResponse(value: unknown, sourceUrl: string): RdapSnapshot {
  const body = objectValue(value);
  if (!body) throw new RdapRetrievalError('RDAP_RESPONSE_INVALID');
  const events = Array.isArray(body.events) ? body.events.flatMap((eventValue) => {
    const event = objectValue(eventValue);
    const action = nonBlankString(event?.eventAction)?.toLowerCase();
    const date = parseDate(event?.eventDate);
    return action && date ? [{ action, date }] : [];
  }) : [];
  const eventDate = (...actions: readonly string[]): Date | null =>
    events.find((event) => actions.includes(event.action))?.date ?? null;
  const nameservers = Array.isArray(body.nameservers)
    ? [...new Set(body.nameservers.flatMap((nameserverValue) => {
      const nameserver = objectValue(nameserverValue);
      const name = nonBlankString(nameserver?.ldhName) ?? nonBlankString(nameserver?.unicodeName);
      return name ? [name.toLowerCase().replace(/\.$/u, '')] : [];
    }))].sort()
    : [];
  const secureDns = objectValue(body.secureDNS);
  const delegationSigned = secureDns?.delegationSigned;
  const registrar = registrarFields(body);
  return {
    changedAt: eventDate('last changed', 'last update of rdap database', 'last update'),
    expiresAt: eventDate('expiration'),
    nameservers,
    registeredAt: eventDate('registration'),
    ...registrar,
    secureDnsDelegationSigned: typeof delegationSigned === 'boolean' ? delegationSigned : null,
    sourceUrl,
    statuses: normalizedStrings(body.status, (status) => status.toLowerCase()),
  };
}

function normalizedDomain(domain: string): string {
  const ascii = domainToASCII(domain.trim().replace(/\.$/u, '')).toLowerCase();
  if (
    ascii.length === 0
    || ascii.length > 253
    || !ascii.includes('.')
    || ascii.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
  ) {
    throw new RdapRetrievalError('RDAP_INVALID_DOMAIN');
  }
  return ascii;
}

export class RdapClient {
  private readonly cacheTtlMs: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly hostLookup: HostLookup;
  private readonly maxRedirects: number;
  private readonly maxResponseBytes: number;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private bootstrapCache: BootstrapCache | null = null;

  constructor(options: RdapClientOptions = {}) {
    this.cacheTtlMs = options.bootstrapCacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.hostLookup = options.hostLookup ?? systemHostLookup;
    this.maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async retrieve(domainInput: string): Promise<RdapRetrieval> {
    const domain = normalizedDomain(domainInput);
    const tld = domain.slice(domain.lastIndexOf('.') + 1);
    const services = await this.bootstrapServices();
    const serviceUrl = services.get(tld)?.[0];
    if (!serviceUrl) throw new RdapRetrievalError('RDAP_TLD_UNSUPPORTED');
    let lookupUrl: URL;
    try {
      lookupUrl = new URL(`domain/${encodeURIComponent(domain)}`, serviceUrl.endsWith('/') ? serviceUrl : `${serviceUrl}/`);
    } catch {
      throw new RdapRetrievalError('RDAP_BOOTSTRAP_INVALID');
    }
    const response = await this.fetchJson(lookupUrl, 'lookup');
    return { snapshot: normalizeRdapResponse(response.body, response.finalUrl) };
  }

  private async bootstrapServices(): Promise<ReadonlyMap<string, readonly string[]>> {
    if (this.bootstrapCache && this.bootstrapCache.expiresAt > this.now()) {
      return this.bootstrapCache.services;
    }
    const result = await this.fetchJson(new URL(IANA_DNS_BOOTSTRAP_URL), 'bootstrap');
    const services = parseBootstrap(result.body);
    this.bootstrapCache = { expiresAt: this.now() + this.cacheTtlMs, services };
    return services;
  }

  private async fetchJson(url: URL, stage: 'bootstrap' | 'lookup'): Promise<JsonFetchResult> {
    let currentUrl = url;
    for (let redirects = 0; redirects <= this.maxRedirects; redirects += 1) {
      try {
        await assertSafeHttpsUrl(currentUrl, this.hostLookup);
      } catch (error) {
        if (error instanceof UnsafeNetworkTargetError) {
          throw new RdapRetrievalError('RDAP_UNSAFE_URL');
        }
        throw new RdapRetrievalError(stage === 'bootstrap' ? 'RDAP_BOOTSTRAP_NETWORK_ERROR' : 'RDAP_LOOKUP_NETWORK_ERROR');
      }
      let response: Response;
      try {
        response = await this.fetchImplementation(currentUrl, {
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
        throw new RdapRetrievalError(timedOut
          ? stage === 'bootstrap' ? 'RDAP_BOOTSTRAP_TIMEOUT' : 'RDAP_LOOKUP_TIMEOUT'
          : stage === 'bootstrap' ? 'RDAP_BOOTSTRAP_NETWORK_ERROR' : 'RDAP_LOOKUP_NETWORK_ERROR');
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects === this.maxRedirects) throw new RdapRetrievalError('RDAP_TOO_MANY_REDIRECTS');
        const location = response.headers.get('location');
        if (!location) throw new RdapRetrievalError(stage === 'bootstrap' ? 'RDAP_BOOTSTRAP_HTTP_ERROR' : 'RDAP_LOOKUP_HTTP_ERROR');
        try {
          currentUrl = new URL(location, currentUrl);
        } catch {
          throw new RdapRetrievalError('RDAP_UNSAFE_URL');
        }
        continue;
      }
      if (!response.ok) {
        const code: RdapErrorCode = stage === 'lookup' && response.status === 404
          ? 'RDAP_LOOKUP_NOT_FOUND'
          : stage === 'bootstrap' ? 'RDAP_BOOTSTRAP_HTTP_ERROR' : 'RDAP_LOOKUP_HTTP_ERROR';
        throw new RdapRetrievalError(code);
      }
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) {
        throw new RdapRetrievalError('RDAP_RESPONSE_TOO_LARGE');
      }
      const reader = response.body?.getReader() as unknown as ReadableStreamDefaultReader<Uint8Array> | undefined;
      if (!reader) throw new RdapRetrievalError(stage === 'bootstrap' ? 'RDAP_BOOTSTRAP_INVALID' : 'RDAP_RESPONSE_INVALID');
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        totalBytes += result.value.byteLength;
        if (totalBytes > this.maxResponseBytes) {
          await reader.cancel();
          throw new RdapRetrievalError('RDAP_RESPONSE_TOO_LARGE');
        }
        chunks.push(result.value);
      }
      const bytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      try {
        return { body: JSON.parse(new TextDecoder().decode(bytes)) as unknown, finalUrl: currentUrl.toString() };
      } catch {
        throw new RdapRetrievalError(stage === 'bootstrap' ? 'RDAP_BOOTSTRAP_INVALID' : 'RDAP_RESPONSE_INVALID');
      }
    }
    throw new RdapRetrievalError('RDAP_TOO_MANY_REDIRECTS');
  }
}
