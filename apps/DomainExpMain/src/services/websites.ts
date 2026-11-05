import { getUserItem, setUserItem, STORAGE_KEYS } from './storage';
import { getDomainLogoUrl } from './liveDomainLookup';
import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import { fetchWithCache, invalidateCache } from './dataCache';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { WebsiteItem, BackendApplication, CursorPage } from '../types';

export function normalizeWebsiteUrl(rawUrl: string): string {
  let clean = rawUrl.trim();
  if (!clean) return '';
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`;
  }
  return clean;
}

export function extractDomainFromUrl(rawUrl: string): string {
  try {
    const normalized = normalizeWebsiteUrl(rawUrl);
    const domain = normalized.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
    return domain.toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function isWebsiteItem(
  item: Partial<WebsiteItem> | Partial<BackendApplication> | null | undefined
): boolean {
  if (!item) return false;

  const kind = (item as any).kind;
  if (kind === 'MOBILE_APPLICATION') return false;

  const srv = (item as any).serverName;
  if (srv === 'Google Play Console') return false;

  const playUrl = (item as any).playStoreUrl || '';
  if (playUrl && playUrl.includes('play.google.com')) return false;

  const url = (item as any).url || (item as any).primaryUrl || '';
  if (url && (url.includes('play.google.com') || url.startsWith('https://com.') || url.startsWith('http://com.'))) {
    return false;
  }

  const pkg = ((item as any).packageId || (item as any).notes || '').trim();
  if (pkg && /^(com|in|org|net|io)\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(pkg)) {
    return false;
  }

  const name = ((item as any).name || '').trim();
  if (name.endsWith('.apk') || name.endsWith('.aab')) return false;

  return true;
}

export const WORKNAI_APPLICATION_WEBSITES: WebsiteItem[] = [
  {
    id: 'web-worknai',
    name: 'WorknAi Client Portal',
    url: 'https://worknai.com',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 22,
    tags: ['Corporate', 'Production', 'WorknAi'],
    notes: 'Official WorknAi corporate platform & client service hub',
    createdAt: '2026-09-15T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-hrms',
    name: 'WorknAI HRMS',
    url: 'https://hrms.worknai.com',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 28,
    tags: ['HRMS', 'Enterprise', 'Internal'],
    notes: 'Human Resource, Payroll & Workforce Management Suite',
    createdAt: '2026-09-20T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-aitourism',
    name: 'AiTourism - Travel & Cabs',
    url: 'https://aitourism.in',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 31,
    tags: ['Travel', 'AI', 'Cabs'],
    notes: 'AI-Powered Tourism, Itinerary and Cab Booking Portal',
    createdAt: '2026-09-17T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-anywork',
    name: 'AnyWork Services',
    url: 'https://anyworkservices.com',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 24,
    tags: ['Services', 'Marketplace', 'On-Demand'],
    notes: 'Smart On-Demand Professional Services Platform',
    createdAt: '2026-09-07T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-blooddonation',
    name: 'Blood Donation Online',
    url: 'https://blooddonation.online',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 19,
    tags: ['Healthcare', 'Emergency', 'Community'],
    notes: 'Emergency Blood Donor Discovery & Volunteer Network',
    createdAt: '2026-09-12T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-goairclass',
    name: 'GoAirClass Online',
    url: 'https://goairclass.online',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 35,
    tags: ['Education', 'Aviation', 'Live Classes'],
    notes: 'Aviation Virtual Classrooms & Professional Training',
    createdAt: '2026-06-24T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-gymproplus',
    name: 'GymProPlus',
    url: 'https://gymproplus.com',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 26,
    tags: ['Fitness', 'Gym', 'SaaS'],
    notes: 'Gym Management, Membership & Fitness Tracker Web App',
    createdAt: '2026-08-19T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-healthyfood',
    name: 'HealthyFood.Cafe',
    url: 'https://healthyfood.cafe',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 21,
    tags: ['Food', 'Nutrition', 'Ecommerce'],
    notes: 'Nutritious Meal Plans & Healthy Dining Order Portal',
    createdAt: '2026-08-26T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-itjobx',
    name: 'ITJobX',
    url: 'https://itjobx.com',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 27,
    tags: ['Jobs', 'Tech', 'Hiring'],
    notes: 'Tech Career, IT Recruitment & Engineering Job Board',
    createdAt: '2026-08-29T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-inquiryexperts',
    name: 'Inquiry Experts',
    url: 'https://inquiryexperts.app',
    category: 'Client',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 33,
    tags: ['Client', 'LeadGen', 'Support'],
    notes: 'Client Inquiries, Lead Generation & Expert Response System',
    createdAt: '2026-09-18T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-lovenzea',
    name: 'LovenZea',
    url: 'https://lovenzea.online',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 29,
    tags: ['Social', 'Matchmaking', 'Community'],
    notes: 'Modern Social Relationship & Connection Platform',
    createdAt: '2026-09-28T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-mobilepaycafe',
    name: 'MobilePay.Cafe',
    url: 'https://mobilepay.cafe',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 18,
    tags: ['Fintech', 'Payments', 'POS'],
    notes: 'Instant Mobile Payments & Contactless Merchant Checkout',
    createdAt: '2026-09-07T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-namastey',
    name: 'Namastey Meditation',
    url: 'https://namasteyyy.com',
    category: 'Personal',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 25,
    tags: ['Wellness', 'Meditation', 'Yoga'],
    notes: 'Mindfulness, Breathing Exercises & Meditation Experience',
    createdAt: '2026-06-27T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-chess',
    name: 'OMENXIS Chess',
    url: 'https://omenxis.com',
    category: 'Personal',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 22,
    tags: ['Gaming', 'Chess', 'Multiplayer'],
    notes: 'Real-time Competitive Multiplayer Chess Arena',
    createdAt: '2026-06-23T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-onlinego',
    name: 'Online Go',
    url: 'https://onlinego.in',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 24,
    tags: ['Delivery', 'QuickCommerce', 'Logistics'],
    notes: 'Hyperlocal Rapid Grocery & Daily Essentials Hub',
    createdAt: '2026-08-24T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-onlinegologistics',
    name: 'OnlineGo Logistics',
    url: 'https://onlinegologistics.com',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 30,
    tags: ['Logistics', 'Fleet', 'SupplyChain'],
    notes: 'Freight Management, Fleet Dispatch & Tracking Portal',
    createdAt: '2026-09-18T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'web-pginfo',
    name: 'PGinfo Online',
    url: 'https://pginfo.online',
    category: 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 23,
    tags: ['Accommodation', 'Hostels', 'Discovery'],
    notes: 'Paying Guest, Hostel & Student Living Finder Portal',
    createdAt: '2026-09-27T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  },
];

export function getFriendlyBrandName(domain: string): string {
  const base = domain.replace(/^www\./i, '').split('.')[0];
  if (!base) return domain;
  const known: Record<string, string> = {
    worknai: 'WorknAi Client Portal',
    worknaihrms: 'WorknAI HRMS',
    billpay: 'BillPay Business',
    robosinfo: 'RobosInfo Portal',
    aitourism: 'AiTourism Travel & Cabs',
    anyworkservices: 'AnyWork Services',
    blooddonation: 'Blood Donation Online',
    goairclass: 'GoAirClass Online',
    gymproplus: 'GymProPlus',
    healthyfood: 'HealthyFood Cafe',
    itjobx: 'ITJobX Tech Jobs',
    inquiryexperts: 'Inquiry Experts',
    lovenzea: 'LovenZea Social',
    mobilepay: 'MobilePay Cafe',
    namasteyyy: 'Namastey Meditation',
    omenxis: 'OMENXIS Chess Arena',
    onlinego: 'Online Go Hyperlocal',
    onlinegologistics: 'OnlineGo Logistics',
    pginfo: 'PGinfo Online Living',
  };
  const key = base.toLowerCase();
  if (known[key]) return known[key];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function getDeletedWebsiteKeys(): Promise<string[]> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.DELETED_WEBSITES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((k) => String(k).trim().toLowerCase()).filter(Boolean);
      }
    }
  } catch {}
  return [];
}

export async function addDeletedWebsiteKeys(keys: string[]): Promise<void> {
  try {
    const current = await getDeletedWebsiteKeys();
    const cleanKeys = keys.map((k) => String(k).trim().toLowerCase()).filter(Boolean);
    const merged = Array.from(new Set([...current, ...cleanKeys]));
    await setUserItem(STORAGE_KEYS.DELETED_WEBSITES, JSON.stringify(merged));
  } catch {}
}

export async function removeDeletedWebsiteKeys(keys: string[]): Promise<void> {
  try {
    const current = await getDeletedWebsiteKeys();
    const toRemove = new Set(keys.map((k) => String(k).trim().toLowerCase()).filter(Boolean));
    const filtered = current.filter((k) => !toRemove.has(k));
    await setUserItem(STORAGE_KEYS.DELETED_WEBSITES, JSON.stringify(filtered));
  } catch {}
}

export async function syncDiscoveredWebsites(domains: string[], providerLabel: string): Promise<WebsiteItem[]> {
  const deletedKeys = new Set(await getDeletedWebsiteKeys());
  const current = await getStoredWebsites();
  const webMap = new Map<string, WebsiteItem>();
  for (const w of current) {
    const d = extractDomainFromUrl(w.url);
    if (d) webMap.set(d.toLowerCase(), w);
  }

  let hasChanges = false;
  for (const dom of domains) {
    const cleanDom = dom.toLowerCase().trim();
    if (!cleanDom || !cleanDom.includes('.')) continue;
    if (deletedKeys.has(cleanDom) || deletedKeys.has(`https://${cleanDom}`) || deletedKeys.has(`http://${cleanDom}`)) {
      continue;
    }

    if (!webMap.has(cleanDom)) {
      const siteName = getFriendlyBrandName(cleanDom);
      const url = `https://${cleanDom}`;
      const newSite: WebsiteItem = {
        id: `web-${cleanDom.replace(/[^a-z0-9]/g, '-')}`,
        name: siteName,
        url,
        category: 'Production',
        status: 'healthy',
        sslStatus: 'active',
        httpStatus: '200 OK',
        responseTimeMs: Math.floor(Math.random() * 20) + 18,
        logoUrl: getDomainLogoUrl(cleanDom),
        tags: [providerLabel, 'Production', 'Synced'],
        notes: `Live website hosted on ${providerLabel} (${cleanDom})`,
        createdAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
      };
      webMap.set(cleanDom, newSite);
      hasChanges = true;

      apiPost<BackendApplication>('/applications', {
        name: siteName,
        kind: 'WEBSITE',
        primaryUrl: url,
        notes: `Discovered from ${providerLabel}`,
      }).catch(() => {});
    }
  }

  const updatedList = Array.from(webMap.values()).filter((w) => {
    const wId = (w.id || '').trim().toLowerCase();
    const wName = (w.name || '').trim().toLowerCase();
    const wUrl = (w.url || '').trim().toLowerCase();
    const wDom = extractDomainFromUrl(w.url).trim().toLowerCase();
    return !deletedKeys.has(wId) && !deletedKeys.has(wName) && !deletedKeys.has(wUrl) && !deletedKeys.has(wDom);
  });

  if (hasChanges || current.length === 0) {
    await saveStoredWebsites(updatedList);
    invalidateCache('websites_list');
  }
  return updatedList;
}

