import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import AdminCatalogScreen from '../(admin)/catalog';
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

describe('Admin Catalog Dashboard', () => {
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

  it('lists products and creates a new catalog item', async () => {
    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/products') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'p-new',
            name: 'Guinness Stout',
            price: '1200.00',
            category: 'beer',
            stock_quantity: 24,
          }),
        });
      }
      if (url.endsWith('/api/admin/products')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'p1',
              name: 'Castel Beer',
              price: '650.00',
              category: 'beer',
              stock_quantity: 50,
            },
          ],
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    }) as jest.Mock;

    render(<AdminCatalogScreen />);

    await waitFor(() => {
      expect(screen.getByText('Castel Beer')).toBeTruthy();
      expect(screen.getByText('650 FCFA')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('product-name'), 'Guinness Stout');
    fireEvent.changeText(screen.getByTestId('product-price'), '1200');
    fireEvent.changeText(screen.getByTestId('product-stock'), '24');
    fireEvent.press(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3014/api/admin/products',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
