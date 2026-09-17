import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SalesDashboard from '../(sales)/index';
import ManagerDashboard from '../(manager)/index';
import AdminDashboard from '../(admin)/index';
import { useAuth } from '../../core/hooks/useAuth';

jest.mock('../../core/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

describe('Dashboard Screens', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SalesDashboard', () => {
    it('renders sales dashboard with user info and handles logout', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 's1', email: 'sales@kwatapos.com', role: 'sales' },
        accessToken: 'token',
        refreshToken: 'refresh',
        isLoading: false,
        login: jest.fn(),
        logout: mockLogout,
      });

      render(<SalesDashboard />);
      expect(screen.getByText('Sales Dashboard')).toBeTruthy();
      expect(screen.getByText('sales@kwatapos.com')).toBeTruthy();
      expect(screen.getByText('sales')).toBeTruthy();

      const logoutBtn = screen.getByRole('button', { name: /log out/i });
      fireEvent.press(logoutBtn);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('ManagerDashboard', () => {
    it('renders manager dashboard with user info and handles logout', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'm1', email: 'manager@kwatapos.com', role: 'manager' },
        accessToken: 'token',
        refreshToken: 'refresh',
        isLoading: false,
        login: jest.fn(),
        logout: mockLogout,
      });

      render(<ManagerDashboard />);
      expect(screen.getByText('Manager Dashboard')).toBeTruthy();
      expect(screen.getByText('manager@kwatapos.com')).toBeTruthy();
      expect(screen.getByText('manager')).toBeTruthy();

      const logoutBtn = screen.getByRole('button', { name: /log out/i });
      fireEvent.press(logoutBtn);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('AdminDashboard', () => {
    it('renders admin dashboard with user info and handles logout', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'a1', email: 'admin@kwatapos.com', role: 'admin' },
        accessToken: 'token',
        refreshToken: 'refresh',
        isLoading: false,
        login: jest.fn(),
        logout: mockLogout,
      });

      render(<AdminDashboard />);
      expect(screen.getByText('Admin Dashboard')).toBeTruthy();
      expect(screen.getByText('admin@kwatapos.com')).toBeTruthy();
      expect(screen.getByText('admin')).toBeTruthy();

      const logoutBtn = screen.getByRole('button', { name: /log out/i });
      fireEvent.press(logoutBtn);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});