export async function getStoredWebsites(): Promise<WebsiteItem[]> {
  try {
    const deletedKeys = new Set(await getDeletedWebsiteKeys());
    const raw = await getUserItem(STORAGE_KEYS.WEBSITES_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed
          .filter(isWebsiteItem)
          .filter((w) => {
            const wId = (w.id || '').trim().toLowerCase();
            const wName = (w.name || '').trim().toLowerCase();
            const wUrl = (w.url || '').trim().toLowerCase();
            const wDom = extractDomainFromUrl(w.url).trim().toLowerCase();
            return !deletedKeys.has(wId) && !deletedKeys.has(wName) && !deletedKeys.has(wUrl) && !deletedKeys.has(wDom);
          });
        return cleaned;
      }
    }
  } catch {}
  return [];
}

export async function saveStoredWebsites(items: WebsiteItem[]): Promise<void> {
  try {
    const deletedKeys = new Set(await getDeletedWebsiteKeys());
    const websitesOnly = items
      .filter(isWebsiteItem)
      .filter((w) => {
        const wId = (w.id || '').trim().toLowerCase();
        const wName = (w.name || '').trim().toLowerCase();
        const wUrl = (w.url || '').trim().toLowerCase();
        const wDom = extractDomainFromUrl(w.url).trim().toLowerCase();
        return !deletedKeys.has(wId) && !deletedKeys.has(wName) && !deletedKeys.has(wUrl) && !deletedKeys.has(wDom);
      });
    await setUserItem(STORAGE_KEYS.WEBSITES_LIST, JSON.stringify(websitesOnly));
  } catch {}
}

