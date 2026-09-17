import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'sales' | string;
  created_at?: string;
}

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const ACCESS_TOKEN_KEY = 'kwatapos_access_token';
export const REFRESH_TOKEN_KEY = 'kwatapos_refresh_token';
export const USER_KEY = 'kwatapos_user';

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch {
        return null;
      }
      return null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch {
        // Fallback
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn('SecureStore setItem error:', e);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Fallback
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('SecureStore deleteItem error:', e);
    }
  },
};

export const getApiBaseUrl = () => {
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:8095'
    : 'http://127.0.0.1:8095';
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await authStorage.getItem(ACCESS_TOKEN_KEY);
        const storedRefresh = await authStorage.getItem(REFRESH_TOKEN_KEY);
        const storedUser = await authStorage.getItem(USER_KEY);

        if (storedToken && storedUser) {
          setAccessToken(storedToken);
          setRefreshToken(storedRefresh);
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.warn('Failed to restore session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      let errorMessage = 'Invalid email or password';
      try {
        const errJson = await res.json();
        if (errJson?.error) {
          errorMessage = errJson.error;
        }
      } catch {
        // use default error message
      }
      throw new Error(errorMessage);
    }

    const data = await res.json();
    await authStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    await authStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    await authStorage.setItem(USER_KEY, JSON.stringify(data.user));

    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    setUser(data.user);
  };

  const logout = async (): Promise<void> => {
    await authStorage.removeItem(ACCESS_TOKEN_KEY);
    await authStorage.removeItem(REFRESH_TOKEN_KEY);
    await authStorage.removeItem(USER_KEY);

    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    (globalThis as any).__auth = {
      login,
      logout,
      user,
      accessToken,
      refreshToken,
      isLoading,
    };
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
