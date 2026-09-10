/**
 * Shared frontend API + auth shapes.
 *
 * These mirror the backend's EXACT Phase 6 auth contracts
 * (apps/api/src/auth/http/auth.controller.ts and related schemas).
 * Dates arrive over JSON as ISO strings.
 */

export interface AuthUser {
  readonly createdAt: string;
  readonly displayName: string | null;
  readonly email: string;
  readonly id: string;
  readonly updatedAt: string;
}

export interface AuthSession {
  readonly expiresAt: string;
  readonly id: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface LoginResponse {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshToken: string;
  readonly session: AuthSession;
  readonly user: AuthUser;
}

export interface RefreshRequest {
  readonly refreshToken: string;
}

export interface RefreshResponse {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshToken: string;
  readonly session: AuthSession;
}

export interface MeResponse {
  readonly user: AuthUser;
}

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string;
}

export interface RegisterResponse {
  readonly user: AuthUser;
}

/** Backend RFC 9457 Problem Details subset (safe fields only). */
export interface ProblemDetailsShape {
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
