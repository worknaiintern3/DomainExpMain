/**
 * Live WHOIS / DNS / TLS lookup client.
 *
 * Backend endpoints (public, no Google account required):
 *   GET /whois/live?domain=&domainId=
 *   GET /whois/dns?domain=
 *   GET /whois/ssl?domain=
 *
 * The stored metadata endpoints under /domains/:id/metadata remain the
 * source of truth for persisted snapshots; these calls are live lookups.
 */

import { apiRequest } from './client';
import type { NormalizedWhoisData } from './whois.types';

export interface WhoisContact {
  name?: string;
  company?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country_name?: string;
  country_code?: string;
  email_address?: string;
  phone_number?: string;
}

export interface LiveWhoisData {
  id: string | null;
  domainName: string;
  isRegistered: boolean;
  queryTime: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  updatedDate: string | null;
  daysRemaining: number | null;
  registrar: {
    name: string | null;
    ianaId: string | null;
    websiteUrl: string | null;
    email: string | null;
    phone: string | null;
  };
  registrant: WhoisContact | null;
  technicalContact: WhoisContact | null;
  administrativeContact: WhoisContact | null;
  nameservers: string[];
  statuses: string[];
  rawWhois: string | null;
  savedToDatabase: boolean;
  retrievedAt: string;
}

export interface LiveDnsRecord {
  name: string;
  type?: number;
  dnsType: string;
  ttl?: number;
  rawText?: string;
  rRsetType?: number;
  address?: string;
  singleName?: string;
  target?: string;
  exchange?: string;
  priority?: number;
  weight?: number;
  port?: number;
  text?: string;
  admin?: string;
  hostmaster?: string;
  serial?: number;
  refresh?: number;
  retry?: number;
  expire?: number;
  minimumTtl?: number;
}

export interface LiveDnsData {
  domainName: string;
  queryTime?: string;
  dnsTypes?: Record<string, number>;
  dnsRecords?: LiveDnsRecord[];
  status?: boolean;
  message?: string;
}

export interface LiveSslCertificate {
  chainOrder?: string;
  authenticationType?: string;
  validityStartDate?: string;
  validityEndDate?: string;
  serialNumber?: string;
  signatureAlgorithm?: string;
  issuer?: Record<string, string>;
  subject?: Record<string, string>;
  publicKey?: {
    keySize?: string;
    keyAlgorithm?: string;
  };
  extensions?: {
    subjectAlternativeNames?: {
      dnsNames?: string[];
    };
  };
}

export interface LiveSslData {
  domainName: string;
  queryTime?: string;
  sslCertificates?: LiveSslCertificate[];
  status?: boolean;
  message?: string;
}

export interface HistoricalWhoisRecord {
  num?: number;
  domain_name?: string;
  query_time?: string;
  create_date?: string;
  expiry_date?: string;
  update_date?: string;
  domain_registrar?: { registrar_name?: string; normalized_name?: string };
  name_servers?: string[];
  domain_status?: string[];
  raw_whois?: string;
}

export interface HistoricalWhoisData {
  status?: boolean;
  total_records?: string;
  whois_domains_historical?: HistoricalWhoisRecord[];
  message?: string;
}

export interface WhoisAvailabilityItem {
  domain: string;
  tld: string;
  available: boolean;
  nameservers: string[];
}

const FALLBACK_API_KEY =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.['VITE_WHOISFREAKS_API_KEY'] ||
  '4f9a91ff1ccb4ebfb2cd35d06becc1c1';

function getWhoisFreaksBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return 'https://api.whoisfreaks.com';
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return '/whoisfreaks-api';
  }
  return 'https://api.whoisfreaks.com';
}

function calculateDaysRemaining(expiryStr?: string | null): number | null {
  if (!expiryStr) return null;
  const expiry = new Date(expiryStr).getTime();
  if (isNaN(expiry)) return null;
  return Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
}

