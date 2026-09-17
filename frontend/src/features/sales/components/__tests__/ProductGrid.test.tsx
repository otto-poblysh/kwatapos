import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ProductGrid } from '../ProductGrid';
import { useCartStore } from '../../store/cartStore';

// Mock fetch
const mockProducts = [
  {
    id: 'prod-1',
    name: 'Castel Beer 65cl',
    price: 1000,
    category: 'Beer',
    quantity: 25,
  },
  {
    id: 'prod-2',
    name: 'Guinness Foreign Extra',
    price: 1500,
    category: 'Stout',
    quantity: 10,
  },
  {
    id: 'prod-3',
    name: 'Mineral Water 1.5L',
    price: 500,
    category: 'Water',
    quantity: 0, // Out of stock
  },
];

describe('ProductGrid', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    jest.clearAllMocks();
  });

  it('renders loading indicator while fetching', async () => {
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => mockProducts,
              } as Response),
            200
          )
        )
    ) as jest.Mock;

    render(<ProductGrid apiBaseUrl="http://127.0.0.1:3014" />);

    expect(screen.getByTestId('product-grid-loading')).toBeTruthy();
  });

  it('renders products list with name, category, price, and add button', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProducts,
    });

    render(<ProductGrid apiBaseUrl="http://127.0.0.1:3014" />);

    await waitFor(() => {
      expect(screen.getByText('Castel Beer 65cl')).toBeTruthy();
    });

    expect(screen.getByText('Beer')).toBeTruthy();
    expect(screen.getByText('1,000 FCFA')).toBeTruthy();
    expect(screen.getByText('Guinness Foreign Extra')).toBeTruthy();
    expect(screen.getByText('Stout')).toBeTruthy();
    expect(screen.getByText('1,500 FCFA')).toBeTruthy();
  });

  it('adds item to cart store when Add button is pressed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProducts,
    });

    render(<ProductGrid apiBaseUrl="http://127.0.0.1:3014" />);

    await waitFor(() => {
      expect(screen.getByText('Castel Beer 65cl')).toBeTruthy();
    });

    const addBtn = screen.getByTestId('product-add-prod-1');
    fireEvent.press(addBtn);

    const cartItems = useCartStore.getState().items;
    expect(cartItems).toHaveLength(1);
    expect(cartItems[0].product.name).toBe('Castel Beer 65cl');
    expect(cartItems[0].quantity).toBe(1);
  });

  it('shows out of stock badge and disables add for 0-quantity items', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProducts,
    });

    render(<ProductGrid apiBaseUrl="http://127.0.0.1:3014" />);

    await waitFor(() => {
      expect(screen.getByText('Mineral Water 1.5L')).toBeTruthy();
    });

    expect(screen.getByText('Out of stock')).toBeTruthy();
    const disabledBtn = screen.getByTestId('product-add-prod-3');
    fireEvent.press(disabledBtn);

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('displays error message and retry button on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    render(<ProductGrid apiBaseUrl="http://127.0.0.1:3014" />);

    await waitFor(() => {
      expect(screen.getByTestId('product-grid-error')).toBeTruthy();
    });

    expect(screen.getByText('Network error')).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
