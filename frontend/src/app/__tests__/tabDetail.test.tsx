import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import TabDetailScreen from '../(sales)/tab/[id]';
import { useCartStore } from '../../features/sales/store/cartStore';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'tab-order-1' }),
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

const mockOrderDetail = {
  id: 'tab-order-1',
  order_name: 'Table 4',
  payment_method: null,
  total_amount: 2000,
  status: 'open',
  items: [
    {
      id: 'item-1',
      order_id: 'tab-order-1',
      product_id: 'prod-1',
      product_name: 'Castel Beer 65cl',
      quantity: 2,
      unit_price: 1000,
      subtotal: 2000,
      created_at: '2026-09-17T12:00:00Z',
    },
  ],
  created_at: '2026-09-17T12:00:00Z',
  updated_at: '2026-09-17T12:00:00Z',
};

const mockProducts = [
  {
    id: 'prod-1',
    name: 'Castel Beer 65cl',
    price: 1000,
    category: 'Beer',
    quantity: 20,
  },
  {
    id: 'prod-2',
    name: 'Guinness Foreign Extra',
    price: 1500,
    category: 'Stout',
    quantity: 10,
  },
];

describe('TabDetailScreen', () => {
  beforeEach(() => {
    useCartStore.getState().clearActiveOrder();
    jest.clearAllMocks();

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/orders/tab-order-1/items')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockOrderDetail,
        };
      }
      if (url.includes('/api/orders/tab-order-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockOrderDetail,
        };
      }
      if (url.includes('/api/products')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockProducts,
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
  });

  it('fetches tab details on mount, sets cart store active order, and renders header', async () => {
    render(<TabDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Table 4')).toBeTruthy();
      expect(screen.getByText('OPEN')).toBeTruthy();
    });

    // Cart store should be populated with active tab info and items
    expect(useCartStore.getState().activeOrderId).toBe('tab-order-1');
    expect(useCartStore.getState().activeOrderName).toBe('Table 4');
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].product.name).toBe('Castel Beer 65cl');
    expect(useCartStore.getState().items[0].quantity).toBe(2);
  });

  it('navigates back to open orders when pressing back button', async () => {
    render(<TabDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Table 4')).toBeTruthy();
    });

    const backBtn = screen.getByRole('button', { name: /open orders|tabs/i });
    fireEvent.press(backBtn);

    expect(mockPush).toHaveBeenCalledWith('/(sales)');
  });

  it('allows saving tab changes via CartSidebar Save Tab button', async () => {
    render(<TabDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Table 4')).toBeTruthy();
    });

    const cartTab = screen.getByRole('tab', { name: /cart/i });
    fireEvent.press(cartTab);

    const saveBtn = screen.getByTestId('save-tab-button');
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders/tab-order-1/items'),
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ product_id: 'prod-1', quantity: 2 }],
          }),
        })
      );
      expect(screen.getByText('Tab saved successfully!')).toBeTruthy();
    });
  });

  it('opens settlement modal on Settle Tab press and settles order successfully', async () => {
    const mockSettledOrder = {
      id: 'tab-order-1',
      order_name: 'Table 4',
      status: 'closed',
      payment_method: 'cash',
      total_amount: 2000,
    };

    render(<TabDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Table 4')).toBeTruthy();
    });

    const cartTab = screen.getByRole('tab', { name: /cart/i });
    fireEvent.press(cartTab);

    const settleBtn = screen.getByTestId('settle-tab-button');
    fireEvent.press(settleBtn);

    // Settlement modal is visible
    await waitFor(() => {
      expect(screen.getByText('Settle Order')).toBeTruthy();
      expect(screen.getByTestId('confirm-settlement-button')).toBeTruthy();
    });

    (global.fetch as jest.Mock).mockImplementationOnce(async (url: string) => {
      if (url.includes('/api/orders/tab-order-1/settle')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockSettledOrder,
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const confirmBtn = screen.getByTestId('confirm-settlement-button');
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders/tab-order-1/settle'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_method: 'cash' }),
        })
      );
      // Clears active order and navigates to /(sales)
      expect(useCartStore.getState().activeOrderId).toBeNull();
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(sales)',
        params: { settledTab: 'Table 4' },
      });
    });
  });

  it('clears active order on unmount', async () => {
    const { unmount } = render(<TabDetailScreen />);

    await waitFor(() => {
      expect(useCartStore.getState().activeOrderId).toBe('tab-order-1');
    });

    unmount();

    expect(useCartStore.getState().activeOrderId).toBeNull();
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