function normalizeRawWhoisResponse(domain: string, raw: any): NormalizedWhoisData {
  const isRegistered = raw.domain_registered === 'yes' || raw.domain_registered === 'true' || Boolean(raw.expiry_date);
  const regData = raw.registry_data || {};
  const effectiveRegistrar = raw.domain_registrar || regData.domain_registrar;

  let regName = effectiveRegistrar?.registrar_name || null;
  if (!regName) {
    const rawText = raw.whois_raw_domain || regData.whois_raw_registery || '';
    const match = rawText.match(/Registrar:\s*([^\r\n]+)/i);
    if (match && match[1]) {
      regName = match[1].trim();
    }
  }

  const rawCreate = raw.create_date || regData.create_date || null;
  const rawExpiry = raw.expiry_date || regData.expiry_date || null;
  const rawUpdate = raw.update_date || regData.update_date || null;
  const daysRemaining = calculateDaysRemaining(rawExpiry);
  const nameservers = (raw.name_servers && raw.name_servers.length > 0)
    ? raw.name_servers
    : (regData.name_servers || []);

  return {
    id: null,
    domainName: raw.domain_name || domain,
    isRegistered,
    queryTime: raw.query_time || regData.query_time || new Date().toISOString(),
    registeredAt: rawCreate,
    expiresAt: rawExpiry,
    updatedDate: rawUpdate,
    daysRemaining,
    registrar: {
      name: regName,
      ianaId: effectiveRegistrar?.iana_id || null,
      websiteUrl: effectiveRegistrar?.website_url || null,
      email: effectiveRegistrar?.email_address || null,
      phone: effectiveRegistrar?.phone_number || null,
    },
    registrant: raw.registrant_contact || regData.registrant_contact || null,
    technicalContact: raw.technical_contact || regData.technical_contact || null,
    administrativeContact: raw.administrative_contact || regData.administrative_contact || null,
    nameservers,
    statuses: (raw.domain_status && raw.domain_status.length > 0)
      ? raw.domain_status
      : (regData.domain_status || []),
    rawWhois: raw.whois_raw_domain || regData.whois_raw_registery || null,
    rawResponse: raw,
    savedToDatabase: false,
    retrievedAt: new Date().toISOString(),
  };
}

function mapRawToLiveWhoisData(domain: string, raw: any): LiveWhoisData {
  const norm = normalizeRawWhoisResponse(domain, raw);
  return {
    id: norm.id,
    domainName: norm.domainName,
    isRegistered: norm.isRegistered,
    queryTime: norm.queryTime,
    registeredAt: norm.registeredAt,
    expiresAt: norm.expiresAt,
    updatedDate: norm.updatedDate,
    daysRemaining: norm.daysRemaining,
    registrar: norm.registrar,
    registrant: norm.registrant,
    technicalContact: norm.technicalContact,
    administrativeContact: norm.administrativeContact,
    nameservers: norm.nameservers,
    statuses: norm.statuses,
    rawWhois: norm.rawWhois,
    savedToDatabase: norm.savedToDatabase,
    retrievedAt: norm.retrievedAt,
  };
}

export async function getLiveWhois(
  domain: string,
  domainId?: string,
  signal?: AbortSignal,
): Promise<LiveWhoisData> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  try {
    const baseUrl = getWhoisFreaksBaseUrl();
    const url = `${baseUrl}/v1.0/whois?apiKey=${encodeURIComponent(FALLBACK_API_KEY)}&whois=live&domainName=${encodeURIComponent(clean)}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const json = await res.json();
      if (json && (json.status === true || json.domain_name)) {
        return mapRawToLiveWhoisData(clean, json);
      }
    }
  } catch (err) {
    console.warn('Direct WhoisFreaks live query failed, falling back to backend:', err);
  }
  const search = new URLSearchParams({ domain: clean });
  if (domainId) search.set('domainId', domainId);
  return apiRequest(`/whois/live?${search}`, { signal });
}

export async function getLiveDns(
  domain: string,
  signal?: AbortSignal,
): Promise<LiveDnsData> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  try {
    const baseUrl = getWhoisFreaksBaseUrl();
    const url = `${baseUrl}/v1.0/dns/live?apiKey=${encodeURIComponent(FALLBACK_API_KEY)}&type=all&domainName=${encodeURIComponent(clean)}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const json = await res.json();
      return json as LiveDnsData;
    }
  } catch (err) {
    console.warn('Direct WhoisFreaks DNS query failed, falling back to backend:', err);
  }
  const search = new URLSearchParams({ domain: clean });
  return apiRequest(`/whois/dns?${search}`, { signal });
}

