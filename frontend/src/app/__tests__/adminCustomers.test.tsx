import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import AdminCustomersScreen from '../(admin)/customers';
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

describe('Admin Customers Dashboard', () => {
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

  it('lists customers and can reset a PIN', async () => {
    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/admin/customers/c1') && init?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'c1',
            name: 'Amina Nji',
            phone_number: '+237699001234',
            outstanding_balance: '15000.00',
          }),
        });
      }
      if (url.endsWith('/api/admin/customers')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'c1',
              name: 'Amina Nji',
              phone_number: '+237699001234',
              outstanding_balance: '15000.00',
            },
          ],
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    }) as jest.Mock;

    render(<AdminCustomersScreen />);

    await waitFor(() => {
      expect(screen.getByText('Amina Nji')).toBeTruthy();
      expect(screen.getByText('15,000 FCFA outstanding')).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: /edit amina nji/i }));
    fireEvent.changeText(screen.getByTestId('customer-pin'), '4321');
    fireEvent.press(screen.getByRole('button', { name: /save customer/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3014/api/admin/customers/c1',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });
});
