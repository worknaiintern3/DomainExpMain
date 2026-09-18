import type { ProblemDetails } from './types';

const API_BASE_PATH = '/api/v1';

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
  if (response.status === 204) return undefined as T;

  if (!hasJsonContentType(response)) {
    throw new ApiError({
      detail: 'The server returned an unsupported response.',
      status: 502,
      title: 'Invalid server response',
    });
  }
  return (await response.json()) as T;
}

export function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return executeRequest<T>(path, options);
}
