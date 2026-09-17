import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { CartSidebar } from '../CartSidebar';
import { useCartStore, Product } from '../../store/cartStore';

const mockProduct1: Product = {
  id: 'prod-1',
  name: 'Castel Beer 65cl',
  price: 1000,
  category: 'Beer',
  quantity: 20,
};

const mockProduct2: Product = {
  id: 'prod-2',
  name: 'Guinness Foreign Extra',
  price: 1500,
  category: 'Stout',
  quantity: 10,
};

describe('CartSidebar', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    jest.clearAllMocks();
  });

  it('displays empty cart message when cart is empty', () => {
    render(<CartSidebar apiBaseUrl="http://127.0.0.1:3014" />);

    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    expect(screen.getByText(/Select products to start/i)).toBeTruthy();

    const checkoutBtn = screen.getByRole('button', { name: /checkout \(cash\)/i });
    expect(checkoutBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('displays cart items with quantity controls, subtotals, and prominent total', () => {
    useCartStore.getState().addItem(mockProduct1);
    useCartStore.getState().addItem(mockProduct1); // 2 * 1000 = 2000
    useCartStore.getState().addItem(mockProduct2); // 1 * 1500 = 1500

    render(<CartSidebar apiBaseUrl="http://127.0.0.1:3014" />);

    expect(screen.getByText('Castel Beer 65cl')).toBeTruthy();
    expect(screen.getByText('Guinness Foreign Extra')).toBeTruthy();
    expect(screen.getByText('2,000 FCFA')).toBeTruthy();
    expect(screen.getByText('1,500 FCFA')).toBeTruthy();

    // Prominent Total Price (3,500 FCFA)
    expect(screen.getByText('3,500 FCFA')).toBeTruthy();
  });

  it('increments and decrements item quantities via + and - buttons', () => {
    useCartStore.getState().addItem(mockProduct1);

    render(<CartSidebar apiBaseUrl="http://127.0.0.1:3014" />);

    const incBtn = screen.getByTestId('cart-inc-prod-1');
    fireEvent.press(incBtn);
    expect(useCartStore.getState().items[0].quantity).toBe(2);

    const decBtn = screen.getByTestId('cart-dec-prod-1');
    fireEvent.press(decBtn);
    expect(useCartStore.getState().items[0].quantity).toBe(1);

    // Decrementing when quantity is 1 removes the item
    fireEvent.press(decBtn);
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
  });

  it('handles successful cash checkout by sending POST request and displaying green success banner', async () => {
    useCartStore.getState().addItem(mockProduct1);
    useCartStore.getState().addItem(mockProduct1);

    const mockOrderResponse = {
      id: 'order-123',
      payment_method: 'cash',
      status: 'completed',
      total_amount: 2000,
      items: [{ product_id: 'prod-1', quantity: 2, unit_price: 1000 }],
      created_at: '2026-09-17T12:00:00Z',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockOrderResponse,
    });

    render(<CartSidebar apiBaseUrl="http://127.0.0.1:3014" />);

    const checkoutBtn = screen.getByRole('button', { name: /checkout \(cash\)/i });
    fireEvent.press(checkoutBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3014/api/orders/cash',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ product_id: 'prod-1', quantity: 2 }],
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('checkout-success-banner')).toBeTruthy();
    });

    expect(screen.getByText(/Order completed successfully/i)).toBeTruthy();
    // Cart must be cleared
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('displays red danger banner when checkout returns an error', async () => {
    useCartStore.getState().addItem(mockProduct1);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Insufficient stock for product prod-1' }),
    });

    render(<CartSidebar apiBaseUrl="http://127.0.0.1:3014" />);

    const checkoutBtn = screen.getByRole('button', { name: /checkout \(cash\)/i });
    fireEvent.press(checkoutBtn);

    await waitFor(() => {
      expect(screen.getByTestId('checkout-error-banner')).toBeTruthy();
    });

    expect(screen.getByText('Insufficient stock for product prod-1')).toBeTruthy();
    // Cart should NOT be cleared on failure
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it('clears success message when new items are added to the cart', async () => {
    useCartStore.getState().addItem(mockProduct1);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'order-123',
        payment_method: 'cash',
        status: 'completed',
        total_amount: 1000,
        items: [],
      }),
    });

    render(<CartSidebar apiBaseUrl="http://127.0.0.1:3014" />);

    const checkoutBtn = screen.getByRole('button', { name: /checkout \(cash\)/i });
    fireEvent.press(checkoutBtn);

    await waitFor(() => {
      expect(screen.getByTestId('checkout-success-banner')).toBeTruthy();
    });

    // Add a new item to the cart (wrapped in act)
    await waitFor(() => {
      useCartStore.getState().addItem(mockProduct2);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('checkout-success-banner')).toBeNull();
    });
  });
});
