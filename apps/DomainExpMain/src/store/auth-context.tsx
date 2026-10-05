import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { getItem, STORAGE_KEYS, setActiveUserId } from '../services/storage';
import { initApiClient } from '../services/api';
import {
  loginUser,
  registerUser,
  logoutUser,
  deleteUserAccount,
  updateUserProfile,
  changeUserPassword,
  type LoginPayload,
  type RegisterPayload,
} from '../services/auth';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateUser: (updates: { displayName?: string; email?: string; organization?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        await initApiClient();
        const storedUserData = await getItem(STORAGE_KEYS.USER_DATA);
        const accessToken = await getItem(STORAGE_KEYS.ACCESS_TOKEN);

        if (storedUserData && accessToken) {
          const parsedUser = JSON.parse(storedUserData) as User;
          if (parsedUser?.id) {
            setActiveUserId(parsedUser.id);
          }
          setUser(parsedUser);
        } else {
          setActiveUserId(null);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }

    loadStoredAuth();
  }, []);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const result = await loginUser(payload);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const result = await registerUser(payload);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  };

  const deleteAccount = async () => {
    try {
      await deleteUserAccount();
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  };

  const updateUser = async (updates: { displayName?: string; email?: string; organization?: string }) => {
    try {
      const updated = await updateUserProfile(updates);
      setUser(updated);
    } catch {
      // ignore
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await changeUserPassword(currentPassword, newPassword);
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      deleteAccount,
      updateUser,
      changePassword,
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
