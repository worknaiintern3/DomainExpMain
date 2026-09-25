import React, { createContext, useContext, useEffect, useState } from 'react';

import { authService, type MobileUser } from './auth.service';

interface AuthContextValue {
  user: MobileUser | null;
  isLoading: boolean;
  login(email: string, pass: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    authService
      .getMe()
      .then((me) => {
        if (isMounted) setUser(me);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, pass: string) => {
    const loggedIn = await authService.login(email, pass);
    setUser(loggedIn);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
