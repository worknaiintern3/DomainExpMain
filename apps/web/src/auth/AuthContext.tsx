import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ApiError, apiRequest, configureApiAuthentication } from '@/api/client';
import type {
  GoogleLinkResult,
  GoogleOAuthStartResponse,
  LoginMethodsStatus,
  LoginResponse,
  PublicUser,
  TokenPair,
} from '@/api/types';

const REFRESH_TOKEN_STORAGE_KEY = 'domainpulse.refresh-token';
const GOOGLE_OAUTH_INTENT_STORAGE_KEY = 'domainpulse.google-oauth-intent';

type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

/**
 * UX/routing state only, read by `GoogleCallbackPage` to decide which flow
 * to complete on return from Google -- NEVER security authority. The
 * backend's `oauth_transactions.flow` (login vs. link) is what actually
 * decides what a given `state` is allowed to do; a caller could tamper with
 * or clear this marker and the worst outcome is landing on the wrong local
 * UI branch, never a security bypass.
 */
export type GoogleOAuthIntent = 'link' | 'login';

/**
 * Returns `null` -- rather than guessing 'login' -- when the marker is
 * absent or holds anything other than exactly 'login'/'link'. A stray visit
 * to this callback URL that never went through `startGoogleLogin`/
 * `startGoogleLink` (a stale bookmark, a manually-typed URL, a blocked
 * session store) must never be silently treated as an intended login
 * attempt; `GoogleCallbackPage` fails closed on `null` instead.
 */
export function readAndClearGoogleOAuthIntent(): GoogleOAuthIntent | null {
  try {
    const value = sessionStorage.getItem(GOOGLE_OAUTH_INTENT_STORAGE_KEY);
    sessionStorage.removeItem(GOOGLE_OAUTH_INTENT_STORAGE_KEY);
    return value === 'link' || value === 'login' ? value : null;
  } catch {
    return null;
  }
}

function writeGoogleOAuthIntent(intent: GoogleOAuthIntent): void {
  try {
    sessionStorage.setItem(GOOGLE_OAUTH_INTENT_STORAGE_KEY, intent);
  } catch {
    // A blocked session store just leaves the callback page unable to read
    // the marker back, which now fails closed to the 'failed' state --
    // never a security-relevant fallback.
  }
}

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput extends LoginInput {
  displayName?: string;
}

