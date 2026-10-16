import { getUserItem, setUserItem, STORAGE_KEYS } from './storage';
import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import { fetchLiveDomainDetails, getDomainLogoUrl } from './liveDomainLookup';
import { isInfrastructureDomain } from './providerSync';
import { fetchWithCache, invalidateCache } from './dataCache';
import type { BackendDomain, CursorPage, DomainItem, DomainMetadataResponse } from '../types';

export function mapBackendDomainToDomainItem(d: BackendDomain): DomainItem {
  const cleanName = (d.domainName || '').trim().toLowerCase();
  const ext = cleanName.includes('.') ? `.${cleanName.split('.').pop()}` : '.com';
  const logoUrl = getDomainLogoUrl(cleanName);

  const expDate = d.expiresAt || new Date(Date.now() + 365 * 86400000).toISOString();
  const expTime = new Date(expDate).getTime();
  const daysRemaining = isNaN(expTime) ? 365 : Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)));
  const status: 'critical' | 'warning' | 'safe' =
    daysRemaining <= 14 ? 'critical' : daysRemaining <= 30 ? 'warning' : 'safe';

  let providerLabel: string | undefined;
  if (d.notes && d.notes.startsWith('Discovered from ')) {
    providerLabel = d.notes.replace('Discovered from ', '').trim();
  }

  return {
    id: d.id,
    name: cleanName,
    tld: ext,
    registrar: d.registrarProviderAccountId ? `Provider (${d.registrarProviderAccountId})` : 'Authoritative Registry',
    autoRenew: Boolean(d.autoRenew),
    registrationDate: d.registeredAt ? d.registeredAt.split('T')[0] : d.createdAt.split('T')[0],
    expiresAt: expDate,
    daysRemaining,
    renewalPrice: ext === '.ai' ? 5800 : ext === '.io' ? 3200 : ext === '.in' ? 499 : 899,
    currency: '₹',
    status,
    dnsProvider: d.dnsProviderAccountId ? `DNS (${d.dnsProviderAccountId})` : 'Authoritative DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: [],
    tags: [d.inventoryState === 'ARCHIVED' ? 'Archived' : 'Live'],
    notes: d.notes || undefined,
    logoUrl,
    providerAccountId: d.registrarProviderAccountId || undefined,
    providerLabel,
    dnsProviderAccountId: d.dnsProviderAccountId || undefined,
  };
}

async function getStoredDomains(): Promise<DomainItem[]> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.DOMAINS_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed
          .filter((d) => d && typeof d.name === 'string' && d.name.trim().length > 0 && !isInfrastructureDomain(d.name))
          .map((d) => ({
            ...d,
            logoUrl: d.logoUrl || getDomainLogoUrl(d.name),
            currency: '₹',
            renewalPrice:
              d.renewalPrice && d.renewalPrice >= 100
                ? d.renewalPrice
                : d.tld === '.ai'
                ? 5800
                : d.tld === '.io'
                ? 3200
                : d.tld === '.in'
                ? 499
                : 899,
          }));
        if (cleaned.length !== parsed.length) {
          saveStoredDomains(cleaned).catch(() => {});
        }
        return cleaned;
      }
    }
  } catch {}
  return [];
}

async function saveStoredDomains(items: DomainItem[]): Promise<void> {
  try {
    await setUserItem(STORAGE_KEYS.DOMAINS_LIST, JSON.stringify(items));
  } catch {}
}

async function getStoredServerDomains(): Promise<DomainItem[]> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.SERVERS_LIST);
    if (!raw) return [];
    const servers: any[] = JSON.parse(raw);
    const domainItems: DomainItem[] = [];
    for (const s of servers) {
      const candidates = new Set<string>();
      if (Array.isArray(s.connectedDomains)) {
        for (const cd of s.connectedDomains) {
          const dom = (cd || '').trim().toLowerCase();
          if (dom.includes('.') && !isInfrastructureDomain(dom)) candidates.add(dom);
        }
      }
      if (s.name && s.name.includes('.')) {
        const clean = s.name.trim().toLowerCase();
        if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(clean) && !/^(\d{1,3}\.){3}\d{1,3}$/.test(clean) && !isInfrastructureDomain(clean)) {
          candidates.add(clean);
        }
      }

      for (const dom of candidates) {
        const ext = dom.includes('.') ? `.${dom.split('.').pop()}` : '.com';
        domainItems.push({
          id: `dom-srv-${dom.replace(/[^a-z0-9]/g, '-')}`,
          name: dom,
          tld: ext,
          registrar: `${s.provider || 'VPS'} (${s.name})`,
          autoRenew: true,
          registrationDate: new Date().toISOString().split('T')[0],
          expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          daysRemaining: 365,
          renewalPrice: 899,
          currency: '₹',
          status: 'safe',
          dnsProvider: `${s.provider || 'VPS'} DNS`,
          sslStatus: 'active',
          httpStatus: '200 OK',
          rdapStatus: 'Synchronized',
          nameservers: [],
          tags: ['Live', 'VPS Server Endpoint'],
          logoUrl: getDomainLogoUrl(dom),
          providerAccountId: s.providerAccountId,
          providerLabel: s.provider,
          serverId: s.id,
          serverName: s.name,
          serverIp: s.ipAddress,
          serverProvider: s.provider,
        });
      }
    }
    return domainItems;
  } catch {
    return [];
  }
}

