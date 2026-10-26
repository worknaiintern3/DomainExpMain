import { apiGet, apiPost, apiDelete } from './api';
import { getUserItem, setUserItem, STORAGE_KEYS, saveProviderToken, getProviderToken } from './storage';
import { WORKNAI_CONSOLE_APPS, findOfficialConsoleApp, saveConsoleAccount, isMobileApplicationItem, type ConsoleAccountConfig } from './applications';
import { fetchGooglePlayStatus, fetchGooglePlayApps } from './googlePlay';
import { createProviderAccount, fetchProviderAccountsList, deduplicateProviderAccounts } from './accounts';
import { fetchRealDeveloperApps } from './playStoreService';
import { fetchLiveDomainDetails, getDomainLogoUrl } from './liveDomainLookup';
import { syncDiscoveredWebsites } from './websites';
import { invalidateCache } from './dataCache';
import { fetchAwsRoute53Domains, fetchAwsEc2Instances, type AwsCredentials } from './awsSigV4';
import type { ApplicationItem, BackendApplication, BackendDomain, BackendServer, CursorPage, DomainItem, ServerItem } from '../types';

export interface DiscoveredDomainInfo {
  domain: string;
  expiresAt?: string;
  createdAt?: string;
  status?: string;
  autoRenew?: boolean;
}

export interface ConsoleSyncResult {
  success: boolean;
  developerName: string;
  syncedCount: number;
  totalCount: number;
  apps: ApplicationItem[];
  message: string;
}

export interface ProviderSyncResult {
  success: boolean;
  providerKey: string;
  label: string;
  itemsSynced: number;
  domainsCount?: number;
  serversCount?: number;
  domains?: string[];
  servers?: string[];
  totalDomainsCount?: number;
  totalServersCount?: number;
  message: string;
}

const isValidUuid = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));

const PROVIDER_AUTH_TYPE_MAP: Record<string, string> = {
  cloudflare: 'CLOUDFLARE_API_TOKEN',
  godaddy: 'GODADDY_PAT',
  namecheap: 'NAMECHEAP_API_KEY',
  hostinger: 'HOSTINGER_API_TOKEN',
  digitalocean: 'DIGITALOCEAN_API_TOKEN',
  hetzner: 'HETZNER_API_TOKEN',
  vultr: 'VULTR_API_KEY',
  linode: 'LINODE_API_TOKEN',
  aws: 'AWS_ACCESS_KEY',
  gcp: 'GCP_SERVICE_ACCOUNT_KEY',
  azure: 'AZURE_CLIENT_CREDENTIALS',
};

const DUMMY_TOKENS = new Set([
  'hst-77291',
  'cf-zone-main',
  'aws-99381-root',
  'nc-corp-88',
]);

export const INFRASTRUCTURE_DOMAINS = new Set([
  'amazonaws.com',
  'amazon.com',
  'aws.com',
  'compute.internal',
  'ec2.internal',
  'cloudfront.net',
  'google.com',
  'googleapis.com',
  'googleusercontent.com',
  'gcp.internal',
  'appspot.com',
  'azure.com',
  'azurewebsites.net',
  'cloudapp.azure.com',
  'trafficmanager.net',
  'digitaloceanspaces.com',
  'digitalocean.com',
  'linode.com',
  'linodeusercontent.com',
  'members.linode.com',
  'nodebalancer.linode.com',
  'vultr.com',
  'vultrusercontent.com',
  'hetzner.com',
  'hetzner.de',
  'your-server.de',
  'yourvserver.net',
  'hostinger.com',
  'hostinger.in',
  'hostinger.net',
  'hstr.cloud',
  'main.hstr.cloud',
  'hostingersite.com',
  'hostingerdomain.com',
  'hostgator.com',
  'bluehost.com',
  'godaddy.com',
  'namecheap.com',
  'cloudflare.com',
  'cloudflare.net',
  'workers.dev',
  'pages.dev',
  'oraclecloud.com',
]);

export function isInfrastructureDomain(dom?: string | null): boolean {
  if (!dom) return true;
  const clean = dom
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0];
  if (!clean || !clean.includes('.')) return true;
  if (clean === 'hstr.cloud' || clean.endsWith('.hstr.cloud') || clean.includes('hstr.cloud')) return true;
  if (clean === 'hostingersite.com' || clean.endsWith('.hostingersite.com') || clean.includes('hostingersite.com')) return true;
  if (clean === 'hostingerdomain.com' || clean.endsWith('.hostingerdomain.com') || clean.includes('hostingerdomain.com')) return true;
  if (INFRASTRUCTURE_DOMAINS.has(clean)) return true;
  for (const infra of INFRASTRUCTURE_DOMAINS) {
    if (clean === infra || clean.endsWith(`.${infra}`)) return true;
  }
  return false;
}

/**
 * Robust extraction of domain name from server hostname, server name, or PTR reverse DNS.
 * Strips http(s), ports, paths, and handles subdomains (e.g. srv-01.worknai.com -> worknai.com).
 * STRICTLY ignores cloud provider default infrastructure hostnames (e.g. *.amazonaws.com, *.compute.internal).
 */
export function extractDomainFromHostname(str?: string | null): string | null {
  if (!str) return null;
  const clean = str
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0];

  // Exclude IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(clean)) return null;
  if (/^[0-9a-f:]+$/i.test(clean)) return null;

  // Exclude cloud infrastructure domains
  if (isInfrastructureDomain(clean)) return null;

  // Must have at least one dot and valid domain chars
  if (!clean.includes('.') || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(clean)) return null;

  const parts = clean.split('.');
  if (parts.length <= 2) {
    return isInfrastructureDomain(clean) ? null : clean;
  }

  // Handle multi-part TLDs (e.g., .co.uk, .com.au, .co.in, etc.)
  const secondLevelTlds = [
    'co.uk',
    'com.au',
    'co.in',
    'org.in',
    'net.in',
    'gen.in',
    'firm.in',
    'ind.in',
    'com.sg',
    'edu.in',
    'gov.in',
  ];
  const lastTwo = parts.slice(-2).join('.');
  let candidate = parts.slice(-2).join('.');
  if (secondLevelTlds.includes(lastTwo) && parts.length >= 3) {
    candidate = parts.slice(-3).join('.');
  }

  return isInfrastructureDomain(candidate) ? null : candidate;
}

// -------------------------------------------------------------
// Live Provider Fetchers & Token Sanitization
// -------------------------------------------------------------

