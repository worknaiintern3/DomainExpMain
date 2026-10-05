import { API_CONFIG } from '../constants/config';
import { getItem, setItem, deleteItem, STORAGE_KEYS } from './storage';

export class ApiError extends Error {
  readonly status: number;
  readonly title: string;

  constructor(status: number, title: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface ApiRequestOptions {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  readonly workspaceId?: string;
  readonly auth?: boolean;
  readonly retryOnUnauthorized?: boolean;
}

let cachedAccessToken: string | null = null;
let cachedWorkspaceId: string | undefined;
let customApiUrl: string | null = null;
let inflightRefresh: Promise<string | null> | null = null;

export function setApiAccessToken(token: string | null): void {
  cachedAccessToken = token;
}

export function setApiWorkspaceId(id: string | undefined): void {
  cachedWorkspaceId = id;
}

export async function setCustomApiUrl(url: string | null): Promise<void> {
  customApiUrl = url;
  if (url) {
    await setItem(STORAGE_KEYS.API_URL, url);
  } else {
    await deleteItem(STORAGE_KEYS.API_URL);
  }
}

function decodeBase64(input: string): string {
  if (typeof atob === 'function') {
    return atob(input);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 string');
  }
  for (let bc = 0, bs = 0, buffer, idx = 0; (buffer = str.charAt(idx++)); ) {
    const charIndex = chars.indexOf(buffer);
    if (~charIndex) {
      bs = bc % 4 ? bs * 64 + charIndex : charIndex;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }
  }
  return output;
}

export function isJwtExpired(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return true;
  const parts = token.split('.');
  if (parts.length !== 3) return true;
  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = decodeBase64(base64);
    const parsed = JSON.parse(jsonStr) as { exp?: number };
    if (!parsed || typeof parsed.exp !== 'number') return true;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return parsed.exp <= nowSeconds + 15;
  } catch {
    return true;
  }
}

export function getEffectiveApiUrl(): string {
  return (customApiUrl || API_CONFIG.DEFAULT_API_URL).replace(/\/+$/, '');
}

export async function bootstrapMobileSession(email?: string): Promise<boolean> {
  try {
    const baseUrl = getEffectiveApiUrl();
    const response = await fetch(`${baseUrl}/mobile/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email: email || 'vrd@gmail.com' }),
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as {
      accessToken: string;
      accessTokenExpiresAt: string;
      refreshToken: string;
      workspaceId: string;
      user: { id: string; email: string; displayName: string | null };
    };

    if (data?.accessToken) {
      cachedAccessToken = data.accessToken;
      cachedWorkspaceId = data.workspaceId;
      await setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      if (data.refreshToken) {
        await setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      }
      if (data.workspaceId) {
        await setItem(STORAGE_KEYS.WORKSPACE_ID, data.workspaceId);
      }
      if (data.user) {
        await setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
        const { setActiveUserId } = require('./storage');
        setActiveUserId(data.user.id);
      }
      return true;
    }
  } catch {
    // Network unreachable / offline
  }
  return false;
}

export async function initApiClient(): Promise<void> {
  const savedUrl = await getItem(STORAGE_KEYS.API_URL);
  if (savedUrl) {
    customApiUrl = savedUrl;
  }

  const token = await getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token && !isJwtExpired(token)) {
    cachedAccessToken = token;
  } else {
    cachedAccessToken = null;
    await deleteItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  const wsId = await getItem(STORAGE_KEYS.WORKSPACE_ID);
  if (wsId) {
    cachedWorkspaceId = wsId;
  }

  // Auto-bootstrap authentic workspace session if needed or if token was expired
  if (!cachedAccessToken) {
    await bootstrapMobileSession();
  }
}

function resolveUrl(path: string): string {
  const baseUrl = getEffectiveApiUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

async function runSingleFlightRefresh(): Promise<string | null> {
  if (inflightRefresh !== null) {
    return inflightRefresh;
  }

  inflightRefresh = (async () => {
    try {
      const refreshToken = await getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        const response = await fetch(resolveUrl('/auth/refresh'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            accessToken: string;
            refreshToken: string;
          };
          cachedAccessToken = data.accessToken;
          await setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
          await setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
          return data.accessToken;
        }
      }

      // Refresh token failed or expired -> re-bootstrap fresh 30-day session
      await deleteItem(STORAGE_KEYS.ACCESS_TOKEN);
      await deleteItem(STORAGE_KEYS.REFRESH_TOKEN);
      cachedAccessToken = null;
      const bootstrapped = await bootstrapMobileSession();
      return bootstrapped ? cachedAccessToken : null;
    } catch {
      const bootstrapped = await bootstrapMobileSession();
      return bootstrapped ? cachedAccessToken : null;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method: HttpMethod = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth !== false) {
    if (!cachedAccessToken || isJwtExpired(cachedAccessToken)) {
      const stored = await getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (stored && !isJwtExpired(stored)) {
        cachedAccessToken = stored;
      } else {
        await bootstrapMobileSession();
      }
    }
    if (cachedAccessToken) {
      headers['Authorization'] = `Bearer ${cachedAccessToken}`;
    }
  }

  const effectiveWorkspace = options.workspaceId ?? cachedWorkspaceId;
  if (effectiveWorkspace) {
    headers['X-Workspace-Id'] = effectiveWorkspace;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

  try {
    const response = await fetch(resolveUrl(path), {
      method,
      headers,
      body: options.body !== undefined && method !== 'GET' && method !== 'HEAD'
        ? JSON.stringify(options.body)
        : undefined,
      signal: options.signal ?? controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 204) {
      return null as T;
    }

    if (response.ok) {
      const text = await response.text();
      return text.length > 0 ? (JSON.parse(text) as T) : (null as T);
    }

    // Handle 401 refresh
    const canAttemptRefresh =
      response.status === 401 &&
      options.auth !== false &&
      options.retryOnUnauthorized !== false &&
      (method === 'GET' || method === 'HEAD' || method === 'OPTIONS');

    if (canAttemptRefresh) {
      const refreshedToken = await runSingleFlightRefresh();
      if (refreshedToken) {
        return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
      }
    }

    let errorData: { title?: string; detail?: string; message?: string } = {};
    try {
      errorData = (await response.json()) as typeof errorData;
    } catch {
      // ignore
    }

    const title = errorData.title ?? errorData.message ?? 'Request failed';
    const message = errorData.detail ?? errorData.message ?? `HTTP error ${response.status}`;

    throw new ApiError(response.status, title, message);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) {
      throw error;
    }
    const isAbort = (error as Error)?.name === 'AbortError';
    throw new ApiError(
      isAbort ? 408 : 503,
      isAbort ? 'Timeout' : 'Network Error',
      isAbort
        ? 'Request timed out. Please check your network connection.'
        : 'Unable to connect to DomainPulse API server.',
    );
  }
}

export function apiGet<T>(path: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'POST', body });
}

export function apiPatch<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'PATCH', body });
}

export function apiDelete<T>(path: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'DELETE' });
}
