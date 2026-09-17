import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import AdminReportsScreen from '../(admin)/reports';
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

describe('Admin Daily Report', () => {
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

  it('renders financial summary cards from the daily report API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: '2026-09-17',
        total_sales: '100000.00',
        by_payment_method: {
          cash: '50000.00',
          transfer: '20000.00',
          card: '10000.00',
          credit: '20000.00',
        },
        credit_issued: '20000.00',
        direct_expenses: '5000.00',
        expected_cash_drawer: '45000.00',
      }),
    }) as jest.Mock;

    render(<AdminReportsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Total Sales')).toBeTruthy();
      expect(screen.getByText('Expected Cash in Drawer')).toBeTruthy();
      expect(screen.getByText('Credit Issued Today')).toBeTruthy();
      expect(screen.getByText('Direct Expenses')).toBeTruthy();
      expect(screen.getByText('100,000 FCFA')).toBeTruthy();
      expect(screen.getByText('45,000 FCFA')).toBeTruthy();
      expect(screen.getByText('5,000 FCFA')).toBeTruthy();
      expect(screen.getByText('Cash')).toBeTruthy();
      expect(screen.getByText('Transfer')).toBeTruthy();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3014/api/reports/daily',
      expect.objectContaining({
        headers: { Authorization: 'Bearer admin-token' },
      })
    );
  });
});