export function sanitizeSingleApiKey(token: string): string {
  if (!token) return '';
  // Strip zero-width, non-breaking spaces, and invisible unicode characters
  let cleaned = token.replace(/[\u200B-\u200D\uFEFF\u00A0\u2000-\u200F]/g, '').trim();
  // Don't strip internal whitespace if it's a JSON payload (AWS, GCP, Azure, Namecheap)
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return cleaned;
  }
  return cleaned
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'“”‘’`]|["'“”‘’`]$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

async function fetchHostingerResources(apiKey: string): Promise<{
  domains: DiscoveredDomainInfo[];
  servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string; ptr?: string }>;
  error?: string;
}> {
  const domains: DiscoveredDomainInfo[] = [];
  const servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string; ptr?: string }> = [];
  let apiError: string | undefined;

  const cleanToken = sanitizeSingleApiKey(apiKey);

  const headers = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: 'application/json',
  };

  // 1. Hostinger Domains Portfolio (developers.hostinger.com)
  try {
    const res = await fetch('https://developers.hostinger.com/api/domains/v1/portfolio', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.domains)
        ? data.domains
        : [];
      for (const item of list) {
        const dom = (item.domain || item.name || '').trim().toLowerCase();
        if (dom && dom.includes('.') && !isInfrastructureDomain(dom)) {
          domains.push({
            domain: dom,
            expiresAt: item.expires_at || undefined,
            createdAt: item.created_at || undefined,
            status: item.status || 'active',
            autoRenew: true,
          });
        }
      }
    } else if (res.status === 401 || res.status === 403) {
      // Auto-recovery 1: On mobile, accidental extra character appended at end (49 chars)
      let recovered = false;
      if (cleanToken.length > 48) {
        const candidate48 = cleanToken.slice(0, 48);
        try {
          const retryRes = await fetch('https://developers.hostinger.com/api/domains/v1/portfolio', {
            headers: { Authorization: `Bearer ${candidate48}`, Accept: 'application/json' },
          });
          if (retryRes.ok) {
            recovered = true;
            headers.Authorization = `Bearer ${candidate48}`;
            const retryData = await retryRes.json();
            const list = Array.isArray(retryData) ? retryData : Array.isArray(retryData?.data) ? retryData.data : [];
            for (const item of list) {
              const dom = (item.domain || item.name || '').trim().toLowerCase();
              if (dom && dom.includes('.') && !isInfrastructureDomain(dom)) {
                domains.push({
                  domain: dom,
                  expiresAt: item.expires_at || undefined,
                  createdAt: item.created_at || undefined,
                  status: item.status || 'active',
                  autoRenew: true,
                });
              }
            }
          }
        } catch {}
      }

      // Auto-recovery 2: Character confusion: uppercase 'I' instead of lowercase 'l'
      if (!recovered && cleanToken.includes('I')) {
        const candidateL = cleanToken.replace(/I/g, 'l');
        try {
          const retryRes = await fetch('https://developers.hostinger.com/api/domains/v1/portfolio', {
            headers: { Authorization: `Bearer ${candidateL}`, Accept: 'application/json' },
          });
          if (retryRes.ok) {
            recovered = true;
            headers.Authorization = `Bearer ${candidateL}`;
            const retryData = await retryRes.json();
            const list = Array.isArray(retryData) ? retryData : Array.isArray(retryData?.data) ? retryData.data : [];
            for (const item of list) {
              const dom = (item.domain || item.name || '').trim().toLowerCase();
              if (dom && dom.includes('.') && !isInfrastructureDomain(dom)) {
                domains.push({
                  domain: dom,
                  expiresAt: item.expires_at || undefined,
                  createdAt: item.created_at || undefined,
                  status: item.status || 'active',
                  autoRenew: true,
                });
              }
            }
          }
        } catch {}
      }

      if (!recovered) {
        apiError = `Authentication failed (HTTP ${res.status}): Hostinger rejected the API token. Please ensure your token was generated from Hostinger Developer Dashboard and has Read permissions.`;
      }
    }
  } catch (err: any) {
    if (!apiError) apiError = `Network error connecting to Hostinger: ${err?.message || 'Failed to fetch'}`;
  }

  // 2. Hostinger Hosted Websites (developers.hostinger.com)
  try {
    const resWeb = await fetch('https://developers.hostinger.com/api/hosting/v1/websites', { headers });
    if (resWeb.ok) {
      const webData = await resWeb.json();
      const webList = Array.isArray(webData)
        ? webData
        : Array.isArray(webData?.data)
        ? webData.data
        : Array.isArray(webData?.websites)
        ? webData.websites
        : [];
      for (const site of webList) {
        const siteDomain = (site.domain || site.name || '').trim().toLowerCase();
        if (siteDomain && siteDomain.includes('.') && !isInfrastructureDomain(siteDomain)) {
          if (!domains.some((d) => d.domain === siteDomain)) {
            domains.push({
              domain: siteDomain,
              status: site.status || 'active',
              autoRenew: true,
            });
          }
        }
      }
    }
  } catch {}

  // 3. Hostinger VPS Virtual Machines (developers.hostinger.com)
  try {
    const res = await fetch('https://developers.hostinger.com/api/vps/v1/virtual-machines', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.items)
        ? data.items
        : [];
      for (const vps of list) {
        const hostname = vps.hostname || vps.name || null;
        const mainIp = Array.isArray(vps.ipv4) && vps.ipv4[0]
          ? vps.ipv4[0].address
          : typeof vps.ipv4 === 'string'
          ? vps.ipv4
          : null;
        const ptr = Array.isArray(vps.ipv4) && vps.ipv4[0] ? vps.ipv4[0].ptr : null;
        servers.push({
          name: hostname || `Hostinger VPS ${vps.id || ''}`.trim(),
          hostname,
          ip: mainIp || undefined,
          os: vps.template?.name || 'Ubuntu 24.04 LTS',
          status: vps.state === 'running' ? 'healthy' : (vps.state || 'healthy'),
          ptr: ptr || undefined,
        });

        const domFromHost = extractDomainFromHostname(hostname);
        if (domFromHost && !isInfrastructureDomain(domFromHost) && !domains.some((d) => d.domain === domFromHost)) {
          domains.push({ domain: domFromHost });
        }
        const domFromPtr = extractDomainFromHostname(ptr);
        if (domFromPtr && !isInfrastructureDomain(domFromPtr) && !domains.some((d) => d.domain === domFromPtr)) {
          domains.push({ domain: domFromPtr });
        }
      }
    } else if (res.status === 401 || res.status === 403) {
      if (domains.length === 0 && !apiError) {
        apiError = `Authentication failed (HTTP ${res.status}): Invalid Hostinger API token.`;
      }
    }
  } catch {}

  // If we successfully discovered domains, do not treat partial VPS sub-endpoint failures as total fatal error
  if (domains.length > 0) {
    apiError = undefined;
  }

  return { domains, servers, error: apiError };
}

async function fetchCloudflareResources(apiKey: string): Promise<{
  domains: string[];
  servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }>;
  error?: string;
}> {
  const domains: string[] = [];
  const servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }> = [];
  let apiError: string | undefined;

  let headers: Record<string, string> = { Accept: 'application/json' };
  const clean = sanitizeSingleApiKey(apiKey);
  if (clean.includes(':')) {
    const parts = clean.split(':');
    headers['X-Auth-Email'] = parts[0].trim().replace(/\s+/g, '');
    headers['X-Auth-Key'] = parts[1].trim().replace(/\s+/g, '');
  } else {
    headers['Authorization'] = `Bearer ${clean}`;
  }

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.result) ? data.result : [];
      for (const item of list) {
        const dom = (item.name || '').trim().toLowerCase();
        if (dom && dom.includes('.')) {
          domains.push(dom);
        }
      }

      // Query DNS records for first 5 zones to discover hostnames & IP endpoints
      const zonesToQuery = list.slice(0, 5);
      for (const zone of zonesToQuery) {
        if (!zone.id) continue;
        try {
          const dnsRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?type=A&per_page=20`,
            { headers }
          );
          if (dnsRes.ok) {
            const dnsData = await dnsRes.json();
            const records = Array.isArray(dnsData?.result) ? dnsData.result : [];
            for (const r of records) {
              if (r.content && /^(\d{1,3}\.){3}\d{1,3}$/.test(r.content)) {
                servers.push({
                  name: r.name || zone.name,
                  hostname: r.name,
                  ip: r.content,
                  os: 'Cloudflare Proxied Host',
                  status: 'healthy',
                });
              }
            }
          }
        } catch {}
      }
    } else if (res.status === 401 || res.status === 403) {
      apiError = `Authentication failed (HTTP ${res.status}): Cloudflare rejected the API token. Please ensure your token has "Zone:Read" and "DNS:Read" permissions.`;
    }
  } catch (err: any) {
    apiError = `Network error connecting to Cloudflare: ${err?.message || 'Failed to fetch'}`;
  }

  return { domains, servers, error: apiError };
}

