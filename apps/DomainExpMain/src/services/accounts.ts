import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import { getUserItem, setUserItem, STORAGE_KEYS, saveProviderToken, removeProviderToken } from './storage';
import { fetchWithCache, invalidateCache } from './dataCache';
import type { ProviderAccount, EmailAccount, CursorPage } from '../types';

const isValidUuid = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));

export const DEFAULT_PROVIDER_ACCOUNTS: ProviderAccount[] = [
  {
    id: 'pa-hostinger-main',
    providerKey: 'hostinger',
    label: 'Hostinger Production VPS',
    externalAccountId: 'Ppr6lCPyr4xzrcdM8hnR5fMXSkd9Xiaq77C9dGWF8363d91b',
    loginEmailAccountId: 'ea-admin-01',
    notes: 'Primary Hostinger VPS and shared DNS portfolio',
    inventoryState: 'TRACKED',
    provenance: 'USER_ADDED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pa-cloudflare-edge',
    providerKey: 'cloudflare',
    label: 'Cloudflare Global DNS',
    externalAccountId: 'cf-zone-main',
    loginEmailAccountId: 'ea-admin-01',
    notes: 'Edge routing, CDN caching & DNSSEC',
    inventoryState: 'TRACKED',
    provenance: 'USER_ADDED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pa-aws-cloud',
    providerKey: 'aws',
    label: 'AWS Cloud Services',
    externalAccountId: 'aws-99381-root',
    loginEmailAccountId: 'ea-ops-02',
    notes: 'EC2, Route53, and S3 assets',
    inventoryState: 'TRACKED',
    provenance: 'USER_ADDED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pa-namecheap-reg',
    providerKey: 'namecheap',
    label: 'Namecheap Registrar',
    externalAccountId: 'nc-corp-88',
    loginEmailAccountId: 'ea-admin-01',
    notes: 'Corporate top-level domain registrations',
    inventoryState: 'TRACKED',
    provenance: 'USER_ADDED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_EMAIL_ACCOUNTS: EmailAccount[] = [
  {
    id: 'ea-admin-01',
    email: 'admin@domainpulse.com',
    label: 'Primary Infrastructure Admin',
    notes: 'Master login for root registrar accounts',
    inventoryState: 'TRACKED',
    provenance: 'USER_ADDED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ea-ops-02',
    email: 'ops@domainpulse.com',
    label: 'DevOps & Alerts Notifications',
    notes: 'Receives uptime and SSL expiry alerts',
    inventoryState: 'TRACKED',
    provenance: 'USER_ADDED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

async function getStoredProviderAccounts(): Promise<ProviderAccount[]> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.PROVIDER_ACCOUNTS_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

async function saveStoredProviderAccounts(items: ProviderAccount[]): Promise<void> {
  try {
    await setUserItem(STORAGE_KEYS.PROVIDER_ACCOUNTS_LIST, JSON.stringify(items));
  } catch {}
}

async function getStoredEmailAccounts(): Promise<EmailAccount[]> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.EMAIL_ACCOUNTS_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

async function saveStoredEmailAccounts(items: EmailAccount[]): Promise<void> {
  try {
    await setUserItem(STORAGE_KEYS.EMAIL_ACCOUNTS_LIST, JSON.stringify(items));
  } catch {}
}

export function deduplicateProviderAccounts(accounts: ProviderAccount[]): ProviderAccount[] {
  if (!accounts || accounts.length <= 1) return accounts || [];

  const map = new Map<string, ProviderAccount>();

  for (const acc of accounts) {
    if (!acc || !acc.id) continue;
    const cleanKey = (acc.providerKey || '').toLowerCase().trim();
    const cleanLabel = (acc.label || '').toLowerCase().trim();
    const groupKey = `${cleanKey}::${cleanLabel}`;

    if (!map.has(groupKey)) {
      map.set(groupKey, acc);
    } else {
      const existing = map.get(groupKey)!;
      const isExistingMock = existing.id.startsWith('pa-');
      const isCurrentMock = acc.id.startsWith('pa-');

      if (isExistingMock && !isCurrentMock) {
        map.set(groupKey, { ...acc, externalAccountId: acc.externalAccountId || existing.externalAccountId });
      } else if (!isExistingMock && isCurrentMock) {
        if (!existing.externalAccountId && acc.externalAccountId) {
          existing.externalAccountId = acc.externalAccountId;
        }
      } else {
        if (!existing.externalAccountId && acc.externalAccountId) {
          map.set(groupKey, acc);
        }
      }
    }
  }

  return Array.from(map.values());
}

export async function fetchProviderAccountsList(options?: { forceRefresh?: boolean }): Promise<ProviderAccount[]> {
  return fetchWithCache(
    'provider_accounts_list',
    async () => {
      try {
        const response = await apiGet<CursorPage<ProviderAccount>>('/provider-accounts?limit=100');
        if (response?.items && Array.isArray(response.items)) {
          const deduped = deduplicateProviderAccounts(response.items);
          await saveStoredProviderAccounts(deduped);
          return deduped;
        }
      } catch {
        // Graceful fallback to cached
      }
      const stored = await getStoredProviderAccounts();
      return deduplicateProviderAccounts(stored);
    },
    { ttlMs: 30000, forceRefresh: options?.forceRefresh }
  );
}

export async function createProviderAccount(data: {
  providerKey: string;
  label: string;
  notes?: string;
  externalAccountId?: string;
  loginEmailAccountId?: string;
}): Promise<ProviderAccount> {
  const cleanKey = data.providerKey.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const cleanLabel = data.label.trim();
  const token = data.externalAccountId?.trim();

  // Check if exact same account already exists to prevent duplicate cards
  const existingAccounts = await getStoredProviderAccounts();
  const existingMatch = existingAccounts.find((p) => {
    const sameKey = (p.providerKey || '').toLowerCase() === cleanKey;
    if (!sameKey) return false;
    // If both have tokens, check exact token match
    if (token && p.externalAccountId) {
      return p.externalAccountId.trim() === token && (p.label || '').trim().toLowerCase() === cleanLabel.toLowerCase();
    }
    // If neither has token, check exact label match
    if (!token && !p.externalAccountId && cleanLabel) {
      return (p.label || '').trim().toLowerCase() === cleanLabel.toLowerCase();
    }
    return false;
  });

  if (existingMatch) {
    if (token) {
      await saveProviderToken(existingMatch.id, token);
    }
    return existingMatch;
  }

  try {
    const created = await apiPost<ProviderAccount>('/provider-accounts', {
      providerKey: cleanKey,
      label: cleanLabel,
      notes: data.notes || null,
      externalAccountId: token || null,
      loginEmailAccountId: isValidUuid(data.loginEmailAccountId) ? data.loginEmailAccountId : null,
    });
    if (created?.id) {
      if (token) {
        await saveProviderToken(created.id, token);
      }
      const current = await getStoredProviderAccounts();
      const updated = deduplicateProviderAccounts([created, ...current.filter((p) => p.id !== created.id)]);
      await saveStoredProviderAccounts(updated);
      invalidateCache('provider_accounts_list');
      return created;
    }
  } catch {
    // Offline fallback
  }

  const localItem: ProviderAccount = {
    id: `pa-${Date.now()}`,
    providerKey: cleanKey,
    label: cleanLabel,
    notes: data.notes || null,
    externalAccountId: token || null,
    loginEmailAccountId: isValidUuid(data.loginEmailAccountId) && data.loginEmailAccountId ? data.loginEmailAccountId : null,
    inventoryState: 'TRACKED',
    provenance: 'USER_ADDED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (token) {
    await saveProviderToken(localItem.id, token);
  }

  const current = await getStoredProviderAccounts();
  const updated = [localItem, ...current];
  await saveStoredProviderAccounts(updated);
  invalidateCache('provider_accounts_list');
  return localItem;
}

export async function deleteProviderAccount(id: string): Promise<void> {
  try {
    await apiDelete(`/provider-accounts/${encodeURIComponent(id)}`);
  } catch {}
  await removeProviderToken(id);
  const current = await getStoredProviderAccounts();
  const updated = current.filter((p) => p.id !== id);
  await saveStoredProviderAccounts(updated);
  invalidateCache('provider_accounts_list');
}

export async function fetchEmailAccountsList(options?: { forceRefresh?: boolean }): Promise<EmailAccount[]> {
  return fetchWithCache(
    'email_accounts_list',
    async () => {
      try {
        const response = await apiGet<CursorPage<EmailAccount>>('/email-accounts?limit=100');
        if (response?.items && Array.isArray(response.items)) {
          await saveStoredEmailAccounts(response.items);
          return response.items;
        }
      } catch {
        // Fallback
      }
      return getStoredEmailAccounts();
    },
    { ttlMs: 30000, forceRefresh: options?.forceRefresh }
  );
}

export async function createEmailAccount(data: {
  email: string;
  label?: string;
  notes?: string;
}): Promise<EmailAccount> {
  try {
    const created = await apiPost<EmailAccount>('/email-accounts', data);
    if (created?.id) {
      const current = await getStoredEmailAccounts();
      const updated = [created, ...current.filter((e) => e.id !== created.id)];
      await saveStoredEmailAccounts(updated);
      invalidateCache('email_accounts_list');
      return created;
    }
  } catch {}

  const localItem: EmailAccount = {
    id: `ea-${Date.now()}`,
    email: data.email.toLowerCase().trim(),
    label: data.label || null,
    notes: data.notes || null,
    inventoryState: 'TRACKED',
    provenance: 'USER_ADDED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const current = await getStoredEmailAccounts();
  const updated = [localItem, ...current];
  await saveStoredEmailAccounts(updated);
  invalidateCache('email_accounts_list');
  return localItem;
}

export async function deleteEmailAccount(id: string): Promise<void> {
  try {
    await apiDelete(`/email-accounts/${encodeURIComponent(id)}`);
  } catch {}
  const current = await getStoredEmailAccounts();
  const updated = current.filter((e) => e.id !== id);
  await saveStoredEmailAccounts(updated);
  invalidateCache('email_accounts_list');
}
