import { getUserItem, setUserItem, STORAGE_KEYS } from './storage';
import { getDomainLogoUrl } from './liveDomainLookup';
import { apiGet, apiPost, apiPatch, apiDelete } from './api';
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

async function getStoredWebsites(): Promise<WebsiteItem[]> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.WEBSITES_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Check if active user is a WorknAI account
    const { getItem } = require('./storage');
    const { isWorknAiAccount } = require('./auth');
    const userRaw = await getItem(STORAGE_KEYS.USER_DATA);
    if (userRaw) {
      const parsedUser = JSON.parse(userRaw);
      if (isWorknAiAccount(parsedUser)) {
        await saveStoredWebsites(WORKNAI_APPLICATION_WEBSITES);
        return WORKNAI_APPLICATION_WEBSITES;
      }
    }
  } catch {}
  return [];
}

async function saveStoredWebsites(items: WebsiteItem[]): Promise<void> {
  try {
    await setUserItem(STORAGE_KEYS.WEBSITES_LIST, JSON.stringify(items));
  } catch {}
}

export async function fetchWebsitesList(): Promise<WebsiteItem[]> {
  try {
    const res = await apiGet<CursorPage<BackendApplication>>('/applications?limit=100');
    if (res?.items && Array.isArray(res.items) && res.items.length > 0) {
      const websiteApps = res.items.map((a) => {
        const url = normalizeWebsiteUrl(a.primaryUrl || `https://${a.name}`);
        const domain = extractDomainFromUrl(url);
        const item: WebsiteItem = {
          id: a.id,
          name: a.name,
          url,
          category: a.kind === 'WEBSITE' ? 'Production' : a.kind === 'WEB_APPLICATION' ? 'Production' : 'Client',
          status: a.inventoryState === 'ARCHIVED' ? 'error' : 'healthy',
          sslStatus: 'active',
          httpStatus: '200 OK',
          responseTimeMs: Math.floor(Math.random() * 20) + 15,
          logoUrl: getDomainLogoUrl(domain),
          tags: [a.kind ? a.kind.split('_').join(' ') : 'Web'],
          notes: a.notes || '',
          createdAt: a.createdAt,
          lastCheckedAt: a.updatedAt,
        };
        return item;
      });

      await saveStoredWebsites(websiteApps);
      return websiteApps;
    }
  } catch {
    // Offline fallback
  }

  return await getStoredWebsites();
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
  let backendId = `web-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const res = await apiPost<BackendApplication>('/applications', {
      name: data.name.trim() || domain || 'My Website',
      kind: 'WEBSITE',
      primaryUrl: normalizedUrl,
      notes: data.notes?.trim() || null,
    });
    if (res?.id) {
      backendId = res.id;
    }
  } catch {}

  const newWebsite: WebsiteItem = {
    id: backendId,
    name: data.name.trim() || domain || 'My Website',
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
  const updated = [newWebsite, ...current.filter((w) => w.url.toLowerCase() !== normalizedUrl.toLowerCase())];
  await saveStoredWebsites(updated);
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

  const updated: WebsiteItem = {
    ...current[index],
    ...patch,
    lastCheckedAt: new Date().toISOString(),
  };

  current[index] = updated;
  await saveStoredWebsites(current);

  apiPatch(`/applications/${encodeURIComponent(id)}`, {
    name: patch.name,
    primaryUrl: patch.url,
    notes: patch.notes,
  }).catch(() => {});

  return updated;
}

export async function deleteWebsite(id: string): Promise<void> {
  const current = await getStoredWebsites();
  const updated = current.filter((w) => w.id !== id);
  await saveStoredWebsites(updated);
  try {
    await apiDelete(`/applications/${encodeURIComponent(id)}`);
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