const isValidUuid = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));

export async function fetchDomainsList(options?: { forceRefresh?: boolean }): Promise<DomainItem[]> {
  return fetchWithCache(
    'domains_list',
    async () => {
      // 1. Try fetching live from backend API (mirroring web app listInventory('domains'))
      try {
        const response = await apiGet<CursorPage<BackendDomain>>('/domains?limit=100');
        if (response?.items && Array.isArray(response.items)) {
          const mapped = response.items.map(mapBackendDomainToDomainItem);
          const localList = await getStoredDomains();
          const combinedMap = new Map<string, DomainItem>();

          // 1. Seed with locally stored and provider-discovered domains (Hostinger, AWS, Cloudflare, etc.)
          for (const loc of localList) {
            if (loc?.name) {
              combinedMap.set(loc.name.toLowerCase().trim(), loc);
            }
          }

          // 2. Overlay / update with canonical backend domain items
          for (const m of mapped) {
            const key = m.name.toLowerCase().trim();
            const existing = combinedMap.get(key);
            if (existing) {
              combinedMap.set(key, {
                ...existing,
                ...m,
                id: m.id || existing.id,
                nameservers: existing.nameservers && existing.nameservers.length > 0 ? existing.nameservers : m.nameservers,
                registrar: existing.registrar && !existing.registrar.includes('Provider (') ? existing.registrar : m.registrar,
                providerAccountId: m.providerAccountId || existing.providerAccountId,
                providerLabel: m.providerLabel || existing.providerLabel,
                notes: m.notes || existing.notes,
                logoUrl: existing.logoUrl || m.logoUrl,
              });
            } else {
              combinedMap.set(key, m);
            }
          }

          const combined = Array.from(combinedMap.values()).filter((d) => d?.name && !isInfrastructureDomain(d.name));
          await saveStoredDomains(combined);
          return combined;
        }
      } catch {
        // Backend offline / network unreachable -> graceful fallback to local cache
      }

      const stored = await getStoredDomains();
      const serverDoms = await getStoredServerDomains();
      const domainMap = new Map(stored.map((d) => [d.name.toLowerCase(), d]));
      let updated = [...stored];
      for (const sDom of serverDoms) {
        if (!domainMap.has(sDom.name.toLowerCase()) && !isInfrastructureDomain(sDom.name)) {
          updated.push(sDom);
        }
      }
      return updated.filter((d) => !isInfrastructureDomain(d.name));
    },
    { forceRefresh: options?.forceRefresh, ttlMs: 30_000 }
  );
}