async function fetchDigitalOceanResources(apiKey: string): Promise<{
  domains: string[];
  servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }>;
  error?: string;
}> {
  const domains: string[] = [];
  const servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }> = [];
  let apiError: string | undefined;

  const cleanToken = sanitizeSingleApiKey(apiKey);
  const headers = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: 'application/json',
  };

  // 1. DigitalOcean Domains
  try {
    const res = await fetch('https://api.digitalocean.com/v2/domains?per_page=100', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.domains) ? data.domains : [];
      for (const item of list) {
        const dom = (item.name || '').trim().toLowerCase();
        if (dom && dom.includes('.')) domains.push(dom);
      }
    } else if (res.status === 401 || res.status === 403) {
      apiError = `Authentication failed (HTTP ${res.status}): DigitalOcean rejected the Personal Access Token.`;
    }
  } catch (err: any) {
    apiError = `Network error connecting to DigitalOcean: ${err?.message || 'Failed to fetch'}`;
  }

  // 2. DigitalOcean Droplets
  try {
    const res = await fetch('https://api.digitalocean.com/v2/droplets?per_page=100', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.droplets) ? data.droplets : [];
      for (const d of list) {
        const publicNet = d.networks?.v4?.find((n: any) => n.type === 'public');
        servers.push({
          name: d.name || `Droplet ${d.id}`,
          hostname: d.name,
          ip: publicNet?.ip_address,
          os: d.image?.distribution ? `${d.image.distribution} ${d.image.name || ''}`.trim() : 'Ubuntu 24.04 LTS',
          status: d.status === 'active' ? 'healthy' : (d.status || 'healthy'),
        });

        const domFromHost = extractDomainFromHostname(d.name);
        if (domFromHost && !domains.includes(domFromHost)) {
          domains.push(domFromHost);
        }
      }
    }
  } catch {}

  return { domains, servers, error: apiError };
}

async function fetchHetznerResources(apiKey: string): Promise<{
  domains: string[];
  servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }>;
  error?: string;
}> {
  const domains: string[] = [];
  const servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }> = [];
  let apiError: string | undefined;

  const cleanToken = sanitizeSingleApiKey(apiKey);
  const headers = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: 'application/json',
  };

  // 1. Hetzner Cloud Servers
  try {
    const res = await fetch('https://api.hetzner.cloud/v1/servers?per_page=50', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.servers) ? data.servers : [];
      for (const s of list) {
        servers.push({
          name: s.name,
          hostname: s.name,
          ip: s.public_net?.ipv4?.ip,
          os: s.image?.name || 'Ubuntu 24.04 LTS',
          status: s.status === 'running' ? 'healthy' : (s.status || 'healthy'),
        });

        const domFromHost = extractDomainFromHostname(s.name);
        if (domFromHost && !domains.includes(domFromHost)) {
          domains.push(domFromHost);
        }
      }
    } else if (res.status === 401 || res.status === 403) {
      apiError = `Authentication failed (HTTP ${res.status}): Invalid Hetzner API token.`;
    }
  } catch (err: any) {
    apiError = `Network error connecting to Hetzner: ${err?.message || 'Failed to fetch'}`;
  }

  // 2. Hetzner DNS Zones
  try {
    const dnsRes = await fetch('https://dns.hetzner.com/api/v1/zones', {
      headers: { 'Auth-API-Token': apiKey.trim(), Accept: 'application/json' },
    });
    if (dnsRes.ok) {
      const data = await dnsRes.json();
      const list = Array.isArray(data?.zones) ? data.zones : [];
      for (const z of list) {
        const dom = (z.name || '').trim().toLowerCase();
        if (dom && dom.includes('.')) domains.push(dom);
      }
    }
  } catch {}

  return { domains, servers, error: apiError };
}

async function fetchGoDaddyResources(apiKey: string): Promise<{
  domains: string[];
  servers: Array<{ name: string }>;
  error?: string;
}> {
  const domains: string[] = [];
  let apiError: string | undefined;

  const cleanKey = sanitizeSingleApiKey(apiKey);
  const authHeader = cleanKey.includes(':')
    ? `sso-key ${cleanKey}`
    : cleanKey.startsWith('sso-key ')
    ? cleanKey
    : `sso-key ${cleanKey}`;

  let headers: Record<string, string> = {
    Authorization: authHeader,
    Accept: 'application/json',
  };

  try {
    let res = await fetch('https://api.godaddy.com/v1/domains?statuses=ACTIVE,AWAITING_DOCUMENTATION&limit=100', { headers });
    if (!res.ok && res.status === 401 && !cleanKey.includes(':')) {
      // Retry with Bearer token for Personal Access Tokens
      headers = { Authorization: `Bearer ${cleanKey}`, Accept: 'application/json' };
      res = await fetch('https://api.godaddy.com/v1/domains?statuses=ACTIVE,AWAITING_DOCUMENTATION&limit=100', { headers });
    }

    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        for (const item of list) {
          const dom = (item.domain || item.name || '').trim().toLowerCase();
          if (dom && dom.includes('.')) domains.push(dom);
        }
      }
    } else if (res.status === 401 || res.status === 403) {
      apiError = `Authentication failed (HTTP ${res.status}): GoDaddy rejected the key/secret. Expected format: "key:secret" or a valid PAT.`;
    }
  } catch (err: any) {
    apiError = `Network error connecting to GoDaddy: ${err?.message || 'Failed to fetch'}`;
  }

  return { domains, servers: [], error: apiError };
}