interface AuthContextValue {
  addPassword(password: string): Promise<LoginMethodsStatus>;
  completeGoogleLink(code: string, state: string): Promise<GoogleLinkResult>;
  completeGoogleLogin(code: string, state: string): Promise<void>;
  error: string | null;
  getLoginMethods(): Promise<LoginMethodsStatus>;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  sessionScopeKey: string | null;
  startGoogleLink(): Promise<void>;
  startGoogleLogin(): Promise<void>;
  status: AuthStatus;
  unlinkGoogle(): Promise<LoginMethodsStatus>;
  user: PublicUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRefreshToken(token: string | null): void {
  try {
    if (token === null) sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    else sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  } catch {
    // A blocked session store produces a non-restorable in-memory session.
  }
}

function messageFor(error: unknown): string {
  return error instanceof ApiError ? error.detail : 'The request could not be completed.';
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const refreshFlightRef = useRef<Promise<string | null> | null>(null);

  const clearSession = useCallback(() => {
    generationRef.current += 1;
    accessTokenRef.current = null;
    refreshFlightRef.current = null;
    writeRefreshToken(null);
    setSessionId(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const acceptTokenPair = useCallback((pair: TokenPair) => {
    accessTokenRef.current = pair.accessToken;
    writeRefreshToken(pair.refreshToken);
    setSessionId(pair.session.id);
  }, []);

  const refreshAccessToken = useCallback((): Promise<string | null> => {
    if (refreshFlightRef.current) return refreshFlightRef.current;
    const refreshToken = readRefreshToken();
    if (!refreshToken) return Promise.resolve(null);

    const generation = generationRef.current;
    const flight = (async () => {
      try {
        const pair = await apiRequest<TokenPair>('/auth/refresh', {
          authenticated: false,
          body: { refreshToken },
          method: 'POST',
          retryAuthentication: false,
        });
        if (generation !== generationRef.current) return null;
        acceptTokenPair(pair);
        return pair.accessToken;
      } catch {
        if (generation === generationRef.current) clearSession();
        return null;
      }
    })();
    refreshFlightRef.current = flight;
    void flight.finally(() => {
      if (refreshFlightRef.current === flight) refreshFlightRef.current = null;
    });
    return flight;
  }, [acceptTokenPair, clearSession]);

  useEffect(() => {
    configureApiAuthentication({
      getAccessToken: () => accessTokenRef.current,
      onAuthenticationFailure: clearSession,
      refreshAccessToken,
    });
    return () => configureApiAuthentication(null);
  }, [clearSession, refreshAccessToken]);

  useEffect(() => {
    const generation = generationRef.current;
    const boot = async () => {
      if (!readRefreshToken()) {
        if (generation === generationRef.current) setStatus('unauthenticated');
        return;
      }
      const token = await refreshAccessToken();
      if (!token || generation !== generationRef.current) return;
      try {
        const response = await apiRequest<{ user: PublicUser }>('/auth/me', {
          retryAuthentication: false,
        });
        if (generation === generationRef.current) {
          setUser(response.user);
          setStatus('authenticated');
        }
      } catch {
        if (generation === generationRef.current) clearSession();
      }
    };
    void boot();
  }, [clearSession, refreshAccessToken]);

  const beginAuthenticationAttempt = useCallback((): number => {
    const generation = ++generationRef.current;
    accessTokenRef.current = null;
    writeRefreshToken(null);
    setError(null);
    setStatus('booting');
    return generation;
  }, []);

  /** Shared tail for every flow that ends in a fresh DomainPulse session (password login, Google login) -- accepting a LoginResponse is identical regardless of which auth method produced it. */
  const applyAuthenticatedResponse = useCallback((generation: number, response: LoginResponse) => {
    if (generation !== generationRef.current) return;
    acceptTokenPair(response);
    setUser(response.user);
    setStatus('authenticated');
  }, [acceptTokenPair]);

  const failAuthenticationAttempt = useCallback((generation: number, attemptError: unknown) => {
    if (generation === generationRef.current) {
      setError(messageFor(attemptError));
      setStatus('unauthenticated');
    }
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const generation = beginAuthenticationAttempt();
    try {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        authenticated: false,
        body: input,
        method: 'POST',
        retryAuthentication: false,
      });
      applyAuthenticatedResponse(generation, response);
    } catch (loginError) {
      failAuthenticationAttempt(generation, loginError);
      throw loginError;
    }
  }, [applyAuthenticatedResponse, beginAuthenticationAttempt, failAuthenticationAttempt]);

  const startGoogleLogin = useCallback(async () => {
    setError(null);
    writeGoogleOAuthIntent('login');
    const response = await apiRequest<GoogleOAuthStartResponse>('/auth/google/start', {
      authenticated: false,
      body: {},
      method: 'POST',
      retryAuthentication: false,
    });
    // Full top-level navigation -- Google's consent screen refuses to render in an iframe/fetch.
    window.location.assign(response.authorizationUrl);
  }, []);

  const completeGoogleLogin = useCallback(async (code: string, state: string) => {
    const generation = beginAuthenticationAttempt();
    try {
      const response = await apiRequest<LoginResponse>('/auth/google/callback', {
        authenticated: false,
        body: { code, state },
        method: 'POST',
        retryAuthentication: false,
      });
      applyAuthenticatedResponse(generation, response);
    } catch (callbackError) {
      failAuthenticationAttempt(generation, callbackError);
      throw callbackError;
    }
  }, [applyAuthenticatedResponse, beginAuthenticationAttempt, failAuthenticationAttempt]);

  /** Connect Google (authenticated linking) -- the caller must already have a live DomainPulse session; the backend re-derives `userId` from the bearer token, never from anything this page sends. */
  const startGoogleLink = useCallback(async () => {
    setError(null);
    writeGoogleOAuthIntent('link');
    const response = await apiRequest<GoogleOAuthStartResponse>('/auth/google/link/start', {
      body: {},
      method: 'POST',
    });
    window.location.assign(response.authorizationUrl);
  }, []);

  const completeGoogleLink = useCallback(
    (code: string, state: string) =>
      apiRequest<GoogleLinkResult>('/auth/google/link/callback', {
        body: { code, state },
        method: 'POST',
      }),
    [],
  );

  const getLoginMethods = useCallback(
    () => apiRequest<LoginMethodsStatus>('/auth/login-methods'),
    [],
  );

  const addPassword = useCallback(
    (password: string) =>
      apiRequest<LoginMethodsStatus>('/auth/password/add', {
        body: { password },
        method: 'POST',
      }),
    [],
  );

  const unlinkGoogle = useCallback(
    () => apiRequest<LoginMethodsStatus>('/auth/google/link', { method: 'DELETE' }),
    [],
  );

  const register = useCallback(async (input: RegisterInput) => {
    setError(null);
    await apiRequest('/auth/register', {
      authenticated: false,
      body: {
        ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}),
        email: input.email,
        password: input.password,
      },
      method: 'POST',
      retryAuthentication: false,
    });
    await login({ email: input.email, password: input.password });
  }, [login]);

  const logout = useCallback(async () => {
    const generation = generationRef.current;
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } catch {
      // Local credentials are always cleared, even if server revocation fails.
    } finally {
      if (generation === generationRef.current) clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(() => ({
    addPassword,
    completeGoogleLink,
    completeGoogleLogin,
    error,
    getLoginMethods,
    login,
    logout,
    register,
    sessionScopeKey: user && sessionId ? `${user.id}:${sessionId}` : null,
    startGoogleLink,
    startGoogleLogin,
    status,
    unlinkGoogle,
    user,
  }), [
    addPassword,
    completeGoogleLink,
    completeGoogleLogin,
    error,
    getLoginMethods,
    login,
    logout,
    register,
    sessionId,
    startGoogleLink,
    startGoogleLogin,
    status,
    unlinkGoogle,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
