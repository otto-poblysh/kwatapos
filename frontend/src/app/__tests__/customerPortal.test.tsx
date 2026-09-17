import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CustomerLoginScreen from '../customer/login';
import CustomerDashboardScreen from '../customer/dashboard';
import { useAuth } from '../../core/hooks/useAuth';

jest.mock('../../core/hooks/useAuth', () => ({
  useAuth: jest.fn(),
  getApiBaseUrl: () => 'http://127.0.0.1:3014',
}));

describe('Customer Portal', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockLoginCustomer = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Login', () => {
    it('signs in with phone number and PIN', async () => {
      mockLoginCustomer.mockResolvedValue(undefined);
      mockUseAuth.mockReturnValue({
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
        login: jest.fn(),
        loginCustomer: mockLoginCustomer,
        logout: mockLogout,
      });

      render(<CustomerLoginScreen />);
      fireEvent.changeText(screen.getByTestId('customer-phone-input'), '+237690000000');
      fireEvent.changeText(screen.getByTestId('customer-pin-input'), '0000');
      fireEvent.press(screen.getByTestId('customer-login-button'));

      await waitFor(() => {
        expect(mockLoginCustomer).toHaveBeenCalledWith('+237690000000', '0000');
      });
    });

    it('shows validation error when PIN is not 4 digits', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
        login: jest.fn(),
        loginCustomer: mockLoginCustomer,
        logout: mockLogout,
      });

      render(<CustomerLoginScreen />);
      fireEvent.changeText(screen.getByTestId('customer-phone-input'), '+237690000000');
      fireEvent.changeText(screen.getByTestId('customer-pin-input'), '12');
      fireEvent.press(screen.getByTestId('customer-login-button'));

      expect(await screen.findByText('PIN must be exactly 4 digits.')).toBeTruthy();
      expect(mockLoginCustomer).not.toHaveBeenCalled();
    });
  });

  describe('Dashboard', () => {
    it('renders outstanding balance and credit history', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'cust-1', email: '+237690000000', role: 'customer' },
        accessToken: 'customer-token',
        refreshToken: 'refresh',
        isLoading: false,
        login: jest.fn(),
        loginCustomer: mockLoginCustomer,
        logout: mockLogout,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'cust-1',
          name: 'Alice Wonder',
          phone_number: '+237690000000',
          outstanding_balance: '15000.00',
          credits: [
            {
              id: 'cr-1',
              order_id: 'ord-1',
              amount: '15000.00',
              status: 'unpaid',
              created_at: '2026-09-17T18:00:00Z',
            },
          ],
        }),
      }) as jest.Mock;

      render(<CustomerDashboardScreen />);

      await waitFor(() => {
        expect(screen.getByText('Total Outstanding Balance')).toBeTruthy();
        expect(screen.getByTestId('outstanding-balance-value')).toHaveTextContent('15,000 FCFA');
        expect(screen.getByText('Alice Wonder')).toBeTruthy();
        expect(screen.getByText('Unpaid')).toBeTruthy();
        expect(screen.getAllByText('15,000 FCFA').length).toBeGreaterThan(0);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3014/api/customer/me',
        expect.objectContaining({
          headers: { Authorization: 'Bearer customer-token' },
        })
      );

      fireEvent.press(screen.getByTestId('customer-logout-button'));
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});
