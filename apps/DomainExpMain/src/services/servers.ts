import { getUserItem, setUserItem, STORAGE_KEYS } from './storage';
import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import type { BackendServer, CursorPage, ServerItem } from '../types';

export function mapBackendServerToServerItem(s: BackendServer): ServerItem {
  return {
    id: s.id,
    name: s.name,
    provider: s.providerAccountId ? `Account (${s.providerAccountId})` : (s.serverKind || 'Hostinger'),
    region: s.region || 'Mumbai (IN-South-01)',
    ipAddress: s.primaryIp || '192.168.1.1',
    cpu: '4 vCPU',
    memory: '8 GB',
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
        return parsed;
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
}

export async function fetchServersList(): Promise<ServerItem[]> {
  // 1. Fetch live from backend API (/servers)
  try {
    const response = await apiGet<CursorPage<BackendServer>>('/servers?limit=100');
    if (response?.items && Array.isArray(response.items)) {
      const mapped = response.items.map(mapBackendServerToServerItem);
      await saveStoredServers(mapped);
      return mapped;
    }
  } catch {
    // Offline fallback
  }

  return getStoredServers();
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
      serverKind: data.serverKind || data.provider || 'VPS',
      providerAccountId: data.providerAccountId || null,
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
