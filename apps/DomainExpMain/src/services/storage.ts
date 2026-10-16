import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memoryFallbackStore = new Map<string, string>();
const memoryCache = new Map<string, string>();

const CHUNK_SIZE = 1800;

export async function setItem(key: string, value: string): Promise<void> {
  memoryCache.set(key, value);

  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback to memory
    }
  }

  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        await SecureStore.deleteItemAsync(`${key}__chunks`).catch(() => {});
      } else {
        const totalChunks = Math.ceil(value.length / CHUNK_SIZE);
        await SecureStore.setItemAsync(`${key}__chunks`, String(totalChunks));
        for (let i = 0; i < totalChunks; i++) {
          const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunk);
        }
        await SecureStore.deleteItemAsync(key).catch(() => {});
      }
      return;
    }
  } catch {
    // If SecureStore throws or is unavailable
  }

  memoryFallbackStore.set(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) ?? null;
  }

  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          memoryCache.set(key, val);
          return val;
        }
        return null;
      }
    } catch {
      // Fallback to memory
    }
  }

  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      const chunksCountStr = await SecureStore.getItemAsync(`${key}__chunks`);
      if (chunksCountStr) {
        const count = parseInt(chunksCountStr, 10);
        if (!isNaN(count) && count > 0) {
          let full = '';
          for (let i = 0; i < count; i++) {
            const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
            if (chunk) full += chunk;
          }
          if (full) {
            memoryCache.set(key, full);
            return full;
          }
        }
      }
      const direct = await SecureStore.getItemAsync(key);
      if (direct !== null) {
        memoryCache.set(key, direct);
        return direct;
      }
    }
  } catch {
    // Fallback to memory
  }

  const fallback = memoryFallbackStore.get(key) ?? null;
  if (fallback !== null) memoryCache.set(key, fallback);
  return fallback;
}

export async function deleteItem(key: string): Promise<void> {
  memoryCache.delete(key);
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback to memory
    }
  }

  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      const chunksCountStr = await SecureStore.getItemAsync(`${key}__chunks`);
      if (chunksCountStr) {
        const count = parseInt(chunksCountStr, 10);
        if (!isNaN(count)) {
          for (let i = 0; i < count; i++) {
            await SecureStore.deleteItemAsync(`${key}__chunk_${i}`).catch(() => {});
          }
        }
        await SecureStore.deleteItemAsync(`${key}__chunks`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return;
    }
  } catch {
    // Fallback to memory
  }

  memoryFallbackStore.delete(key);
}

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'dp_access_token',
  REFRESH_TOKEN: 'dp_refresh_token',
  USER_DATA: 'dp_user_data',
  WORKSPACE_ID: 'dp_workspace_id',
  API_URL: 'dp_custom_api_url',
  SETTINGS: 'dp_app_settings',
  DOMAINS_LIST: 'dp_domains_list',
  SERVERS_LIST: 'dp_servers_list',
  APPLICATIONS_LIST: 'dp_applications_list',
  WEBSITES_LIST: 'dp_websites_list',
  PROVIDER_ACCOUNTS_LIST: 'dp_provider_accounts_list',
  EMAIL_ACCOUNTS_LIST: 'dp_email_accounts_list',
  ALERTS_LIST: 'dp_alerts_list',
  DISMISSED_ALERTS: 'dp_dismissed_alerts',
  DISMISSED_ACTIVITIES: 'dp_dismissed_activities',
  CONSOLE_ACCOUNT: 'dp_console_account',
  PROVIDER_TOKENS_MAP: 'dp_provider_tokens_map',
  EXPO_PUSH_TOKEN: 'dp_expo_push_token',
};

let currentActiveUserId: string | null = null;

export function setActiveUserId(userId: string | null): void {
  currentActiveUserId = userId;
}

export function getCurrentActiveUserId(): string | null {
  return currentActiveUserId;
}

export async function getActiveUserId(): Promise<string | null> {
  if (currentActiveUserId) return currentActiveUserId;
  try {
    const raw = await getItem(STORAGE_KEYS.USER_DATA);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) {
        currentActiveUserId = String(parsed.id);
        return currentActiveUserId;
      }
    }
  } catch {}
  return null;
}

export async function getUserItem(baseKey: string, explicitUserId?: string): Promise<string | null> {
  const uid = explicitUserId || (await getActiveUserId());
  if (uid) {
    return await getItem(`${baseKey}_${uid}`);
  }
  return null;
}

export async function setUserItem(baseKey: string, value: string, explicitUserId?: string): Promise<void> {
  const uid = explicitUserId || (await getActiveUserId());
  if (uid) {
    await setItem(`${baseKey}_${uid}`, value);
  }
}

export async function deleteUserItem(baseKey: string, explicitUserId?: string): Promise<void> {
  const uid = explicitUserId || (await getActiveUserId());
  if (uid) {
    await deleteItem(`${baseKey}_${uid}`);
  }
}

export async function clearUserData(userId?: string): Promise<void> {
  const uid = userId || (await getActiveUserId());
  const keysToClear = [
    STORAGE_KEYS.DOMAINS_LIST,
    STORAGE_KEYS.SERVERS_LIST,
    STORAGE_KEYS.APPLICATIONS_LIST,
    STORAGE_KEYS.WEBSITES_LIST,
    STORAGE_KEYS.ALERTS_LIST,
    STORAGE_KEYS.DISMISSED_ALERTS,
    STORAGE_KEYS.DISMISSED_ACTIVITIES,
    STORAGE_KEYS.CONSOLE_ACCOUNT,
    STORAGE_KEYS.PROVIDER_ACCOUNTS_LIST,
    STORAGE_KEYS.EMAIL_ACCOUNTS_LIST,
    STORAGE_KEYS.PROVIDER_TOKENS_MAP,
  ];

  await Promise.allSettled([
    ...keysToClear.map((k) => (uid ? deleteItem(`${k}_${uid}`) : Promise.resolve())),
    ...keysToClear.map((k) => deleteItem(k)),
  ]);
}

export const KNOWN_PROVIDER_TOKENS: Record<string, string> = {};

export async function saveProviderToken(idOrKey: string, token: string): Promise<void> {
  if (!idOrKey || !token) return;
  try {
    const raw = await getUserItem(STORAGE_KEYS.PROVIDER_TOKENS_MAP);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[idOrKey.trim().toLowerCase()] = token.trim();
    await setUserItem(STORAGE_KEYS.PROVIDER_TOKENS_MAP, JSON.stringify(map));
  } catch {}
}

export async function getProviderToken(idOrKey: string): Promise<string | null> {
  if (!idOrKey) return null;
  const cleanKey = idOrKey.trim().toLowerCase();
  try {
    const raw = await getUserItem(STORAGE_KEYS.PROVIDER_TOKENS_MAP);
    if (raw) {
      const map: Record<string, string> = JSON.parse(raw);
      if (map[cleanKey]) return map[cleanKey];
    }
  } catch {}
  return null;
}

export async function removeProviderToken(idOrKey: string): Promise<void> {
  if (!idOrKey) return;
  try {
    const raw = await getUserItem(STORAGE_KEYS.PROVIDER_TOKENS_MAP);
    if (!raw) return;
    const map: Record<string, string> = JSON.parse(raw);
    delete map[idOrKey.trim().toLowerCase()];
    await setUserItem(STORAGE_KEYS.PROVIDER_TOKENS_MAP, JSON.stringify(map));
  } catch {}
}