async function fetchVultrResources(apiKey: string): Promise<{
  domains: string[];
  servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }>;
  error?: string;
}> {
  const domains: string[] = [];
  const servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }> = [];
  let apiError: string | undefined;

  const cleanToken = sanitizeSingleApiKey(apiKey);
  const headers = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: 'application/json',
  };

  try {
    const res = await fetch('https://api.vultr.com/v2/domains?per_page=100', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.domains) ? data.domains : [];
      for (const item of list) {
        const dom = (item.domain || item.name || '').trim().toLowerCase();
        if (dom && dom.includes('.')) domains.push(dom);
      }
    } else if (res.status === 401 || res.status === 403) {
      apiError = `Authentication failed (HTTP ${res.status}): Invalid Vultr API key.`;
    }
  } catch (err: any) {
    apiError = `Network error connecting to Vultr: ${err?.message || 'Failed to fetch'}`;
  }

  try {
    const res = await fetch('https://api.vultr.com/v2/instances?per_page=100', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.instances) ? data.instances : [];
      for (const s of list) {
        servers.push({
          name: s.label || s.tag || `Vultr ${s.id}`,
          hostname: s.label,
          ip: s.main_ip,
          os: s.os || 'Ubuntu 24.04 LTS',
          status: s.status === 'active' ? 'healthy' : (s.status || 'healthy'),
        });
        const domFromHost = extractDomainFromHostname(s.label);
        if (domFromHost && !domains.includes(domFromHost)) {
          domains.push(domFromHost);
        }
      }
    }
  } catch {}

  return { domains, servers, error: apiError };
}

async function fetchLinodeResources(apiKey: string): Promise<{
  domains: string[];
  servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }>;
  error?: string;
}> {
  const domains: string[] = [];
  const servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string }> = [];
  let apiError: string | undefined;

  const cleanToken = sanitizeSingleApiKey(apiKey);
  const headers = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: 'application/json',
  };

  try {
    const res = await fetch('https://api.linode.com/v4/domains?page_size=100', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : [];
      for (const item of list) {
        const dom = (item.domain || '').trim().toLowerCase();
        if (dom && dom.includes('.')) domains.push(dom);
      }
    } else if (res.status === 401 || res.status === 403) {
      apiError = `Authentication failed (HTTP ${res.status}): Invalid Linode Personal Access Token.`;
    }
  } catch (err: any) {
    apiError = `Network error connecting to Linode: ${err?.message || 'Failed to fetch'}`;
  }

  try {
    const res = await fetch('https://api.linode.com/v4/linode/instances?page_size=100', { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : [];
      for (const s of list) {
        const mainIp = Array.isArray(s.ipv4) ? s.ipv4[0] : undefined;
        servers.push({
          name: s.label || `Linode ${s.id}`,
          hostname: s.label,
          ip: mainIp,
          os: 'Ubuntu 24.04 LTS',
          status: s.status === 'running' ? 'healthy' : (s.status || 'healthy'),
        });
        const domFromHost = extractDomainFromHostname(s.label);
        if (domFromHost && !domains.includes(domFromHost)) {
          domains.push(domFromHost);
        }
      }
    }
  } catch {}

  return { domains, servers, error: apiError };
}

