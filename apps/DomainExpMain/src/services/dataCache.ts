import { getCurrentActiveUserId } from './storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryDataCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

const DEFAULT_TTL_MS = 30_000; // 30 seconds

function getScopedKey(key: string): string {
  const uid = getCurrentActiveUserId() || 'global';
  return `${uid}:${key}`;
}

export function getCachedData<T>(key: string): T | null {
  const scopedKey = getScopedKey(key);
  const entry = memoryDataCache.get(scopedKey);
  if (!entry) return null;
  return entry.data as T;
}

export function setCachedData<T>(key: string, data: T): void {
  const scopedKey = getScopedKey(key);
  memoryDataCache.set(scopedKey, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateCache(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    memoryDataCache.clear();
    inFlightRequests.clear();
    return;
  }
  const uid = getCurrentActiveUserId() || 'global';
  const prefix = `${uid}:${keyOrPrefix}`;
  for (const k of memoryDataCache.keys()) {
    if (k.startsWith(prefix) || k.includes(keyOrPrefix)) {
      memoryDataCache.delete(k);
    }
  }
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttlMs?: number;
    forceRefresh?: boolean;
    onBackgroundUpdate?: (freshData: T) => void;
  } = {}
): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS, forceRefresh = false, onBackgroundUpdate } = options;
  const scopedKey = getScopedKey(key);
  const now = Date.now();
  const cached = memoryDataCache.get(scopedKey);

  // 1. If cache is fresh and not forcing refresh, return immediately (0ms)
  if (!forceRefresh && cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  // 2. Stale-While-Revalidate: If we have cached data, trigger background refresh without blocking
  if (!forceRefresh && cached && onBackgroundUpdate) {
    // Return stale data immediately so UI renders with 0ms delay
    const staleData = cached.data as T;

    // Run background fetch deduplicated
    if (!inFlightRequests.has(scopedKey)) {
      const bgPromise = fetcher()
        .then((fresh) => {
          memoryDataCache.set(scopedKey, { data: fresh, timestamp: Date.now() });
          onBackgroundUpdate(fresh);
          return fresh;
        })
        .catch(() => cached.data)
        .finally(() => {
          inFlightRequests.delete(scopedKey);
        });
      inFlightRequests.set(scopedKey, bgPromise);
    }

    return staleData;
  }

  // 3. Single-Flight Request Deduplication (Coalescing)
  // If an identical request is already running, piggyback on the existing promise!
  if (inFlightRequests.has(scopedKey)) {
    return inFlightRequests.get(scopedKey) as Promise<T>;
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      memoryDataCache.set(scopedKey, {
        data: result,
        timestamp: Date.now(),
      });
      return result;
    } finally {
      inFlightRequests.delete(scopedKey);
    }
  })();

  inFlightRequests.set(scopedKey, promise);
  return promise;
}
