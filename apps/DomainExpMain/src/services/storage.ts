import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memoryFallbackStore = new Map<string, string>();

const CHUNK_SIZE = 1800;

export async function setItem(key: string, value: string): Promise<void> {
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
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
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
          if (full) return full;
        }
      }
      const direct = await SecureStore.getItemAsync(key);
      if (direct !== null) return direct;
    }
  } catch {
    // Fallback to memory
  }

  return memoryFallbackStore.get(key) ?? null;
}

export async function deleteItem(key: string): Promise<void> {
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
    const userSpecificValue = await getItem(`${baseKey}_${uid}`);
    if (userSpecificValue !== null && userSpecificValue !== undefined) {
      return userSpecificValue;
    }
  }
  return null;
}

export async function setUserItem(baseKey: string, value: string, explicitUserId?: string): Promise<void> {
  const uid = explicitUserId || (await getActiveUserId());
  if (uid) {
    await setItem(`${baseKey}_${uid}`, value);
  } else {
    await setItem(baseKey, value);
  }
}

export async function deleteUserItem(baseKey: string, explicitUserId?: string): Promise<void> {
  const uid = explicitUserId || (await getActiveUserId());
  if (uid) {
    await deleteItem(`${baseKey}_${uid}`);
  }
  await deleteItem(baseKey);
}

export async function clearUserData(userId?: string): Promise<void> {
  const uid = userId || (await getActiveUserId());
  if (!uid) return;
  const keysToClear = [
    STORAGE_KEYS.DOMAINS_LIST,
    STORAGE_KEYS.SERVERS_LIST,
    STORAGE_KEYS.APPLICATIONS_LIST,
    STORAGE_KEYS.WEBSITES_LIST,
    STORAGE_KEYS.ALERTS_LIST,
    STORAGE_KEYS.DISMISSED_ALERTS,
    STORAGE_KEYS.DISMISSED_ACTIVITIES,
    STORAGE_KEYS.CONSOLE_ACCOUNT,
  ];

  await Promise.allSettled(
    keysToClear.map((k) => deleteItem(`${k}_${uid}`))
  );
}