export async function getLiveSsl(
  domain: string,
  signal?: AbortSignal,
): Promise<LiveSslData> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  try {
    const baseUrl = getWhoisFreaksBaseUrl();
    const url = `${baseUrl}/v1.0/ssl/live?apiKey=${encodeURIComponent(FALLBACK_API_KEY)}&domainName=${encodeURIComponent(clean)}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const json = await res.json();
      return json as LiveSslData;
    }
  } catch (err) {
    console.warn('Direct WhoisFreaks SSL query failed, falling back to backend:', err);
  }
  const search = new URLSearchParams({ domain: clean });
  return apiRequest(`/whois/ssl?${search}`, { signal });
}

export async function getHistoricalWhois(domain: string, signal?: AbortSignal): Promise<HistoricalWhoisData> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  try {
    const baseUrl = getWhoisFreaksBaseUrl();
    const url = `${baseUrl}/v1.0/whois?apiKey=${encodeURIComponent(FALLBACK_API_KEY)}&whois=historical&domainName=${encodeURIComponent(clean)}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const json = await res.json();
      return json as HistoricalWhoisData;
    }
  } catch (err) {
    console.warn('Direct WhoisFreaks Historical query failed, falling back to backend:', err);
  }
  return apiRequest(`/whois/historical?${new URLSearchParams({ domain: clean })}`, { signal });
}

export async function checkWhoisAvailability(
  query: string,
  tlds: readonly string[],
  signal?: AbortSignal,
): Promise<WhoisAvailabilityItem[]> {
  const clean = query.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').split('.')[0];
  try {
    const baseUrl = getWhoisFreaksBaseUrl();
    const checks = await Promise.allSettled(
      tlds.map(async (tld) => {
        const fullDomain = `${clean}${tld.startsWith('.') ? tld : `.${tld}`}`;
        const url = `${baseUrl}/v1.0/domain/availability?apiKey=${encodeURIComponent(FALLBACK_API_KEY)}&domain=${encodeURIComponent(fullDomain)}`;
        const res = await fetch(url, { signal });
        if (res.ok) {
          const data = await res.json();
          return {
            domain: fullDomain,
            tld,
            available: Boolean(data.domainAvailability),
            nameservers: [],
          };
        }
        throw new Error('Not available via WhoisFreaks');
      })
    );
    const results: WhoisAvailabilityItem[] = [];
    checks.forEach((c) => {
      if (c.status === 'fulfilled') {
        results.push(c.value);
      }
    });
    if (results.length === tlds.length) {
      return results;
    }
  } catch (err) {
    console.warn('Direct WhoisFreaks Availability query failed, falling back to backend:', err);
  }
  return apiRequest(`/whois/availability?${new URLSearchParams({ query: clean, tlds: tlds.join(',') })}`, { signal });
}

export function getWhoisHistory(limit = 20, signal?: AbortSignal): Promise<LiveWhoisData[]> {
  return apiRequest(`/whois/history?${new URLSearchParams({ limit: String(limit) })}`, { signal });
}

export function refreshWhois(domainId: string): Promise<LiveWhoisData> {
  return apiRequest(`/whois/${encodeURIComponent(domainId)}/refresh`, { method: 'POST' });
}

const WHOIS_CACHE = new Map<string, { data: NormalizedWhoisData; timestamp: number }>();
const WHOIS_INFLIGHT = new Map<string, Promise<NormalizedWhoisData>>();
const WHOIS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export async function getSavedWhois(
  domain: string,
  signal?: AbortSignal,
): Promise<NormalizedWhoisData | null> {
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  try {
    return await apiRequest<NormalizedWhoisData>(`/whois/record?domain=${encodeURIComponent(cleanDomain)}`, {
      signal,
      authenticated: false,
    });
  } catch {
    return null;
  }
}