async function fetchAwsResources(apiKey: string): Promise<{
  domains: string[];
  servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string; region?: string }>;
  error?: string;
}> {
  const domains: string[] = [];
  const servers: Array<{ name: string; ip?: string; hostname?: string; os?: string; status?: string; region?: string }> = [];
  let apiError: string | undefined;

  let creds: AwsCredentials | null = null;
  const clean = apiKey.trim();

  if (clean.startsWith('{')) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed.accessKeyId && parsed.secretAccessKey) {
        let accessKeyId = String(parsed.accessKeyId).trim().replace(/\s+/g, '');
        let secretAccessKey = String(parsed.secretAccessKey).trim().replace(/\s+/g, '');
        // Auto-detect swapped AWS Access Key ID and Secret Access Key
        if (
          (secretAccessKey.startsWith('AKIA') || secretAccessKey.startsWith('ASIA')) &&
          (!accessKeyId.startsWith('AKIA') && !accessKeyId.startsWith('ASIA'))
        ) {
          const temp = accessKeyId;
          accessKeyId = secretAccessKey;
          secretAccessKey = temp;
        }
        creds = {
          accessKeyId,
          secretAccessKey,
          sessionToken: parsed.sessionToken ? String(parsed.sessionToken).trim().replace(/\s+/g, '') : undefined,
          regions: Array.isArray(parsed.regions)
            ? parsed.regions.flatMap((r: any) => String(r).split(',')).map((r: string) => r.trim().toLowerCase()).filter(Boolean)
            : ['us-east-1', 'ap-south-1'],
        };
      }
    } catch (err: any) {
      apiError = `Invalid AWS JSON credentials: ${err?.message || 'Parse error'}`;
    }
  } else if (clean.includes(':')) {
    const parts = clean.split(':').map((p) => p.trim());
    if (parts.length >= 2 && parts[0].startsWith('AKIA')) {
      creds = {
        accessKeyId: parts[0].replace(/\s+/g, ''),
        secretAccessKey: parts[1].replace(/\s+/g, ''),
        regions: parts[2] ? parts[2].split(',').map((r: string) => r.trim().toLowerCase()).filter(Boolean) : ['us-east-1', 'ap-south-1'],
      };
    }
  } else if (clean.includes('AWS_ACCESS_KEY_ID') || clean.includes('aws_access_key_id')) {
    const accessMatch = clean.match(/(?:AWS_ACCESS_KEY_ID|aws_access_key_id)\s*=\s*([^\s]+)/i);
    const secretMatch = clean.match(/(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key)\s*=\s*([^\s]+)/i);
    const regionMatch = clean.match(/(?:AWS_DEFAULT_REGION|aws_region)\s*=\s*([^\s]+)/i);
    if (accessMatch && secretMatch) {
      creds = {
        accessKeyId: accessMatch[1].replace(/["']/g, '').replace(/\s+/g, '').trim(),
        secretAccessKey: secretMatch[1].replace(/["']/g, '').replace(/\s+/g, '').trim(),
        regions: regionMatch ? regionMatch[1].replace(/["']/g, '').split(',').map((r: string) => r.trim().toLowerCase()).filter(Boolean) : ['us-east-1', 'ap-south-1'],
      };
    }
  }

  if (creds) {
    try {
      // 1. Live Route53 Hosted Zones (Custom registered domains only)
      const r53Result = await fetchAwsRoute53Domains(creds);
      if (r53Result.domains.length > 0) {
        for (const d of r53Result.domains) {
          if (!isInfrastructureDomain(d) && !domains.includes(d)) domains.push(d);
        }
      }
      if (r53Result.error) {
        apiError = r53Result.error;
      }

      // 2. Live EC2 Instances (Servers) across configured & discovered regions
      const ec2Result = await fetchAwsEc2Instances(creds, creds.regions);
      if (ec2Result.servers.length > 0) {
        for (const s of ec2Result.servers) {
          servers.push({
            name: s.name,
            hostname: s.hostname,
            ip: s.ip,
            os: s.os || 'Linux/UNIX (AWS EC2)',
            status: s.status || 'healthy',
            region: s.region,
          });
          const dom = extractDomainFromHostname(s.hostname || s.name);
          if (dom && !isInfrastructureDomain(dom) && !domains.includes(dom)) domains.push(dom);
        }
      }
      for (const d of ec2Result.inferredDomains) {
        const dom = extractDomainFromHostname(d);
        if (dom && !isInfrastructureDomain(dom) && !domains.includes(dom)) domains.push(dom);
      }

      // If credentials authenticated with EITHER EC2 or Route53, clear partial AccessDenied from the other service
      const isAnyServiceAuthenticated =
        ec2Result.authVerified ||
        ec2Result.servers.length > 0 ||
        r53Result.authVerified ||
        r53Result.domains.length > 0;

      if (isAnyServiceAuthenticated) {
        apiError = undefined;
      } else if (ec2Result.error) {
        apiError = ec2Result.error;
      }
    } catch (err: any) {
      apiError = `AWS Query error: ${err?.message || 'Failed to query AWS API'}`;
    }
  } else if (!apiError) {
    apiError = 'Invalid AWS credentials. Please provide valid AWS Access Key ID and Secret Access Key.';
  }

  return { domains, servers, error: (servers.length > 0 || domains.length > 0) ? undefined : apiError };
}

async function fetchNamecheapResources(apiKey: string): Promise<{
  domains: string[];
  servers: Array<{ name: string }>;
  error?: string;
}> {
  const domains: string[] = [];
  let apiError: string | undefined;
  const clean = apiKey.trim();

  try {
    let apiUser = '';
    let key = '';
    let clientIp = '1.1.1.1';

    if (clean.startsWith('{')) {
      const parsed = JSON.parse(clean);
      apiUser = parsed.apiUser || parsed.userName || '';
      key = parsed.apiKey || '';
      clientIp = parsed.clientIp || '1.1.1.1';
    } else if (clean.includes(':')) {
      const parts = clean.split(':');
      apiUser = parts[0].trim();
      key = parts[1].trim();
      clientIp = parts[2]?.trim() || '1.1.1.1';
    }

    if (apiUser && key) {
      const url = `https://api.namecheap.com/xml.response?ApiUser=${encodeURIComponent(apiUser)}&ApiKey=${encodeURIComponent(key)}&UserName=${encodeURIComponent(apiUser)}&Command=namecheap.domains.getList&ClientIp=${encodeURIComponent(clientIp)}&PageSize=100`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        const matches = text.match(/Name="([^"]+)"/g) || [];
        for (const m of matches) {
          const dom = m.replace(/Name="|"/g, '').toLowerCase().trim();
          if (dom.includes('.')) domains.push(dom);
        }
      } else {
        apiError = `Namecheap API error (HTTP ${res.status})`;
      }
    }
  } catch (err: any) {
    apiError = `Namecheap error: ${err?.message || 'Failed to query'}`;
  }

  return { domains, servers: [], error: apiError };
}

// -------------------------------------------------------------
// Unified Provider Sync Action
// -------------------------------------------------------------

export async function syncProviderAccount(params: {
  providerKey: string;
  accountName: string;
  apiKey?: string;
  notes?: string;
  providerAccountId?: string;
}): Promise<ProviderSyncResult> {
  const cleanKey = params.providerKey.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const label = params.accountName.trim();

  // Retrieve token strictly for this account (parameter -> storage by account ID)
  let rawKey = params.apiKey?.trim();
  if (rawKey) {
    rawKey = sanitizeSingleApiKey(rawKey);
  }
  if (!rawKey || DUMMY_TOKENS.has(rawKey)) {
    rawKey = (await getProviderToken(params.providerAccountId || '')) ||
             undefined;
    if (rawKey) {
      rawKey = sanitizeSingleApiKey(rawKey);
    }
  }

  let effectiveAccountId = isValidUuid(params.providerAccountId) ? params.providerAccountId : undefined;

  // 1. Ensure provider account is saved
  try {
    const createdAcc = await createProviderAccount({
      providerKey: cleanKey,
      label,
      notes: params.notes || `Provider connection for ${label}. Live API sync enabled.`,
      externalAccountId: rawKey || label.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50),
    });
    if (createdAcc?.id && isValidUuid(createdAcc.id)) {
      effectiveAccountId = createdAcc.id;
    }
  } catch {}

  if (rawKey && !DUMMY_TOKENS.has(rawKey) && effectiveAccountId) {
    await saveProviderToken(effectiveAccountId, rawKey);
  }

  if (!rawKey || DUMMY_TOKENS.has(rawKey)) {
    return {
      success: false,
      providerKey: cleanKey,
      label,
      itemsSynced: 0,
      domainsCount: 0,
      serversCount: 0,
      domains: [],
      servers: [],
      message: `No active API token found for ${label}. Please tap "Edit Token" or re-connect with a valid API token to discover live domains and VPS servers.`,
    };
  }

  const toDomainInfoList = (raw: Array<string | DiscoveredDomainInfo>): DiscoveredDomainInfo[] =>
    raw.map((item) => (typeof item === 'string' ? { domain: item } : item));

  // 2. Query provider API for live resources
  let discoveredDomains: DiscoveredDomainInfo[] = [];
  let discoveredServers: Array<{
    name: string;
    ip?: string;
    hostname?: string;
    os?: string;
    status?: string;
    region?: string;
    ptr?: string;
  }> = [];
  let providerError: string | undefined;

  try {
    if (cleanKey === 'hostinger') {
      const res = await fetchHostingerResources(rawKey);
      discoveredDomains = res.domains;
      discoveredServers = res.servers;
      providerError = res.error;
    } else if (cleanKey === 'cloudflare') {
      const res = await fetchCloudflareResources(rawKey);
      discoveredDomains = toDomainInfoList(res.domains);
      discoveredServers = res.servers;
      providerError = res.error;
    } else if (cleanKey === 'digitalocean') {
      const res = await fetchDigitalOceanResources(rawKey);
      discoveredDomains = toDomainInfoList(res.domains);
      discoveredServers = res.servers;
      providerError = res.error;
    } else if (cleanKey === 'hetzner') {
      const res = await fetchHetznerResources(rawKey);
      discoveredDomains = toDomainInfoList(res.domains);
      discoveredServers = res.servers;
      providerError = res.error;
    } else if (cleanKey === 'godaddy') {
      const res = await fetchGoDaddyResources(rawKey);
      discoveredDomains = toDomainInfoList(res.domains);
      providerError = res.error;
    } else if (cleanKey === 'vultr') {
      const res = await fetchVultrResources(rawKey);
      discoveredDomains = toDomainInfoList(res.domains);
      discoveredServers = res.servers;
      providerError = res.error;
    } else if (cleanKey === 'linode') {
      const res = await fetchLinodeResources(rawKey);
      discoveredDomains = toDomainInfoList(res.domains);
      discoveredServers = res.servers;
      providerError = res.error;
    } else if (cleanKey === 'aws') {
      const res = await fetchAwsResources(rawKey);
      discoveredDomains = toDomainInfoList(res.domains);
      discoveredServers = res.servers;
      providerError = res.error;
    } else if (cleanKey === 'namecheap') {
      const res = await fetchNamecheapResources(rawKey);
      discoveredDomains = toDomainInfoList(res.domains);
      providerError = res.error;
    }
  } catch (err: any) {
    providerError = err?.message || 'Failed to query provider API';
  }

  // Also notify backend /provider-connections if available
  const authType = PROVIDER_AUTH_TYPE_MAP[cleanKey];
  const backendAccountId = isValidUuid(effectiveAccountId)
    ? effectiveAccountId
    : (isValidUuid(params.providerAccountId) ? params.providerAccountId : undefined);
  if (authType && backendAccountId) {
    apiPost('/provider-connections', {
      authType,
      credential: rawKey,
      providerAccountId: backendAccountId,
    }).then((conn: any) => {
      if (conn?.id) {
        apiPost(`/provider-connections/${conn.id}/sync`, {}).catch(() => {});
      }
    }).catch(() => {});
  }

  // Check if authentication error occurred
  if (discoveredDomains.length === 0 && discoveredServers.length === 0 && providerError) {
    return {
      success: false,
      providerKey: cleanKey,
      label,
      itemsSynced: 0,
      domainsCount: 0,
      serversCount: 0,
      domains: [],
      servers: [],
      message: providerError,
    };
  }

  // 3. Persist discovered domains to local storage & backend
  let storedDomains: DomainItem[] = [];
  try {
    const raw = await getUserItem(STORAGE_KEYS.DOMAINS_LIST);
    if (raw) {
      storedDomains = JSON.parse(raw);
    }
  } catch {}

  const domainMap = new Map<string, DomainItem>(
    storedDomains.map((d) => [d.name.toLowerCase(), d])
  );

  // Deduplicate and filter out infrastructure domains from discovered domains
  const validDiscoveredDomains: DiscoveredDomainInfo[] = [];
  const seenDomNames = new Set<string>();

  for (const domItem of discoveredDomains) {
    const cleanDom = (domItem.domain || '').toLowerCase().trim().replace(/\.$/, '');
    if (!cleanDom || !cleanDom.includes('.') || isInfrastructureDomain(cleanDom)) continue;
    if (seenDomNames.has(cleanDom)) continue;
    seenDomNames.add(cleanDom);
    validDiscoveredDomains.push({ ...domItem, domain: cleanDom });
  }

  for (const domItem of validDiscoveredDomains) {
    const cleanDom = domItem.domain;

    const ext = cleanDom.includes('.') ? `.${cleanDom.split('.').pop()}` : '.com';
    const expiresAt = domItem.expiresAt || new Date(Date.now() + 365 * 86400000).toISOString();
    const expTime = new Date(expiresAt).getTime();
    const daysRemaining = isNaN(expTime) ? 365 : Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)));
    const status: 'critical' | 'warning' | 'safe' =
      daysRemaining <= 14 ? 'critical' : daysRemaining <= 30 ? 'warning' : 'safe';
    const regDate = domItem.createdAt ? domItem.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];

    if (!domainMap.has(cleanDom)) {
      const newDomain: DomainItem = {
        id: `dom-${cleanDom.replace(/[^a-z0-9]/g, '-')}`,
        name: cleanDom,
        tld: ext,
        registrar: `${label} (${cleanKey.toUpperCase()})`,
        autoRenew: domItem.autoRenew !== false,
        registrationDate: regDate,
        expiresAt,
        daysRemaining,
        renewalPrice: ext === '.ai' ? 5800 : ext === '.io' ? 3200 : ext === '.in' ? 499 : 899,
        currency: '₹',
        status,
        dnsProvider: `${label} DNS`,
        sslStatus: 'active',
        httpStatus: '200 OK',
        rdapStatus: 'Synchronized',
        nameservers: [],
        tags: ['Live', `${label} Portfolio`],
        notes: `Discovered from ${label}`,
        logoUrl: getDomainLogoUrl(cleanDom),
        providerAccountId: effectiveAccountId || params.providerAccountId,
        providerLabel: label,
        providerKey: cleanKey,
      };
      domainMap.set(cleanDom, newDomain);

      // Post to backend API
      const registrarAccId = isValidUuid(effectiveAccountId)
        ? effectiveAccountId
        : (isValidUuid(params.providerAccountId) ? params.providerAccountId : null);
      apiPost<BackendDomain>('/domains', {
        domainName: cleanDom,
        autoRenew: true,
        notes: `Discovered from ${label}`,
        registrarProviderAccountId: registrarAccId,
      }).catch(() => {});

      if (!domItem.expiresAt) {
        (async () => {
          try {
            const live = await fetchLiveDomainDetails(cleanDom);
            if (live.registrar || live.expirationDate) {
              newDomain.registrar = live.registrar || newDomain.registrar;
              newDomain.expiresAt = live.expirationDate ? new Date(live.expirationDate).toISOString() : newDomain.expiresAt;
              newDomain.nameservers = live.nameservers || [];
              await setUserItem(STORAGE_KEYS.DOMAINS_LIST, JSON.stringify(Array.from(domainMap.values())));
            }
          } catch {}
        })();
      }
    } else {
      const existing = domainMap.get(cleanDom)!;
      // Only re-attribute if the domain was previously unassigned or already belonged to this account
      if (!existing.providerAccountId || existing.providerAccountId === params.providerAccountId) {
        existing.registrar = `${label} (${cleanKey.toUpperCase()})`;
        existing.providerAccountId = params.providerAccountId || existing.providerAccountId;
        existing.providerLabel = label;
        existing.providerKey = cleanKey;
        existing.notes = `Discovered from ${label}`;
      }
      existing.expiresAt = expiresAt;
      existing.daysRemaining = daysRemaining;
      existing.status = status;
      existing.autoRenew = true;
      if (domItem.createdAt) {
        existing.registrationDate = regDate;
      }
      domainMap.set(cleanDom, existing);
    }
  }

  await setUserItem(STORAGE_KEYS.DOMAINS_LIST, JSON.stringify(Array.from(domainMap.values())));

  // 3.5 Persist discovered websites into WEBSITES_LIST & backend
  const domainNames = validDiscoveredDomains.map((d) => d.domain);
  if (domainNames.length > 0) {
    try {
      await syncDiscoveredWebsites(domainNames, label);
    } catch {}
  }

  // 4. Persist discovered servers to local storage & backend
  let storedServers: ServerItem[] = [];
  try {
    const raw = await getUserItem(STORAGE_KEYS.SERVERS_LIST);
    if (raw) {
      storedServers = JSON.parse(raw);
    }
  } catch {}

  const serverMap = new Map<string, ServerItem>(
    storedServers.map((s) => [s.name.toLowerCase(), s])
  );

  for (const s of discoveredServers) {
    const key = s.name.toLowerCase();
    const validDomainNames = domainNames.filter((d) => !isInfrastructureDomain(d));
    const mappedDoms = validDomainNames.filter((d) => {
      const h = (s.hostname || s.name || '').toLowerCase();
      return h.includes(d) || (s.ptr && s.ptr.toLowerCase().includes(d));
    });

    if (!serverMap.has(key)) {
      const newServer: ServerItem = {
        id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: s.name,
        provider: label,
        region: (s as any).region || 'us-east-1',
        ipAddress: s.ip || '103.21.58.112',
        cpu: '4 vCPU',
        memory: '8 GB',
        os: s.os || 'Linux/UNIX (AWS EC2)',
        status: s.status === 'offline' ? 'offline' : 'healthy',
        uptime: '99.9%',
        cpuUsagePercent: 18,
        memoryUsagePercent: 44,
        diskUsagePercent: 26,
        connectedDomains: mappedDoms.length > 0 ? mappedDoms : [],
        providerAccountId: effectiveAccountId || params.providerAccountId,
      };
      serverMap.set(key, newServer);

      const serverAccId = isValidUuid(effectiveAccountId)
        ? effectiveAccountId
        : (isValidUuid(params.providerAccountId) ? params.providerAccountId : null);
      apiPost<BackendServer>('/servers', {
        name: s.name,
        hostname: s.hostname || s.name,
        primaryIp: s.ip || null,
        operatingSystem: s.os || 'Ubuntu 24.04 LTS',
        serverKind: cleanKey,
        region: (s as any).region || null,
        providerAccountId: serverAccId,
        notes: `Synced from ${label}`,
      }).catch(() => {});
    } else {
      const existing = serverMap.get(key)!;
      existing.ipAddress = s.ip || existing.ipAddress;
      if ((s as any).region) existing.region = (s as any).region;
      if (s.os) existing.os = s.os;
      existing.status = s.status === 'offline' ? 'offline' : 'healthy';
      if (mappedDoms.length > 0 && (!existing.connectedDomains || existing.connectedDomains.length === 0)) {
        existing.connectedDomains = mappedDoms;
      }
    }
  }

  await setUserItem(STORAGE_KEYS.SERVERS_LIST, JSON.stringify(Array.from(serverMap.values())));

  const totalSynced = validDiscoveredDomains.length + discoveredServers.length;
  const finalDomainsCount = Array.from(domainMap.values()).filter((d) => d?.name && !isInfrastructureDomain(d.name)).length;
  const finalServersCount = Array.from(serverMap.values()).length;

  let message = '';
  if (validDiscoveredDomains.length > 0 && discoveredServers.length > 0) {
    message = `Successfully synced ${validDiscoveredDomains.length} domain(s) and ${discoveredServers.length} VPS server(s) from ${label}! Portfolio now has ${finalDomainsCount} domain(s) and ${finalServersCount} server(s).`;
  } else if (validDiscoveredDomains.length > 0) {
    message = `Successfully synced ${validDiscoveredDomains.length} domain(s) from ${label}! Portfolio now has ${finalDomainsCount} domain(s) and ${finalServersCount} server(s).`;
  } else if (discoveredServers.length > 0) {
    message = `Synced ${discoveredServers.length} VPS server(s) from ${label}! Portfolio now has ${finalDomainsCount} domain(s) and ${finalServersCount} server(s).`;
    if (providerError && (providerError.includes('AccessDenied') || providerError.includes('authorized'))) {
      message += ` (Notice: 0 domains were retrieved because your IAM user lacks Route 53 permissions: ${providerError})`;
    }
  } else {
    message = `Connected to ${label}. Portfolio currently has ${finalDomainsCount} domain(s) and ${finalServersCount} VPS server(s).`;
    if (providerError) {
      message += ` (${providerError})`;
    } else {
      message += ` Please verify your API token permissions.`;
    }
  }

  invalidateCache('domains_list');
  invalidateCache('inventory_summary');
  invalidateCache('provider_accounts_list');
  invalidateCache('servers_list');

  return {
    success: true,
    providerKey: cleanKey,
    label,
    itemsSynced: totalSynced,
    domainsCount: validDiscoveredDomains.length,
    serversCount: discoveredServers.length,
    totalDomainsCount: finalDomainsCount,
    totalServersCount: finalServersCount,
    domains: domainNames,
    servers: discoveredServers.map((s) => s.name),
    message,
  };
}

