import type { ProblemDetails } from './types';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
const API_BASE_PATH = (env?.['VITE_API_BASE_URL'] || '/api/v1').replace(/\/+$/, '');

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

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.detail === 'string' &&
    typeof record.requestId === 'string' &&
    typeof record.status === 'number' &&
    typeof record.title === 'string'
  );
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

  if (isProblemDetails(payload)) {
    return new ApiError({
      detail: payload.detail,
      requestId: payload.requestId,
      status: response.status,
      title: payload.title,
    });
  }

  return new ApiError({
    detail: response.status >= 500 ? 'An unexpected error occurred.' : 'The request could not be completed.',
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

  const response = await fetch(`${API_BASE_PATH}${path}`, {
    ...requestInit,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });

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
