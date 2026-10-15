import { getUserItem, setUserItem, STORAGE_KEYS } from './storage';
import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import { fetchWithCache, invalidateCache } from './dataCache';
import type { BackendServer, CursorPage, ServerItem } from '../types';

export function formatServerProvider(serverKind?: string | null, hostname?: string | null, notes?: string | null): string {
  const k = (serverKind || '').toLowerCase();
  const h = (hostname || '').toLowerCase();
  const n = (notes || '').toLowerCase();
  if (k.includes('aws') || h.includes('amazonaws.com') || n.includes('aws')) return 'Amazon AWS';
  if (k.includes('hostinger') || h.includes('hstgr.cloud') || n.includes('hostinger')) return 'Hostinger';
  if (k.includes('hetzner') || h.includes('hetzner')) return 'Hetzner';
  if (k.includes('digital') || k.includes('ocean')) return 'DigitalOcean';
  if (k.includes('gcp') || k.includes('google')) return 'Google Cloud';
  if (k.includes('azure') || k.includes('microsoft')) return 'Microsoft Azure';
  if (k.includes('vultr')) return 'Vultr';
  if (k.includes('linode')) return 'Linode';
  return serverKind || 'Custom VPS';
}

export function formatServerRegion(region?: string | null, hostname?: string | null): string {
  const r = (region || '').toLowerCase();
  const h = (hostname || '').toLowerCase();
  if (r.includes('us-east-1') || h.includes('compute-1') || h.includes('us-east-1')) return 'N. Virginia (us-east-1)';
  if (r.includes('eu-north-1') || h.includes('eu-north-1')) return 'Stockholm (eu-north-1)';
  if (r.includes('us-east-2') || h.includes('us-east-2')) return 'Ohio (us-east-2)';
  if (r.includes('us-west-1') || h.includes('us-west-1')) return 'N. California (us-west-1)';
  if (r.includes('us-west-2') || h.includes('us-west-2')) return 'Oregon (us-west-2)';
  if (r.includes('eu-west-1') || h.includes('eu-west-1')) return 'Ireland (eu-west-1)';
  if (r.includes('eu-central-1') || h.includes('eu-central-1')) return 'Frankfurt (eu-central-1)';
  if (r.includes('ap-south-1') || h.includes('ap-south-1')) return 'Mumbai (ap-south-1)';
  if (r.includes('ap-southeast-1') || h.includes('ap-southeast-1')) return 'Singapore (ap-southeast-1)';
  if (r.includes('ap-northeast-1') || h.includes('ap-northeast-1')) return 'Tokyo (ap-northeast-1)';
  if (region && region.trim()) return region.trim();
  if (h.includes('hstgr.cloud')) return 'Vilnius, Europe';
  return 'Global / Cloud';
}

export function mapBackendServerToServerItem(s: BackendServer): ServerItem {
  return {
    id: s.id,
    name: s.name,
    provider: formatServerProvider(s.serverKind, s.hostname, s.notes),
    region: formatServerRegion(s.region, s.hostname),
    ipAddress: s.primaryIp || '192.168.1.1',
    cpu: s.operatingSystem?.includes('t2.nano') ? '1 vCPU' : s.operatingSystem?.includes('t3.micro') ? '2 vCPU' : '4 vCPU',
    memory: s.operatingSystem?.includes('t2.nano') ? '0.5 GB' : s.operatingSystem?.includes('t3.micro') ? '1 GB' : '8 GB',
    os: s.operatingSystem || 'Ubuntu 24.04 LTS',
    status: s.inventoryState === 'ARCHIVED' ? 'offline' : 'healthy',
    uptime: '99.9%',
    cpuUsagePercent: 24,
    memoryUsagePercent: 48,
    diskUsagePercent: 32,
    connectedDomains: [],
  };
}

async function getStoredServers(): Promise<ServerItem[]> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.SERVERS_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed.map((s: ServerItem) => ({
          ...s,
          connectedDomains: (s.connectedDomains || []).filter(
            (d) => d && !d.toLowerCase().includes('amazonaws.com') && !d.toLowerCase().includes('.internal')
          ),
        }));
        if (JSON.stringify(cleaned) !== raw) {
          saveStoredServers(cleaned).catch(() => {});
        }
        return cleaned;
      }
    }
  } catch {}
  return [];
}

async function saveStoredServers(items: ServerItem[]): Promise<void> {
  try {
    await setUserItem(STORAGE_KEYS.SERVERS_LIST, JSON.stringify(items));
  } catch {}
}

