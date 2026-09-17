import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Index from '../index';
import { useAuth } from '../../core/hooks/useAuth';

jest.mock('../../core/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect">{`Redirect to ${href}`}</Text>,
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useSegments: () => [],
  };
});

describe('Index Route', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  it('displays loading state while checking authentication', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: true,
      login: jest.fn(),
      loginCustomer: jest.fn(),
      logout: jest.fn(),
    });

    render(<Index />);
    expect(screen.getByTestId('index-loading')).toBeTruthy();
  });

  it('redirects unauthenticated user to (auth)/login', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      login: jest.fn(),
      loginCustomer: jest.fn(),
      logout: jest.fn(),
    });

    render(<Index />);
    expect(screen.getByText('Redirect to /(auth)/login')).toBeTruthy();
  });

  it('redirects admin to (admin)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'admin@kwatapos.com', role: 'admin' },
      accessToken: 'token',
      refreshToken: 'refresh',
      isLoading: false,
      login: jest.fn(),
      loginCustomer: jest.fn(),
      logout: jest.fn(),
    });

    render(<Index />);
    expect(screen.getByText('Redirect to /(admin)')).toBeTruthy();
  });

  it('redirects manager to (manager)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '2', email: 'manager@kwatapos.com', role: 'manager' },
      accessToken: 'token',
      refreshToken: 'refresh',
      isLoading: false,
      login: jest.fn(),
      loginCustomer: jest.fn(),
      logout: jest.fn(),
    });

    render(<Index />);
    expect(screen.getByText('Redirect to /(manager)')).toBeTruthy();
  });

  it('redirects sales to (sales)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '3', email: 'sales@kwatapos.com', role: 'sales' },
      accessToken: 'token',
      refreshToken: 'refresh',
      isLoading: false,
      login: jest.fn(),
      loginCustomer: jest.fn(),
      logout: jest.fn(),
    });

    render(<Index />);
    expect(screen.getByText('Redirect to /(sales)')).toBeTruthy();
  });

  it('redirects customer to customer dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '4', email: '+237690000000', role: 'customer' },
      accessToken: 'token',
      refreshToken: 'refresh',
      isLoading: false,
      login: jest.fn(),
      loginCustomer: jest.fn(),
      logout: jest.fn(),
    });

    render(<Index />);
    expect(screen.getByText('Redirect to /customer/dashboard')).toBeTruthy();
  });
});
