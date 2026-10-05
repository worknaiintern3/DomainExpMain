import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import { getUserItem, setUserItem, STORAGE_KEYS } from './storage';
import type { ProviderAccount, EmailAccount, CursorPage } from '../types';

export const DEFAULT_PROVIDER_ACCOUNTS: ProviderAccount[] = [
  {
    id: 'pa-hostinger-main',
    providerKey: 'hostinger',
    label: 'Hostinger Production VPS',
    externalAccountId: 'hst-77291',
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
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_PROVIDER_ACCOUNTS;
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
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_EMAIL_ACCOUNTS;
}

async function saveStoredEmailAccounts(items: EmailAccount[]): Promise<void> {
  try {
    await setUserItem(STORAGE_KEYS.EMAIL_ACCOUNTS_LIST, JSON.stringify(items));
  } catch {}
}

export async function fetchProviderAccountsList(): Promise<ProviderAccount[]> {
  try {
    const response = await apiGet<CursorPage<ProviderAccount>>('/provider-accounts?limit=100');
    if (response?.items && Array.isArray(response.items)) {
      await saveStoredProviderAccounts(response.items);
      return response.items;
    }
  } catch {
    // Graceful fallback to cached/default
  }
  return getStoredProviderAccounts();
}

export async function createProviderAccount(data: {
  providerKey: string;
  label: string;
  notes?: string;
  externalAccountId?: string;
  loginEmailAccountId?: string;
}): Promise<ProviderAccount> {
  try {
    const created = await apiPost<ProviderAccount>('/provider-accounts', data);
    if (created?.id) {
      const current = await getStoredProviderAccounts();
      const updated = [created, ...current.filter((p) => p.id !== created.id)];
      await saveStoredProviderAccounts(updated);
      return created;
    }
  } catch {
    // Offline fallback
  }

  const localItem: ProviderAccount = {
    id: `pa-${Date.now()}`,
    providerKey: data.providerKey.toLowerCase(),
    label: data.label,
    notes: data.notes || null,
    externalAccountId: data.externalAccountId || null,
    loginEmailAccountId: data.loginEmailAccountId || null,
    inventoryState: 'TRACKED',
    provenance: 'USER_ADDED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const current = await getStoredProviderAccounts();
  const updated = [localItem, ...current];
  await saveStoredProviderAccounts(updated);
  return localItem;
}

export async function deleteProviderAccount(id: string): Promise<void> {
  try {
    await apiDelete(`/provider-accounts/${encodeURIComponent(id)}`);
  } catch {}
  const current = await getStoredProviderAccounts();
  const updated = current.filter((p) => p.id !== id);
  await saveStoredProviderAccounts(updated);
}

export async function fetchEmailAccountsList(): Promise<EmailAccount[]> {
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
  return localItem;
}

export async function deleteEmailAccount(id: string): Promise<void> {
  try {
    await apiDelete(`/email-accounts/${encodeURIComponent(id)}`);
  } catch {}
  const current = await getStoredEmailAccounts();
  const updated = current.filter((e) => e.id !== id);
  await saveStoredEmailAccounts(updated);
}
