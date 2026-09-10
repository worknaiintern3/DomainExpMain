/**
 * DomainPulse auth session provider (Phase 7B).
 *
 * Token storage rules:
 * - Access token: module memory only (via the API client). Never persisted.
 * - Refresh token: sessionStorage only, single namespaced key. Never localStorage.
 *
 * Bootstrap:
 * - Refresh token present -> exactly one refresh rotation, then GET /auth/me.
 * - No refresh token -> unauthenticated.
 * - Failed refresh/me -> cleared state, unauthenticated.
 *
 * StrictMode safety: bootstrap and refresh rotations are module-level shared
 * promises, so the double-effect invocation in development reuses the same
 * in-flight work instead of rotating the single-use refresh token twice.
 * The bootstrap promise is single-flight only WHILE IN FLIGHT (cleared in
 * `finally`, mirroring rotationPromise): after it settles, a later genuine
 * provider bootstrap re-evaluates sessionStorage instead of reusing a stale
 * result. This is StrictMode-safe because work creation is synchronous
 * (check-then-assign cannot interleave) and the single-use refresh itself is
 * additionally guarded by rotationPromise; sequential rotations after settle
 * each present the current stored token, so no replay can occur.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken, setRefreshHandler } from '../api/client';
import { loginRequest, logoutRequest, meRequest, refreshRequest } from '../api/auth';
import type { AuthSession, AuthStatus, AuthUser } from '../api/types';

const REFRESH_STORAGE_KEY = 'domainpulse.refreshToken.v1';

export interface AuthContextValue {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  readonly session: AuthSession | null;
  readonly login: (email: string, password: string) => Promise<void>;
  readonly logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredRefreshToken(): string | null {
  try {
    const value = sessionStorage.getItem(REFRESH_STORAGE_KEY);
    return value !== null && value !== '' ? value : null;
  } catch {
    return null;
  }
}

function writeStoredRefreshToken(token: string): void {
  try {
    sessionStorage.setItem(REFRESH_STORAGE_KEY, token);
  } catch {
    // Storage unavailable (e.g. private mode): session simply won't survive reload.
  }
}

function clearStoredRefreshToken(): void {
  try {
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
  } catch {
    // Ignore storage failures on cleanup.
  }
}

let rotationPromise: Promise<string | null> | null = null;
let onRotationFailure: (() => void) | null = null;
let lastRotatedSession: AuthSession | null = null;

function clearTokenState(): void {
  setAccessToken(null);
  clearStoredRefreshToken();
  lastRotatedSession = null;
}

/**
 * Single-flight refresh-token rotation shared by bootstrap and 401 recovery.
 * Resolves to the new access token, or null when refresh failed (state cleared).
 */
function rotateTokens(): Promise<string | null> {
  if (rotationPromise !== null) {
    return rotationPromise;
  }
  rotationPromise = (async () => {
    const stored = readStoredRefreshToken();
    if (stored === null) {
      return null;
    }
    try {
      const rotated = await refreshRequest({ refreshToken: stored });
      setAccessToken(rotated.accessToken);
      writeStoredRefreshToken(rotated.refreshToken);
      lastRotatedSession = rotated.session;
      return rotated.accessToken;
    } catch {
      clearTokenState();
      onRotationFailure?.();
      return null;
    }
  })().finally(() => {
    rotationPromise = null;
  });
  return rotationPromise;
}

interface BootstrapResult {
  readonly user: AuthUser | null;
  readonly session: AuthSession | null;
}

let bootstrapPromise: Promise<BootstrapResult> | null = null;

function ensureBootstrap(): Promise<BootstrapResult> {
  if (bootstrapPromise !== null) {
    return bootstrapPromise;
  }
  bootstrapPromise = (async (): Promise<BootstrapResult> => {
    const stored = readStoredRefreshToken();
    if (stored === null) {
      return { user: null, session: null };
    }
    const fresh = await rotateTokens();
    if (fresh === null) {
      return { user: null, session: null };
    }
    try {
      const me = await meRequest();
      return { user: me.user, session: lastRotatedSession };
    } catch {
      // Any /auth/me failure that yields "unauthenticated" must also clear
      // token state, otherwise the UI and stored credentials diverge.
      clearTokenState();
      return { user: null, session: null };
    }
  })().finally(() => {
    // Single-flight while in flight only: concurrent/StrictMode callers share
    // one bootstrap, but a settled result is never reused. Safe because
    // creation above is synchronous and refresh rotation has its own guard.
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  const applyUnauthenticated = useCallback(() => {
    clearTokenState();
    setUser(null);
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    setRefreshHandler(rotateTokens);
    onRotationFailure = () => {
      setUser(null);
      setSession(null);
      setStatus('unauthenticated');
    };
    let cancelled = false;
    ensureBootstrap().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.user !== null) {
        setUser(result.user);
        setSession(result.session);
        setStatus('authenticated');
      } else {
        // Distinguish "no usable session" without touching storage again.
        setUser(null);
        setSession(null);
        setStatus('unauthenticated');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await loginRequest({ email, password });
    setAccessToken(response.accessToken);
    writeStoredRefreshToken(response.refreshToken);
    lastRotatedSession = response.session;
    setUser(response.user);
    setSession(response.session);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest();
    } catch {
      // Best effort: a dead/expired session still ends locally.
    } finally {
      applyUnauthenticated();
    }
  }, [applyUnauthenticated]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, session, login, logout }),
    [status, user, session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
