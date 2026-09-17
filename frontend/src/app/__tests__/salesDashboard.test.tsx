import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SalesDashboard from '../(sales)/index';
import { useAuth } from '../../core/hooks/useAuth';

jest.mock('../../core/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

const mockOrders = [
  {
    id: 'order-1',
    order_name: 'Table 4',
    payment_method: null,
    total_amount: 2600,
    status: 'open',
    items_count: 3,
    created_at: '2026-09-17T12:00:00Z',
    updated_at: '2026-09-17T12:30:00Z',
  },
  {
    id: 'order-2',
    order_name: 'VIP Lounge',
    payment_method: null,
    total_amount: 15000,
    status: 'open',
    items_count: 5,
    created_at: '2026-09-17T13:00:00Z',
    updated_at: '2026-09-17T13:15:00Z',
  },
];

describe('Open Orders Dashboard', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 's1', email: 'sales@kwatapos.com', role: 'sales' },
      accessToken: 'token-abc',
      refreshToken: 'refresh-abc',
      isLoading: false,
      login: jest.fn(),
      logout: mockLogout,
    });

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockOrders,
        };
      }
      return { ok: true, status: 200, json: async () => [] };
    });
  });

  it('renders header with user email, role, log out button, and + New Tab button', async () => {
    render(<SalesDashboard />);

    expect(screen.getByText('sales@kwatapos.com')).toBeTruthy();
    expect(screen.getByText('sales')).toBeTruthy();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /\+ new tab|new tab/i })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Table 4')).toBeTruthy();
    });
  });

  it('fetches and renders open tab cards with name, prominent total, item count, and open status', async () => {
    render(<SalesDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Table 4')).toBeTruthy();
      expect(screen.getByText('VIP Lounge')).toBeTruthy();
    });

    expect(screen.getByText('2,600 FCFA')).toBeTruthy();
    expect(screen.getByText('15,000 FCFA')).toBeTruthy();
    expect(screen.getByText('3 items')).toBeTruthy();
    expect(screen.getByText('5 items')).toBeTruthy();
    expect(screen.getAllByText('OPEN').length).toBeGreaterThanOrEqual(2);
  });

  it('displays empty state when there are no open tabs', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    render(<SalesDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/no open tabs\. tap '\+ new tab' to start an order\./i)
      ).toBeTruthy();
    });
  });

  it('navigates to tab detail route when tapping a tab card', async () => {
    render(<SalesDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Table 4')).toBeTruthy();
    });

    const tabCard = screen.getByTestId('tab-card-order-1');
    fireEvent.press(tabCard);

    expect(mockPush).toHaveBeenCalledWith('/(sales)/tab/order-1');
  });

  it('opens new tab modal, allows entering tab name, calls POST /api/orders, and navigates to new tab', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string, options?: any) => {
      if (options?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: 'new-order-99',
            order_name: 'Terrace Table 2',
            total_amount: 0,
            status: 'open',
            items: [],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => mockOrders,
      };
    });

    render(<SalesDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Table 4')).toBeTruthy();
    });

    const newTabBtn = screen.getByRole('button', { name: /\+ new tab|new tab/i });
    fireEvent.press(newTabBtn);

    const input = screen.getByPlaceholderText(/enter tab name/i);
    expect(input).toBeTruthy();

    fireEvent.changeText(input, 'Terrace Table 2');

    const createBtn = screen.getByRole('button', { name: /create tab/i });
    fireEvent.press(createBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_name: 'Terrace Table 2' }),
        })
      );
      expect(mockPush).toHaveBeenCalledWith('/(sales)/tab/new-order-99');
    });
  });
});