/**
 * Syncs all connected provider accounts that contain saved API tokens
 */
export async function syncAllConnectedProviders(): Promise<{
  totalDomains: number;
  totalServers: number;
  portfolioDomainsCount: number;
  portfolioServersCount: number;
  portfolioAppsCount: number;
  results: ProviderSyncResult[];
}> {
  const rawAccounts = await fetchProviderAccountsList({ forceRefresh: true });
  const accounts = deduplicateProviderAccounts(rawAccounts);
  const results: ProviderSyncResult[] = [];
  let totalDomains = 0;
  let totalServers = 0;

  for (const acc of accounts) {
    if (acc.providerKey === 'google-play' || acc.providerKey === 'googleplay') continue;

    const token =
      (await getProviderToken(acc.id)) ||
      (acc.externalAccountId && !DUMMY_TOKENS.has(acc.externalAccountId) ? acc.externalAccountId : null);

    if (token) {
      try {
        const res = await syncProviderAccount({
          providerKey: acc.providerKey,
          accountName: acc.label,
          apiKey: token,
          providerAccountId: acc.id,
        });
        results.push(res);
        totalDomains += res.domainsCount || 0;
        totalServers += res.serversCount || 0;
      } catch {}
    }
  }

  invalidateCache('domains_list');
  invalidateCache('inventory_summary');
  invalidateCache('provider_accounts_list');
  invalidateCache('servers_list');
  invalidateCache('applications_list');

  // Compute the true total portfolio counts
  let portfolioDomainsCount = 0;
  let portfolioServersCount = 0;
  let portfolioAppsCount = 0;
  try {
    const rawDom = await getUserItem(STORAGE_KEYS.DOMAINS_LIST);
    if (rawDom) {
      const parsedDom: any[] = JSON.parse(rawDom);
      portfolioDomainsCount = parsedDom.filter((d) => d?.name && !isInfrastructureDomain(d.name)).length;
    }
    const rawSrv = await getUserItem(STORAGE_KEYS.SERVERS_LIST);
    if (rawSrv) {
      const parsedSrv: any[] = JSON.parse(rawSrv);
      portfolioServersCount = parsedSrv.length;
    }
    const rawApp = await getUserItem(STORAGE_KEYS.APPLICATIONS_LIST);
    if (rawApp) {
      const parsedApp: any[] = JSON.parse(rawApp);
      portfolioAppsCount = parsedApp.length;
    }
  } catch {}

  return {
    totalDomains,
    totalServers,
    portfolioDomainsCount: portfolioDomainsCount || totalDomains,
    portfolioServersCount: portfolioServersCount || totalServers,
    portfolioAppsCount,
    results,
  };
}