export async function fetchWebsitesList(options?: { forceRefresh?: boolean }): Promise<WebsiteItem[]> {
  return fetchWithCache(
    'websites_list',
    async () => {
      const deletedKeysList = await getDeletedWebsiteKeys();
      const deletedKeys = new Set(deletedKeysList);

      const localList = (await getStoredWebsites()).filter(isWebsiteItem).filter((w) => {
        const wId = (w.id || '').trim().toLowerCase();
        const wName = (w.name || '').trim().toLowerCase();
        const wUrl = (w.url || '').trim().toLowerCase();
        const wDom = extractDomainFromUrl(w.url).trim().toLowerCase();
        return !deletedKeys.has(wId) && !deletedKeys.has(wName) && !deletedKeys.has(wUrl) && !deletedKeys.has(wDom);
      });

      try {
        const [appRes, domRes] = await Promise.all([
          apiGet<CursorPage<BackendApplication>>('/applications?limit=100').catch(() => null),
          apiGet<CursorPage<any>>('/domains?limit=100').catch(() => null),
        ]);

        const webMap = new Map<string, WebsiteItem>();

        // 1. Standalone web applications from backend
        if (appRes?.items && Array.isArray(appRes.items)) {
          const websiteAppsOnly = appRes.items.filter(isWebsiteItem);
          for (const a of websiteAppsOnly) {
            // Strictly exclude soft-deleted or archived applications
            if (a.inventoryState === 'ARCHIVED') continue;

            const url = normalizeWebsiteUrl(a.primaryUrl || `https://${a.name}`);
            const domain = extractDomainFromUrl(url);
            if (!domain || domain.includes('play.google.com') || domain.startsWith('com.')) continue;

            const aId = (a.id || '').trim().toLowerCase();
            const aName = (a.name || '').trim().toLowerCase();
            const aUrl = url.trim().toLowerCase();
            const aDom = domain.toLowerCase();
            const aRawUrl = (a.primaryUrl || '').trim().toLowerCase();

            if (
              deletedKeys.has(aId) ||
              deletedKeys.has(aName) ||
              deletedKeys.has(aUrl) ||
              deletedKeys.has(aDom) ||
              (aRawUrl && deletedKeys.has(aRawUrl))
            ) {
              continue;
            }

            webMap.set(aDom, {
              id: a.id,
              name: a.name,
              url,
              category: a.kind === 'WEBSITE' ? 'Production' : a.kind === 'WEB_APPLICATION' ? 'Production' : 'Client',
              status: 'healthy',
              sslStatus: 'active',
              httpStatus: '200 OK',
              responseTimeMs: Math.floor(Math.random() * 20) + 15,
              logoUrl: getDomainLogoUrl(domain),
              tags: [a.kind ? a.kind.split('_').join(' ') : 'Web'],
              notes: a.notes || '',
              createdAt: a.createdAt,
              lastCheckedAt: a.updatedAt,
            });
          }
        }

        // 2. Domains as live production websites
        if (domRes?.items && Array.isArray(domRes.items)) {
          for (const d of domRes.items) {
            if (d.inventoryState === 'ARCHIVED') continue;
            const dom = (d.domainName || '').toLowerCase().trim();
            if (!dom || webMap.has(dom)) continue;

            const dId = (d.id || '').trim().toLowerCase();
            const dName = getFriendlyBrandName(dom).trim().toLowerCase();
            const dUrl = `https://${dom}`.toLowerCase();

            if (
              deletedKeys.has(dId) ||
              deletedKeys.has(dom) ||
              deletedKeys.has(dName) ||
              deletedKeys.has(dUrl) ||
              deletedKeys.has(`http://${dom}`.toLowerCase())
            ) {
              continue;
            }

            webMap.set(dom, {
              id: d.id,
              name: getFriendlyBrandName(dom),
              url: `https://${dom}`,
              category: 'Production',
              status: 'healthy',
              sslStatus: 'active',
              httpStatus: '200 OK',
              responseTimeMs: 24,
              logoUrl: getDomainLogoUrl(dom),
              tags: ['Hostinger Domain', 'Production'],
              notes: d.notes || undefined,
              createdAt: d.createdAt,
              lastCheckedAt: d.updatedAt,
            });
          }
        }

        // 3. Merge local websites, preserving any custom user updates
        for (const loc of localList) {
          if (!isWebsiteItem(loc)) continue;
          const dom = extractDomainFromUrl(loc.url).toLowerCase();
          if (!dom) continue;

          const locId = (loc.id || '').trim().toLowerCase();
          const locName = (loc.name || '').trim().toLowerCase();
          const locUrl = (loc.url || '').trim().toLowerCase();

          if (
            deletedKeys.has(locId) ||
            deletedKeys.has(locName) ||
            deletedKeys.has(locUrl) ||
            deletedKeys.has(dom)
          ) {
            continue;
          }

          if (webMap.has(dom)) {
            const existing = webMap.get(dom)!;
            webMap.set(dom, {
              ...existing,
              name: loc.name || existing.name,
              category: loc.category || existing.category,
              notes: loc.notes !== undefined ? loc.notes : existing.notes,
              logoUrl: loc.logoUrl || existing.logoUrl,
              url: loc.url || existing.url,
            });
          } else {
            webMap.set(dom, loc);
          }
        }

        const mergedWebsites = Array.from(webMap.values()).filter((w) => {
          const wId = (w.id || '').trim().toLowerCase();
          const wName = (w.name || '').trim().toLowerCase();
          const wUrl = (w.url || '').trim().toLowerCase();
          const wDom = extractDomainFromUrl(w.url).trim().toLowerCase();
          return !deletedKeys.has(wId) && !deletedKeys.has(wName) && !deletedKeys.has(wUrl) && !deletedKeys.has(wDom);
        });

        await saveStoredWebsites(mergedWebsites);
        return mergedWebsites;
      } catch {
        // Offline fallback
      }

      return localList;
    },
    { ttlMs: 30000, forceRefresh: options?.forceRefresh }
  );
}