export async function lookupWhois(
  domain: string,
  domainId?: string,
  signal?: AbortSignal,
  options?: { forceRefresh?: boolean },
): Promise<NormalizedWhoisData> {
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  if (!options?.forceRefresh) {
    const cached = WHOIS_CACHE.get(cleanDomain);
    if (cached && Date.now() - cached.timestamp < WHOIS_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  if (WHOIS_INFLIGHT.has(cleanDomain)) {
    return WHOIS_INFLIGHT.get(cleanDomain)!;
  }

  const promise = (async () => {
    // 1. PRIMARY PATH: Direct live query to WhoisFreaks via configured base URL
    try {
      const baseUrl = getWhoisFreaksBaseUrl();
      const wfUrl = `${baseUrl}/v1.0/whois?apiKey=${encodeURIComponent(FALLBACK_API_KEY)}&whois=live&domainName=${encodeURIComponent(cleanDomain)}`;
      const response = await fetch(wfUrl, { signal });
      if (response.ok) {
        const json = await response.json();
        if (json && (json.status === true || json.domain_name)) {
          const normalized = normalizeRawWhoisResponse(cleanDomain, json);
          WHOIS_CACHE.set(cleanDomain, { data: normalized, timestamp: Date.now() });

          // Also asynchronously sync to backend so the database and workspace cache are updated
          void apiRequest<NormalizedWhoisData>(`/whois/live?domain=${encodeURIComponent(cleanDomain)}${domainId ? `&domainId=${domainId}` : ''}`, {
            authenticated: false,
          }).catch(() => {});

          return normalized;
        }
      }
    } catch (wfErr) {
      console.warn('WhoisFreaks query via proxy failed, trying backend / direct:', wfErr);
    }

    // 2. Direct public API query (WhoisFreaks supports wildcard CORS)
    try {
      const directWfUrl = `https://api.whoisfreaks.com/v1.0/whois?apiKey=${encodeURIComponent(FALLBACK_API_KEY)}&whois=live&domainName=${encodeURIComponent(cleanDomain)}`;
      const directRes = await fetch(directWfUrl, { signal });
      if (directRes.ok) {
        const json = await directRes.json();
        if (json && (json.status === true || json.domain_name)) {
          const normalized = normalizeRawWhoisResponse(cleanDomain, json);
          WHOIS_CACHE.set(cleanDomain, { data: normalized, timestamp: Date.now() });
          return normalized;
        }
      }
    } catch (directErr) {
      console.warn('Direct WhoisFreaks query failed, trying backend:', directErr);
    }

    // 3. Secondary path: Query backend /whois/live
    try {
      const queryParams = new URLSearchParams({ domain: cleanDomain });
      if (domainId) queryParams.set('domainId', domainId);
      
      const res = await apiRequest<NormalizedWhoisData>(`/whois/live?${queryParams.toString()}`, {
        signal,
        authenticated: false,
      });
      if (res) {
        WHOIS_CACHE.set(cleanDomain, { data: res, timestamp: Date.now() });
        return res;
      }
    } catch {}

    // Return cached if available, else throw
    const stale = WHOIS_CACHE.get(cleanDomain);
    if (stale) return stale.data;
    throw new Error(`Unable to fetch live WHOIS for ${cleanDomain}`);
  })().finally(() => {
    WHOIS_INFLIGHT.delete(cleanDomain);
  });

  WHOIS_INFLIGHT.set(cleanDomain, promise);
  return promise;
}

export async function refreshDomainWhois(
  domainId: string,
  signal?: AbortSignal,
): Promise<NormalizedWhoisData> {
  return apiRequest<NormalizedWhoisData>(`/whois/${encodeURIComponent(domainId)}/refresh`, {
    method: 'POST',
    signal,
  });
}
