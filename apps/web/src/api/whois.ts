import { apiRequest } from './client';
import type { NormalizedWhoisData } from './whois.types';

const FALLBACK_API_KEY = 'ce2619a4ee0e49799a05b15e731ce193';

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

export async function lookupWhois(
  domain: string,
  domainId?: string,
  signal?: AbortSignal,
): Promise<NormalizedWhoisData> {
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  // 1. Primary path: Use backend API which automatically persists to Postgres database
  try {
    const queryParams = new URLSearchParams({ domain: cleanDomain });
    if (domainId) queryParams.set('domainId', domainId);
    
    return await apiRequest<NormalizedWhoisData>(`/whois/live?${queryParams.toString()}`, {
      signal,
      authenticated: false, // Allows public or authenticated requests
    });
  } catch (apiError) {
    // 2. Fallback: If backend is busy/restarting, use direct Vite proxy to WhoisFreaks
    try {
      const proxyUrl = `/whoisfreaks-api/v2.0/whois/live?apiKey=${FALLBACK_API_KEY}&domainName=${encodeURIComponent(
        cleanDomain,
      )}&format=json`;
      const response = await fetch(proxyUrl, { signal });
      if (response.ok) {
        const json = await response.json();
        return normalizeRawWhoisResponse(cleanDomain, json);
      }
    } catch {
      // Fallback failed too, re-throw primary error
    }
    throw apiError;
  }
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