export async function createWebsite(data: {
  name: string;
  url: string;
  category?: 'Production' | 'Staging' | 'Personal' | 'Client' | 'Tools';
  notes?: string;
  tags?: string[];
}): Promise<WebsiteItem> {
  const normalizedUrl = normalizeWebsiteUrl(data.url);
  const domain = extractDomainFromUrl(normalizedUrl);
  const logoUrl = getDomainLogoUrl(domain);
  const cleanName = data.name.trim() || domain || 'My Website';

  // Remove from deleted tombstones if re-created
  await removeDeletedWebsiteKeys([
    cleanName,
    domain,
    normalizedUrl,
    normalizedUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
  ]);

  let backendId = `web-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const isValidUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(normalizedUrl);
  try {
    const res = await apiPost<BackendApplication>('/applications', {
      name: cleanName,
      kind: 'WEBSITE',
      primaryUrl: isValidUrl ? normalizedUrl : null,
      notes: data.notes?.trim() || null,
    });
    if (res?.id) {
      backendId = res.id;
    }
  } catch {}

  const newWebsite: WebsiteItem = {
    id: backendId,
    name: cleanName,
    url: normalizedUrl,
    category: data.category || 'Production',
    status: 'healthy',
    sslStatus: 'active',
    httpStatus: '200 OK',
    responseTimeMs: 24,
    logoUrl,
    tags: data.tags || ['Web'],
    notes: data.notes?.trim() || '',
    createdAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
  };

  const current = await getStoredWebsites();
  const updated = [
    newWebsite,
    ...current.filter((w) => w.url.toLowerCase() !== normalizedUrl.toLowerCase() && w.id !== backendId),
  ];
  await saveStoredWebsites(updated);
  invalidateCache('websites_list');
  return newWebsite;
}

export async function updateWebsite(id: string, patch: Partial<WebsiteItem>): Promise<WebsiteItem | null> {
  const current = await getStoredWebsites();
  const index = current.findIndex((w) => w.id === id);
  if (index === -1) return null;

  if (patch.url) {
    patch.url = normalizeWebsiteUrl(patch.url);
    const domain = extractDomainFromUrl(patch.url);
    patch.logoUrl = getDomainLogoUrl(domain);
  }

  // Remove new identifying values from deleted tombstones
  const unblockKeys = [
    patch.name,
    patch.url,
    patch.url ? extractDomainFromUrl(patch.url) : '',
  ].filter(Boolean) as string[];
  if (unblockKeys.length > 0) {
    await removeDeletedWebsiteKeys(unblockKeys);
  }

  const updated: WebsiteItem = {
    ...current[index],
    ...patch,
    lastCheckedAt: new Date().toISOString(),
  };

  current[index] = updated;
  await saveStoredWebsites(current);
  invalidateCache('websites_list');

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) {
    const isValidUrl = patch.url ? /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(patch.url) : false;
    apiPatch(`/applications/${encodeURIComponent(id)}`, {
      name: patch.name ? patch.name.trim() : undefined,
      primaryUrl: isValidUrl ? patch.url : undefined,
      notes: patch.notes !== undefined ? patch.notes : undefined,
    }).catch(() => {});
  }

  return updated;
}

export async function deleteWebsite(id: string, name?: string, url?: string): Promise<void> {
  const current = await getStoredWebsites();
  const matched = current.find((w) => w.id === id || (url && w.url === url) || (name && w.name === name));

  const siteUrl = url || matched?.url || '';
  const siteName = name || matched?.name || '';
  const domain = siteUrl ? extractDomainFromUrl(siteUrl) : '';
  const cleanId = (id || '').trim().toLowerCase();
  const cleanName = siteName.trim().toLowerCase();
  const cleanUrl = siteUrl.trim().toLowerCase();
  const cleanDomain = domain.trim().toLowerCase();

  // 1. Tombstone all identifying keys permanently
  const keysToTombstone = [cleanId, cleanName, cleanUrl, cleanDomain].filter(Boolean);
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    keysToTombstone.push(cleanUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, ''));
  }
  await addDeletedWebsiteKeys(keysToTombstone);

  // 2. Remove from local stored websites list
  const tombstoneSet = new Set(keysToTombstone);
  const updated = current.filter((w) => {
    const wId = (w.id || '').trim().toLowerCase();
    const wName = (w.name || '').trim().toLowerCase();
    const wUrl = (w.url || '').trim().toLowerCase();
    const wDom = extractDomainFromUrl(w.url).trim().toLowerCase();
    return !tombstoneSet.has(wId) && !tombstoneSet.has(wName) && !tombstoneSet.has(wUrl) && !tombstoneSet.has(wDom);
  });
  await saveStoredWebsites(updated);
  invalidateCache('websites_list');

  // 3. Direct backend archive if ID is a UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) {
    await apiDelete(`/applications/${encodeURIComponent(id)}`).catch(() => {});
  }

  // 4. Query backend applications and archive any record that matches this website
  try {
    const appRes = await apiGet<CursorPage<BackendApplication>>('/applications?limit=100').catch(() => null);
    if (appRes?.items && Array.isArray(appRes.items)) {
      const matches = appRes.items.filter((a) => {
        const aId = (a.id || '').trim().toLowerCase();
        const aName = (a.name || '').trim().toLowerCase();
        const aUrl = (a.primaryUrl || '').trim().toLowerCase();
        const aDom = aUrl ? extractDomainFromUrl(aUrl).trim().toLowerCase() : '';
        return (
          tombstoneSet.has(aId) ||
          tombstoneSet.has(aName) ||
          (aUrl && tombstoneSet.has(aUrl)) ||
          (aDom && tombstoneSet.has(aDom))
        );
      });
      await Promise.allSettled(
        matches.map((m) => apiDelete(`/applications/${encodeURIComponent(m.id)}`).catch(() => {}))
      );
    }
  } catch {}
}

export async function openWebsiteInBrowser(rawUrl: string): Promise<boolean> {
  const normalized = normalizeWebsiteUrl(rawUrl);
  if (!normalized) return false;

  try {
    try {
      await WebBrowser.warmUpAsync();
    } catch {}

    const result = await WebBrowser.openBrowserAsync(normalized, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      toolbarColor: '#0f172a',
      controlsColor: '#38bdf8',
      showTitle: true,
      enableBarCollapsing: false,
      createTask: false,
      showInRecents: false,
      dismissButtonStyle: 'close',
    });

    try {
      await WebBrowser.coolDownAsync();
    } catch {}

    return result.type !== 'cancel';
  } catch {
    try {
      await WebBrowser.coolDownAsync();
    } catch {}
    try {
      const canOpen = await Linking.canOpenURL(normalized);
      if (canOpen) {
        await Linking.openURL(normalized);
        return true;
      }
    } catch {}
  }
  return false;
}
