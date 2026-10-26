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

export function getLiveWhois(
  domain: string,
  domainId?: string,
  signal?: AbortSignal,
): Promise<LiveWhoisData> {
  const search = new URLSearchParams({ domain });
  if (domainId) search.set('domainId', domainId);
  return apiRequest(`/whois/live?${search}`, { signal });
}

export function getLiveDns(
  domain: string,
  signal?: AbortSignal,
): Promise<LiveDnsData> {
  const search = new URLSearchParams({ domain });
  return apiRequest(`/whois/dns?${search}`, { signal });
}

export function getLiveSsl(
  domain: string,
  signal?: AbortSignal,
): Promise<LiveSslData> {
  const search = new URLSearchParams({ domain });
  return apiRequest(`/whois/ssl?${search}`, { signal });
}

export function getHistoricalWhois(domain: string, signal?: AbortSignal): Promise<HistoricalWhoisData> {
  return apiRequest(`/whois/historical?${new URLSearchParams({ domain })}`, { signal });
}

export function checkWhoisAvailability(
  query: string,
  tlds: readonly string[],
  signal?: AbortSignal,
): Promise<WhoisAvailabilityItem[]> {
  return apiRequest(`/whois/availability?${new URLSearchParams({ query, tlds: tlds.join(',') })}`, { signal });
}

export function getWhoisHistory(limit = 20, signal?: AbortSignal): Promise<LiveWhoisData[]> {
  return apiRequest(`/whois/history?${new URLSearchParams({ limit: String(limit) })}`, { signal });
}

export function refreshWhois(domainId: string): Promise<LiveWhoisData> {
  return apiRequest(`/whois/${encodeURIComponent(domainId)}/refresh`, { method: 'POST' });
}

const FALLBACK_API_KEY =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.['VITE_WHOISFREAKS_API_KEY'] ||
  'aa02fd191f444368a77d343ecf4c2994';

const WHOIS_CACHE = new Map<string, { data: NormalizedWhoisData; timestamp: number }>();
const WHOIS_INFLIGHT = new Map<string, Promise<NormalizedWhoisData>>();
const WHOIS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

function calculateDaysRemaining(expiryStr?: string | null): number | null {
  if (!expiryStr) return null;
  const expiry = new Date(expiryStr).getTime();
  if (isNaN(expiry)) return null;
  return Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
}

function normalizeRawWhoisResponse(domain: string, raw: any): NormalizedWhoisData {
  const isRegistered = raw.domain_registered === 'yes';
  const daysRemaining = calculateDaysRemaining(raw.expiry_date);

  return {
    id: null,
    domainName: raw.domain_name || domain,
    isRegistered,
    queryTime: raw.query_time || new Date().toISOString(),
    registeredAt: raw.create_date || null,
    expiresAt: raw.expiry_date || null,
    updatedDate: raw.update_date || null,
    daysRemaining,
    registrar: {
      name: raw.domain_registrar?.registrar_name || null,
      ianaId: raw.domain_registrar?.iana_id || null,
      websiteUrl: raw.domain_registrar?.website_url || null,
      email: raw.domain_registrar?.email_address || null,
      phone: raw.domain_registrar?.phone_number || null,
    },
    registrant: raw.registrant_contact || null,
    technicalContact: raw.technical_contact || null,
    administrativeContact: raw.administrative_contact || null,
    nameservers: raw.name_servers || [],
    statuses: raw.domain_status || [],
    rawWhois: raw.whois_raw_domain || null,
    rawResponse: raw,
    savedToDatabase: false,
    retrievedAt: new Date().toISOString(),
  };
}

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
    // 1. Primary path: Use backend API which automatically persists to database
    try {
      const queryParams = new URLSearchParams({ domain: cleanDomain });
      if (domainId) queryParams.set('domainId', domainId);
      
      const res = await apiRequest<NormalizedWhoisData>(`/whois/live?${queryParams.toString()}`, {
        signal,
        authenticated: true,
      });
      if (res) {
        WHOIS_CACHE.set(cleanDomain, { data: res, timestamp: Date.now() });
        return res;
      }
    } catch {
      // 2. Fallback: If backend is busy/restarting, use direct Vite proxy to WhoisFreaks
      try {
        const proxyUrl = `/whoisfreaks-api/v2.0/whois/live?apiKey=${encodeURIComponent(FALLBACK_API_KEY)}&domainName=${encodeURIComponent(
          cleanDomain,
        )}&format=json`;
        const response = await fetch(proxyUrl, { signal });
        if (response.ok) {
          const json = await response.json();
          const normalized = normalizeRawWhoisResponse(cleanDomain, json);
          WHOIS_CACHE.set(cleanDomain, { data: normalized, timestamp: Date.now() });
          return normalized;
        }
      } catch {
        // Fallback failed too
      }
    }

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