export async function createDomain(data: {
  name: string;
  registrar?: string;
  autoRenew?: boolean;
  notes?: string;
  registrarProviderAccountId?: string;
  dnsProviderAccountId?: string;
}): Promise<DomainItem> {
  const cleanName = data.name.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const ext = cleanName.includes('.') ? `.${cleanName.split('.').pop()}` : '.com';
  const logoUrl = getDomainLogoUrl(cleanName);
  const realRegistrar = data.registrar?.trim() || 'Authoritative Registry';
  const realExpDate = new Date(Date.now() + 365 * 86400000).toISOString();
  const daysRemaining = 365;

  let backendId = `dom-${Date.now()}`;

  // 1. Send to Backend API
  try {
    const res = await apiPost<BackendDomain>('/domains', {
      domainName: cleanName,
      autoRenew: data.autoRenew ?? true,
      notes: data.notes || null,
      registrarProviderAccountId: isValidUuid(data.registrarProviderAccountId) ? data.registrarProviderAccountId : null,
      dnsProviderAccountId: isValidUuid(data.dnsProviderAccountId) ? data.dnsProviderAccountId : null,
    });
    if (res?.id) {
      backendId = res.id;
    }
  } catch {
    // Handled gracefully for offline
  }

  const newDomain: DomainItem = {
    id: backendId,
    name: cleanName,
    tld: ext,
    registrar: realRegistrar,
    autoRenew: data.autoRenew ?? true,
    registrationDate: new Date().toISOString().split('T')[0],
    expiresAt: realExpDate,
    daysRemaining,
    renewalPrice: ext === '.ai' ? 5800 : ext === '.io' ? 3200 : ext === '.in' ? 499 : 899,
    currency: '₹',
    status: 'safe',
    dnsProvider: 'Authoritative DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: [],
    tags: ['Live'],
    notes: data.notes,
    logoUrl,
  };

  const current = await getStoredDomains();
  const updated = [newDomain, ...current.filter((d) => d.name.toLowerCase() !== cleanName)];
  await saveStoredDomains(updated);
  invalidateCache('domains_list');
  invalidateCache('inventory_summary');

  // Background live RDAP/DNS telemetry sync
  (async () => {
    try {
      const live = await fetchLiveDomainDetails(cleanName);
      let updatedRegistrar = newDomain.registrar;
      if (live.registrar && (!data.registrar?.trim() || newDomain.registrar === 'Authoritative Registry')) {
        updatedRegistrar = live.registrar;
      }
      const updatedRegDate = live.registrationDate || newDomain.registrationDate;
      const updatedExpDate = live.expirationDate ? new Date(live.expirationDate).toISOString() : newDomain.expiresAt;
      const expTime = updatedExpDate ? new Date(updatedExpDate).getTime() : NaN;
      const calculatedDays = isNaN(expTime)
        ? newDomain.daysRemaining
        : Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)));

      const freshDomain: DomainItem = {
        ...newDomain,
        registrar: updatedRegistrar,
        registrationDate: updatedRegDate,
        expiresAt: updatedExpDate,
        daysRemaining: calculatedDays,
        nameservers: live.nameservers && live.nameservers.length > 0 ? live.nameservers : newDomain.nameservers,
      };

      await updateDomainRecord(newDomain.id, freshDomain);
    } catch {}
  })();

  return newDomain;
}

export async function updateDomainRecord(id: string, patch: Partial<DomainItem>): Promise<void> {
  const current = await getStoredDomains();
  const index = current.findIndex((d) => d.id === id || d.name.toLowerCase() === id.toLowerCase());
  if (index !== -1) {
    current[index] = { ...current[index], ...patch };
    await saveStoredDomains(current);
    invalidateCache('domains_list');
    invalidateCache('inventory_summary');
  }

  // Update on backend if tracked
  apiPatch(`/domains/${encodeURIComponent(id)}`, {
    autoRenew: patch.autoRenew,
    notes: patch.notes,
  }).catch(() => {});
}

export async function deleteDomain(id: string): Promise<void> {
  const current = await getStoredDomains();
  const updated = current.filter((d) => d.id !== id && d.name.toLowerCase() !== id.toLowerCase());
  await saveStoredDomains(updated);
  invalidateCache('domains_list');
  invalidateCache('inventory_summary');
  try {
    await apiDelete(`/domains/${encodeURIComponent(id)}`);
  } catch {}
}

export async function fetchDomainMetadata(id: string): Promise<DomainMetadataResponse | null> {
  try {
    return await apiGet<DomainMetadataResponse>(`/domains/${encodeURIComponent(id)}/metadata`);
  } catch {
    return null;
  }
}

export async function refreshDomainMetadata(id: string): Promise<any> {
  try {
    return await apiPost(`/domains/${encodeURIComponent(id)}/metadata/refresh`);
  } catch {
    return null;
  }
}

export async function importDomainsBatch(
  items: Array<{ name: string; registrar?: string; autoRenew?: boolean }>,
  options?: { updateExisting?: boolean; addNewOnly?: boolean }
): Promise<{ added: number; updated: number; skipped: number; total: number }> {
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const cleanName = item.name.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!cleanName || !cleanName.includes('.') || isInfrastructureDomain(cleanName)) {
      skipped++;
      continue;
    }
    try {
      await createDomain(item);
      added++;
    } catch {
      skipped++;
    }
  }

  return { added, updated, skipped, total: items.length };
}