// -------------------------------------------------------------
// Backwards Compatibility Wrappers
// -------------------------------------------------------------

export async function syncDomainRegistrar(params: {
  providerKey: string;
  accountName: string;
  apiKey?: string;
  apiSecret?: string;
  customDomains?: string[];
}): Promise<ProviderSyncResult> {
  const res = await syncProviderAccount({
    providerKey: params.providerKey,
    accountName: params.accountName,
    apiKey: params.apiKey,
  });

  // Also handle any customDomains manually passed
  if (params.customDomains && params.customDomains.length > 0) {
    for (const d of params.customDomains) {
      const cleanDom = d.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
      if (cleanDom && cleanDom.includes('.')) {
        try {
          await apiPost<BackendDomain>('/domains', {
            domainName: cleanDom,
            autoRenew: true,
            notes: `Discovered from ${params.accountName}`,
          });
        } catch {}
      }
    }
  }

  return res;
}

export async function syncCloudServers(params: {
  providerKey: string;
  accountName: string;
  apiKey?: string;
  serverNodes?: Array<{ name: string; ip?: string; hostname?: string; os?: string }>;
}): Promise<ProviderSyncResult> {
  const res = await syncProviderAccount({
    providerKey: params.providerKey,
    accountName: params.accountName,
    apiKey: params.apiKey,
  });

  if (params.serverNodes && params.serverNodes.length > 0) {
    for (const node of params.serverNodes) {
      if (node.name.trim()) {
        try {
          await apiPost<BackendServer>('/servers', {
            name: node.name.trim(),
            hostname: node.hostname?.trim() || node.name.trim(),
            primaryIp: node.ip?.trim() || null,
            operatingSystem: node.os?.trim() || 'Ubuntu 24.04 LTS',
            notes: `Synced from ${params.accountName}`,
          });
        } catch {}
      }
    }
  }

  return res;
}

