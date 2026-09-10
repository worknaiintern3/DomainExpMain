/**
 * Centralized DomainPulse frontend API client (native fetch only).
 *
 * Phase 7 rules enforced here:
 * - One fetch wrapper for the whole app.
 * - Access token lives in module memory only (never persisted here).
 * - `X-Workspace-Id` is sent ONLY when an explicit workspace id is
 *   supplied per request or via setWorkspaceId(). Default: unset, so the
 *   backend resolves the user's personal workspace.
 * - 204 responses resolve to null without JSON parsing.
 * - Backend Problem Details are parsed defensively and mapped to a safe
 *   typed ApiError. Raw response/database internals never reach callers.
 * - Single-flight refresh shared across concurrent 401s.
 * - At most ONE retry after a successful refresh, and only for idempotent
 *   methods (GET/HEAD/OPTIONS). Mutations are never retried automatically.
 */

import type { ProblemDetailsShape } from './types';

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
  /** JSON-serializable body. Omitted for GET/HEAD. */
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  /** Per-request override. Falls back to the module workspace id. */
  readonly workspaceId?: string;
  /** Default true. Pass false for login/refresh/register. */
  readonly auth?: boolean;
  /** Default true. Set false (e.g. logout) to skip the 401 refresh flow. */
  readonly retryOnUnauthorized?: boolean;
}

/** Resolves to a fresh access token, or null when refresh failed. */
export type RefreshHandler = () => Promise<string | null>;

const API_PREFIX = '/api/v1';

let accessToken: string | null = null;
let workspaceId: string | undefined;
let refreshHandler: RefreshHandler | null = null;
let inflightRefresh: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setWorkspaceId(id: string | undefined): void {
  workspaceId = id;
}

export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

function readEnvBaseUrl(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return (env?.['VITE_API_BASE_URL'] ?? '').trim();
  } catch {
    return '';
  }
}

function resolveBaseUrl(): string {
  const configured = readEnvBaseUrl().replace(/\/+$/, '');
  if (configured === '') {
    return API_PREFIX;
  }
  if (configured.endsWith(API_PREFIX)) {
    return configured;
  }
  return `${configured}${API_PREFIX}`;
}

function joinUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${resolveBaseUrl()}${normalized}`;
}

function isIdempotent(method: HttpMethod): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function parseProblemShape(payload: unknown): ProblemDetailsShape | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return {
    ...(typeof record['title'] === 'string' ? { title: record['title'] } : {}),
    ...(typeof record['status'] === 'number' ? { status: record['status'] } : {}),
    ...(typeof record['detail'] === 'string' ? { detail: record['detail'] } : {}),
  };
}

function toSafeMessage(status: number, problem: ProblemDetailsShape | null, fallback: string): string {
  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }
  if (status === 403) {
    return 'You do not have access to this workspace.';
  }
  if (status === 404) {
    return 'The requested record was not found.';
  }
  if (status === 409) {
    return 'This request conflicts with existing data.';
  }
  if (problem?.title && problem.title.length > 0 && problem.title.length <= 160) {
    return problem.title;
  }
  return fallback;
}

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (text.length === 0) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function runSingleFlightRefresh(): Promise<string | null> {
  if (inflightRefresh !== null) {
    return inflightRefresh;
  }
  const handler = refreshHandler;
  if (handler === null) {
    return Promise.resolve(null);
  }
  inflightRefresh = handler().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

async function executeRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const method: HttpMethod = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth !== false && accessToken !== null) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const effectiveWorkspace = options.workspaceId ?? workspaceId;
  if (effectiveWorkspace !== undefined && effectiveWorkspace !== '') {
    headers['X-Workspace-Id'] = effectiveWorkspace;
  }

  const response = await fetch(joinUrl(path), {
    method,
    headers,
    body: options.body !== undefined && method !== 'GET' && method !== 'HEAD'
      ? JSON.stringify(options.body)
      : undefined,
    signal: options.signal,
  });

  if (response.status === 204) {
    return null as T;
  }

  if (response.ok) {
    return (await readJsonSafely(response)) as T;
  }

  const problem = parseProblemShape(await readJsonSafely(response));
  const canAttemptRefresh =
    response.status === 401 &&
    options.auth !== false &&
    options.retryOnUnauthorized !== false &&
    isIdempotent(method);

  if (canAttemptRefresh) {
    const refreshed = await runSingleFlightRefresh();
    if (refreshed !== null) {
      // Exactly one retry with the fresh token; never loop.
      return executeRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  throw new ApiError(
    response.status,
    problem?.title ?? 'Request failed',
    toSafeMessage(response.status, problem, 'Something went wrong. Please try again.'),
  );
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return executeRequest<T>(path, options);
}

export function apiGet<T>(path: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return executeRequest<T>(path, { ...options, method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return executeRequest<T>(path, { ...options, method: 'POST', body });
}