export async function clearAllServers(): Promise<void> {
  await setUserItem(STORAGE_KEYS.SERVERS_LIST, JSON.stringify([]));
  invalidateCache('servers_list');
}

const isValidUuid = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));

export async function fetchServersList(options?: { forceRefresh?: boolean }): Promise<ServerItem[]> {
  return fetchWithCache(
    'servers_list',
    async () => {
      const localList = await getStoredServers();
      // 1. Fetch live from backend API (/servers)
      try {
        const response = await apiGet<CursorPage<BackendServer>>('/servers?limit=100');
        if (response?.items && Array.isArray(response.items)) {
          const mapped = response.items.map(mapBackendServerToServerItem);
          const serverMap = new Map<string, ServerItem>();
          // Index mapped live backend servers first by unique IP, then by hostname/name
          for (const s of mapped) {
            const key = (s.ipAddress || s.name).toLowerCase().trim();
            serverMap.set(key, s);
          }
          // Merge local only if not already present
          for (const loc of localList) {
            const key = (loc.ipAddress || loc.name).toLowerCase().trim();
            if (!serverMap.has(key)) {
              serverMap.set(key, loc);
            }
          }
          const merged = Array.from(serverMap.values());
          await saveStoredServers(merged);
          return merged;
        }
      } catch {
        // Offline fallback
      }

      return localList;
    },
    { ttlMs: 30000, forceRefresh: options?.forceRefresh }
  );
}

export async function createServer(data: Partial<ServerItem> & {
  hostname?: string;
  serverKind?: string;
  providerAccountId?: string;
  notes?: string;
}): Promise<ServerItem> {
  let backendId = `srv-${Date.now()}`;

  try {
    const res = await apiPost<BackendServer>('/servers', {
      name: data.name || 'new-server-node',
      hostname: data.hostname || data.name || null,
      primaryIp: data.ipAddress || null,
      operatingSystem: data.os || 'Ubuntu 24.04 LTS',
      region: data.region || 'Mumbai (IN-South-01)',
      serverKind: (data.serverKind || data.provider || 'vps')
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '-'),
      providerAccountId: isValidUuid(data.providerAccountId) ? data.providerAccountId : null,
      notes: data.notes || null,
    });
    if (res?.id) {
      backendId = res.id;
    }
  } catch {}

  const newServer: ServerItem = {
    id: backendId,
    name: data.name || 'new-server-node',
    provider: data.provider || 'Hostinger',
    region: data.region || 'Mumbai (IN-South-01)',
    ipAddress: data.ipAddress || '192.168.1.1',
    cpu: data.cpu || '4 vCPU',
    memory: data.memory || '8 GB',
    os: data.os || 'Ubuntu 24.04 LTS',
    status: (data.status as any) || 'healthy',
    uptime: '100%',
    cpuUsagePercent: Math.floor(Math.random() * 25) + 12,
    memoryUsagePercent: Math.floor(Math.random() * 30) + 25,
    diskUsagePercent: Math.floor(Math.random() * 20) + 20,
    connectedDomains: data.connectedDomains || [],
  };

  const current = await getStoredServers();
  const updated = [newServer, ...current];
  await saveStoredServers(updated);
  invalidateCache('servers_list');
  return newServer;
}

export async function updateServer(
  id: string,
  patch: Partial<ServerItem> & { notes?: string }
): Promise<void> {
  const current = await getStoredServers();
  const index = current.findIndex((s) => s.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...patch };
    await saveStoredServers(current);
    invalidateCache('servers_list');
  }

  apiPatch(`/servers/${encodeURIComponent(id)}`, {
    name: patch.name,
    primaryIp: patch.ipAddress,
    operatingSystem: patch.os,
    region: patch.region,
    notes: patch.notes,
  }).catch(() => {});
}

export async function deleteServer(id: string): Promise<void> {
  const current = await getStoredServers();
  const updated = current.filter((s) => s.id !== id);
  await saveStoredServers(updated);
  invalidateCache('servers_list');
  try {
    await apiDelete(`/servers/${encodeURIComponent(id)}`);
  } catch {}
}

export async function fetchServerHostedApplications(id: string): Promise<any[]> {
  try {
    const res = await apiGet<{ items: any[] }>(`/servers/${encodeURIComponent(id)}/hosted-applications`);
    return res?.items || [];
  } catch {
    return [];
  }
}
