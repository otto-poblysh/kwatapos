import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import AdminTeamScreen from '../(admin)/team';
import { useAuth } from '../../core/hooks/useAuth';

jest.mock('../../core/hooks/useAuth', () => ({
  useAuth: jest.fn(),
  getApiBaseUrl: () => 'http://127.0.0.1:3014',
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
    replace: jest.fn(),
  }),
}));

describe('Admin Team Dashboard', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'a1', email: 'admin@kwatapos.com', role: 'admin' },
      accessToken: 'admin-token',
      refreshToken: 'refresh',
      isLoading: false,
      login: jest.fn(),
      loginCustomer: jest.fn(),
      logout: jest.fn(),
    });
  });

  it('lists staff and shows inherited vs direct permissions', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.endsWith('/api/admin/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'u1', email: 'usera@kwatapos.com', role: 'Weekend Staff' },
          ],
        });
      }
      if (url.endsWith('/api/admin/roles')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { name: 'Weekend Staff', permissions: ['pos.sale', 'catalog.read'] },
          ],
        });
      }
      if (url.endsWith('/api/admin/permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'p1', name: 'catalog.read', description: 'View products' },
            { id: 'p2', name: 'catalog.update', description: 'Update prices' },
          ],
        });
      }
      if (url.endsWith('/api/admin/users/u1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'u1',
            email: 'usera@kwatapos.com',
            role: 'Weekend Staff',
            permissions: [
              {
                id: 'p1',
                name: 'catalog.read',
                description: 'View products',
                source: 'role',
                is_effective: true,
              },
              {
                id: 'p2',
                name: 'catalog.update',
                description: 'Update prices',
                source: 'grant',
                is_effective: true,
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    }) as jest.Mock;

    render(<AdminTeamScreen />);

    await waitFor(() => {
      expect(screen.getByText('usera@kwatapos.com')).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: /edit usera@kwatapos.com/i }));

    await waitFor(() => {
      expect(screen.getByText('Inherited from Role')).toBeTruthy();
      expect(screen.getByText('Directly Assigned')).toBeTruthy();
    });
  });
});
