import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth, authStorage, ACCESS_TOKEN_KEY } from './useAuth';

// Mock expo-secure-store
const memoryStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => memoryStore[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    memoryStore[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete memoryStore[key];
  }),
}));

// Mock fetch globally
const originalFetch = global.fetch;

describe('useAuth Hook', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    for (const key of Object.keys(memoryStore)) {
      delete memoryStore[key];
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('initializes with null user and finishes loading', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });

  it('restores existing session from storage', async () => {
    await authStorage.setItem(ACCESS_TOKEN_KEY, 'saved_access_token');
    await authStorage.setItem('kwatapos_refresh_token', 'saved_refresh_token');
    await authStorage.setItem(
      'kwatapos_user',
      JSON.stringify({ id: '123', email: 'admin@kwatapos.com', role: 'admin' })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user?.email).toBe('admin@kwatapos.com');
    expect(result.current.user?.role).toBe('admin');
    expect(result.current.accessToken).toBe('saved_access_token');
  });

  it('clears storage when stored session is corrupted', async () => {
    await authStorage.setItem(ACCESS_TOKEN_KEY, 'corrupted_token');
    await authStorage.setItem('kwatapos_refresh_token', 'corrupted_refresh');
    await authStorage.setItem('kwatapos_user', 'invalid-json-{');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(await authStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(await authStorage.getItem('kwatapos_refresh_token')).toBeNull();
    expect(await authStorage.getItem('kwatapos_user')).toBeNull();
  });

  it('logs in successfully and saves session', async () => {
    const mockUser = { id: 'u1', email: 'admin@kwatapos.com', role: 'admin' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        user: mockUser,
      }),
    } as any);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login('admin@kwatapos.com', 'admin123');
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.accessToken).toBe('new_access_token');
    expect(await authStorage.getItem(ACCESS_TOKEN_KEY)).toBe('new_access_token');
  });

  it('throws error when login fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid email or password' }),
    } as any);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.login('admin@kwatapos.com', 'wrong');
      })
    ).rejects.toThrow('Invalid email or password');

    expect(result.current.user).toBeNull();
  });

  it('logs in a customer with phone and PIN', async () => {
    const mockUser = { id: 'c1', email: '+237690000000', role: 'customer' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'customer_access',
        refresh_token: 'customer_refresh',
        user: mockUser,
      }),
    } as any);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loginCustomer('+237690000000', '0000');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3014/api/auth/customer',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phone_number: '+237690000000', pin: '0000' }),
      })
    );
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.accessToken).toBe('customer_access');
  });

  it('logs out and clears session from storage', async () => {
    await authStorage.setItem(ACCESS_TOKEN_KEY, 'saved_access_token');
    await authStorage.setItem(
      'kwatapos_user',
      JSON.stringify({ id: '123', email: 'admin@kwatapos.com', role: 'admin' })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(await authStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });
});