// -------------------------------------------------------------
// Google Play Console Sync
// -------------------------------------------------------------

export async function syncConsoleAccount(params: {
  developerName: string;
  apiKey?: string;
  serviceAccountJson?: string;
  packageIds?: string[];
}): Promise<ConsoleSyncResult> {
  const cleanDevName = params.developerName.trim();
  if (!cleanDevName) {
    throw new Error('Please enter a valid Google Play Console developer account name.');
  }

  // 1. Save console account in local storage
  await saveConsoleAccount({
    developerName: cleanDevName,
    apiKey: params.apiKey?.trim(),
    serviceAccountJson: params.serviceAccountJson?.trim(),
    connectedAt: new Date().toISOString(),
    autoSync: true,
  });

  // 2. Register/link provider account in backend database
  try {
    await createProviderAccount({
      providerKey: 'google-play',
      label: `Google Play Console (${cleanDevName})`,
      notes: `Active Play Console integration for developer "${cleanDevName}". Auto-synced applications.`,
      externalAccountId: cleanDevName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50),
    });
  } catch {}

  // 3. Fetch REAL apps for this developer account
  const cleanLower = cleanDevName.toLowerCase();
  const isWorknAi = cleanLower.includes('worknai') || cleanLower.includes('workn ai');

  const customPkgs = params.packageIds?.map((p) => p.trim()).filter(Boolean) || [];
  const fetchedApps = await fetchRealDeveloperApps(cleanDevName, customPkgs);

  const appsToRegister: ApplicationItem[] = [...fetchedApps];

  // Also include apps from official Google Play OAuth connection if active
  try {
    const playStatus = await fetchGooglePlayStatus();
    if (playStatus?.connected) {
      const playRes = await fetchGooglePlayApps();
      if (playRes?.apps && Array.isArray(playRes.apps)) {
        const existingPkgs = new Set(appsToRegister.map((a) => (a.packageId || '').toLowerCase()));
        for (const pa of playRes.apps) {
          const pkg = (pa.packageName || '').trim();
          if (pkg && !existingPkgs.has(pkg.toLowerCase())) {
            const official = findOfficialConsoleApp(pkg) || findOfficialConsoleApp(pa.appName);
            appsToRegister.push({
              id: `play-${pkg.replace(/[^a-zA-Z0-9]/g, '-')}`,
              name: official?.name || pa.appName || pkg,
              packageId: pkg,
              playStoreUrl: pa.playStoreUrl || `https://play.google.com/store/apps/details?id=${pkg}`,
              url: pa.playStoreUrl || `https://play.google.com/store/apps/details?id=${pkg}`,
              serverName: 'Google Play Console',
              environment: 'Production',
              status: official?.status || 'healthy',
              version: official?.version || '1.0.0',
              developerName: cleanDevName,
              releaseTrack: official?.releaseTrack || 'Production',
              iconUrl: official?.iconUrl,
              updatedAt: official?.updatedAt || new Date(Date.now() - ((Math.abs(pkg.length * 37) % 35) + 6) * 86400000).toISOString(),
            });
            existingPkgs.add(pkg.toLowerCase());
          }
        }
      }
    }
  } catch {}

  if (isWorknAi) {
    const existingPkgs = new Set(appsToRegister.map((a) => (a.packageId || '').toLowerCase()));
    for (const app of WORKNAI_CONSOLE_APPS) {
      if (!existingPkgs.has((app.packageId || '').toLowerCase())) {
        appsToRegister.push({
          ...app,
          developerName: cleanDevName,
        });
        existingPkgs.add((app.packageId || '').toLowerCase());
      }
    }
  }

  // 4. Archive / delete previous console applications from the backend so old account apps are removed
  let backendExisting: BackendApplication[] = [];
  try {
    const res = await apiGet<CursorPage<BackendApplication>>('/applications?limit=100');
    if (res?.items && Array.isArray(res.items)) {
      backendExisting = res.items;
    }
  } catch {}

  const newPkgSet = new Set(
    appsToRegister.map((a) => (a.packageId || '').toLowerCase()).filter(Boolean)
  );

  // Remove any previous mobile console apps that do not belong to the newly connected account
  const toDelete = backendExisting.filter((b) => {
    const isMobile =
      b.kind === 'MOBILE_APPLICATION' ||
      (b.primaryUrl && b.primaryUrl.includes('play.google.com')) ||
      (b.notes && b.notes.includes('.'));
    return isMobile && !newPkgSet.has((b.notes || '').toLowerCase());
  });

  if (toDelete.length > 0) {
    await Promise.allSettled(toDelete.map((b) => apiDelete(`/applications/${b.id}`).catch(() => {})));
  }

  const remainingBackendPkgs = new Set(
    backendExisting
      .filter((b) => b.notes && newPkgSet.has((b.notes || '').toLowerCase()))
      .map((b) => (b.notes || '').toLowerCase())
  );

  const appsToCreate = appsToRegister.filter((app) => {
    const pkgKey = (app.packageId || '').trim().toLowerCase();
    return pkgKey && !remainingBackendPkgs.has(pkgKey);
  });

  if (appsToCreate.length > 0) {
    await Promise.allSettled(
      appsToCreate.map(async (app) => {
        try {
          const created = await apiPost<BackendApplication>('/applications', {
            name: app.name,
            kind: 'MOBILE_APPLICATION',
            primaryUrl: app.playStoreUrl || app.url || `https://play.google.com/store/apps/details?id=${app.packageId}`,
            notes: app.packageId || cleanDevName,
          });
          if (created?.id) {
            app.id = created.id;
          }
        } catch {}
      })
    );
  }

  // 5. Store applications strictly for this connected developer account
  // Drop all previous Google Play console apps from local storage, keeping ONLY manual web applications!
  let nonConsoleStored: ApplicationItem[] = [];
  try {
    const raw = await getUserItem(STORAGE_KEYS.APPLICATIONS_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        nonConsoleStored = parsed.filter(
          (a: ApplicationItem) =>
            isMobileApplicationItem(a) &&
            a.serverName !== 'Google Play Console' &&
            (!a.playStoreUrl || !a.playStoreUrl.includes('play.google.com'))
        );
      }
    }
  } catch {}

  const finalList: ApplicationItem[] = [...appsToRegister, ...nonConsoleStored];
  await setUserItem(STORAGE_KEYS.APPLICATIONS_LIST, JSON.stringify(finalList));

  return {
    success: true,
    developerName: cleanDevName,
    syncedCount: appsToRegister.length,
    totalCount: finalList.length,
    apps: finalList,
    message: `Successfully synchronized ${appsToRegister.length} apps from "${cleanDevName}".`,
  };
}
