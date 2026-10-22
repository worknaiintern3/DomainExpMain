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
