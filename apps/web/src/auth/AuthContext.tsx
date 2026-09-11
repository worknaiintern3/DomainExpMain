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
import type { LoginResponse, PublicUser, TokenPair } from '@/api/types';

const REFRESH_TOKEN_STORAGE_KEY = 'domainpulse.refresh-token';

type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput extends LoginInput {
  displayName?: string;
}

interface AuthContextValue {
  error: string | null;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  sessionScopeKey: string | null;
  status: AuthStatus;
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

  const login = useCallback(async (input: LoginInput) => {
    const generation = ++generationRef.current;
    accessTokenRef.current = null;
    writeRefreshToken(null);
    setError(null);
    setStatus('booting');
    try {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        authenticated: false,
        body: input,
        method: 'POST',
        retryAuthentication: false,
      });
      if (generation !== generationRef.current) return;
      acceptTokenPair(response);
      setUser(response.user);
      setStatus('authenticated');
    } catch (loginError) {
      if (generation === generationRef.current) {
        setError(messageFor(loginError));
        setStatus('unauthenticated');
      }
      throw loginError;
    }
  }, [acceptTokenPair]);

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
    error,
    login,
    logout,
    register,
    sessionScopeKey: user && sessionId ? `${user.id}:${sessionId}` : null,
    status,
    user,
  }), [error, login, logout, register, sessionId, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
