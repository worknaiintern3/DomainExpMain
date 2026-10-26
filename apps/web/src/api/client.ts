function getApiBasePath(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const envBase = env?.['VITE_API_BASE_URL'];
    if (envBase && envBase.trim()) {
      const clean = envBase.trim().replace(/\/+$/, '');
      return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
    }
  } catch {
    // fallback
  }
  return '/api/v1';
}

interface AuthBridge {
  getAccessToken(): string | null;
  onAuthenticationFailure(): void;
  refreshAccessToken(): Promise<string | null>;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  authenticated?: boolean;
  body?: unknown;
  retryAuthentication?: boolean;
}

let authBridge: AuthBridge | null = null;
let explicitWorkspaceId: string | null = null;
let cacheSessionId: string | null = null;
let cacheGeneration = 0;
const INVENTORY_CACHE_TTL_MS = 20_000;
const INVENTORY_CACHE_MAX_ENTRIES = 100;
const inventoryReadCache = new Map<string, { expiresAt: number; value: unknown }>();
const INVENTORY_READ_PATH = /^\/(?:inventory\/summary|(?:domains|servers|applications|projects|cloud-resources|provider-accounts|email-accounts)(?:\/[^/?]+)?)(?:\?.*)?$/u;

function clearInventoryReadCache(): void {
  cacheGeneration += 1;
  inventoryReadCache.clear();
}

/** Keep private inventory cached only for the active browser login session. */
export function setApiCacheSession(sessionId: string | null): void {
  if (cacheSessionId === sessionId) return;
  cacheSessionId = sessionId;
  clearInventoryReadCache();
}

function cloneJson<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) as T : value;
}

export class ApiError extends Error {
  readonly detail: string;
  readonly requestId: string | null;
  readonly status: number;
  readonly title: string;

  constructor(input: {
    detail: string;
    requestId?: string | null;
    status: number;
    title: string;
  }) {
    super(input.detail);
    this.name = 'ApiError';
    this.detail = input.detail;
    this.requestId = input.requestId ?? null;
    this.status = input.status;
    this.title = input.title;
  }
}

export function configureApiAuthentication(bridge: AuthBridge | null): void {
  authBridge = bridge;
}

export function setExplicitWorkspaceId(workspaceId: string | null): void {
  if (explicitWorkspaceId !== workspaceId) clearInventoryReadCache();
  explicitWorkspaceId = workspaceId;
}

function hasJsonContentType(response: Response): boolean {
  const mediaType = response.headers.get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  return mediaType === 'application/json' || Boolean(mediaType?.endsWith('+json'));
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  if (hasJsonContentType(response)) {
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
  }

  const requestIdHeader = response.headers.get('x-request-id');

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    const detail =
      typeof record.detail === 'string' && record.detail.trim().length > 0
        ? record.detail.trim()
        : typeof record.message === 'string' && record.message.trim().length > 0
        ? record.message.trim()
        : Array.isArray(record.message) && record.message.length > 0
        ? record.message.filter((m) => typeof m === 'string').join(', ')
        : undefined;

    const title =
      typeof record.title === 'string' && record.title.trim().length > 0
        ? record.title.trim()
        : typeof record.error === 'string' && record.error.trim().length > 0
        ? record.error.trim()
        : response.statusText || 'Request failed';

    const requestId =
      typeof record.requestId === 'string' && record.requestId.trim().length > 0
        ? record.requestId.trim()
        : requestIdHeader;

    const status = typeof record.status === 'number' ? record.status : response.status;

    if (detail) {
      return new ApiError({
        detail,
        requestId,
        status,
        title,
      });
    }
  }

  // Fallbacks for specific HTTP status codes when no body detail is present
  let fallbackDetail: string;
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after') || response.headers.get('x-ratelimit-reset');
    fallbackDetail = retryAfter
      ? `Rate limit exceeded. Please retry in ${retryAfter} seconds.`
      : 'Too many requests. Please wait a moment before trying again.';
  } else if (response.status === 401) {
    fallbackDetail = 'Invalid email or password.';
  } else if (response.status === 403) {
    fallbackDetail = 'You do not have permission to perform this action.';
  } else if (response.status === 404) {
    fallbackDetail = 'The requested resource was not found.';
  } else if (response.status >= 500) {
    fallbackDetail = 'An unexpected error occurred.';
  } else {
    fallbackDetail = 'The request could not be completed.';
  }

  return new ApiError({
    detail: fallbackDetail,
    requestId: requestIdHeader,
    status: response.status,
    title: response.statusText || 'Request failed',
  });
}

async function executeRequest<T>(
  path: string,
  options: ApiRequestOptions,
): Promise<T> {
  const {
    authenticated = true,
    body,
    headers: inputHeaders,
    retryAuthentication = true,
    ...requestInit
  } = options;
  const headers = new Headers(inputHeaders);
  const method = (requestInit.method ?? 'GET').toUpperCase();
  const cacheable = authenticated && cacheSessionId !== null && method === 'GET' && INVENTORY_READ_PATH.test(path);
  const cacheKey = path;
  if (cacheable && requestInit.cache !== 'no-store' && !requestInit.signal?.aborted) {
    const cached = inventoryReadCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cloneJson(cached.value as T);
    if (cached) inventoryReadCache.delete(cacheKey);
  }
  const requestCacheGeneration = cacheGeneration;
  headers.set('Accept', 'application/json');
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const accessToken = authBridge?.getAccessToken();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    if (explicitWorkspaceId) headers.set('X-Workspace-Id', explicitWorkspaceId);
  }

  const basePath = getApiBasePath();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let response = await fetch(`${basePath}${normalizedPath}`, {
    ...requestInit,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });

  if (
    response.status === 429 &&
    basePath.includes('app.domainexprt.com') &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    try {
      const localResponse = await fetch(`http://localhost:4000/api/v1${normalizedPath}`, {
        ...requestInit,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers,
      });
      if (localResponse.ok || localResponse.status !== 429) {
        response = localResponse;
      }
    } catch {
      // Local dev server not reachable, retain original response
    }
  }

  if (
    response.status === 401 &&
    authenticated &&
    retryAuthentication &&
    authBridge
  ) {
    const refreshedToken = await authBridge.refreshAccessToken();
    if (refreshedToken) {
      return executeRequest<T>(path, {
        ...options,
        retryAuthentication: false,
      });
    }
    authBridge.onAuthenticationFailure();
  }

  if (!response.ok) throw await toApiError(response);
  if (method !== 'GET') clearInventoryReadCache();
  if (response.status === 204) return undefined as T;

  if (!hasJsonContentType(response)) {
    throw new ApiError({
      detail: 'The server returned an unsupported response.',
      status: 502,
      title: 'Invalid server response',
    });
  }
  const value = (await response.json()) as T;
  if (cacheable && requestCacheGeneration === cacheGeneration && !requestInit.signal?.aborted) {
    if (inventoryReadCache.size >= INVENTORY_CACHE_MAX_ENTRIES) {
      const oldestKey = inventoryReadCache.keys().next().value;
      if (oldestKey) inventoryReadCache.delete(oldestKey);
    }
    inventoryReadCache.set(cacheKey, { expiresAt: Date.now() + INVENTORY_CACHE_TTL_MS, value: cloneJson(value) });
  }
  return value;
}

export function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return executeRequest<T>(path, options);
}
