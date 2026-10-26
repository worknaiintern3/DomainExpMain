import { apiRequest } from './client';
import type { NormalizedWhoisData } from './whois.types';

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

export async function getWhoisHistory(
  limit = 20,
  signal?: AbortSignal,
): Promise<NormalizedWhoisData[]> {
  return apiRequest<NormalizedWhoisData[]>(`/whois/history?limit=${limit}`, { signal });
}
