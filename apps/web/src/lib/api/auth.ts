/**
 * Frontend auth API helpers using the backend's EXACT Phase 6 contracts.
 *
 * POST /api/v1/auth/login    { email, password }            -> 200 { accessToken, accessTokenExpiresAt, refreshToken, session, user }
 * POST /api/v1/auth/register { email, password, displayName? } -> { user } (409 when taken)
 * POST /api/v1/auth/refresh  { refreshToken }               -> 200 { accessToken, accessTokenExpiresAt, refreshToken, session }
 *   NOTE: refresh rotates the credential (single-use) and does NOT return a user.
 * POST /api/v1/auth/logout   Bearer required                -> 204, revokes the session
 * GET  /api/v1/auth/me       Bearer required                -> { user }
 */

import { apiGet, apiPost } from './client';
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  RefreshRequest,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
} from './types';

export function loginRequest(input: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> {
  return apiPost<LoginResponse>(
    '/auth/login',
    { email: input.email, password: input.password },
    { auth: false, retryOnUnauthorized: false, ...(signal !== undefined ? { signal } : {}) },
  );
}

export function registerRequest(input: RegisterRequest, signal?: AbortSignal): Promise<RegisterResponse> {
  return apiPost<RegisterResponse>(
    '/auth/register',
    input.displayName === undefined
      ? { email: input.email, password: input.password }
      : { email: input.email, password: input.password, displayName: input.displayName },
    { auth: false, retryOnUnauthorized: false, ...(signal !== undefined ? { signal } : {}) },
  );
}

export function refreshRequest(input: RefreshRequest, signal?: AbortSignal): Promise<RefreshResponse> {
  return apiPost<RefreshResponse>(
    '/auth/refresh',
    { refreshToken: input.refreshToken },
    { auth: false, retryOnUnauthorized: false, ...(signal !== undefined ? { signal } : {}) },
  );
}

export function meRequest(signal?: AbortSignal): Promise<MeResponse> {
  return apiGet<MeResponse>(
    '/auth/me',
    { ...(signal !== undefined ? { signal } : {}) },
  );
}

export function logoutRequest(): Promise<void> {
  // 204 resolves to null in the client; best-effort, never retried.
  return apiPost<void>('/auth/logout', undefined, { retryOnUnauthorized: false }).then(
    () => undefined,
  );
}
