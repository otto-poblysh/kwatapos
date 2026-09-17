import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import SalesDashboard from '../(sales)/index';
import { useAuth } from '../../core/hooks/useAuth';
import { useCartStore } from '../../features/sales/store/cartStore';

jest.mock('../../core/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: jest.fn(),
}));

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

describe('SalesDashboard Component', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockUseWindowDimensions = useWindowDimensions as jest.MockedFunction<
    typeof useWindowDimensions
  >;
  const mockLogout = jest.fn();

  beforeEach(() => {
    useCartStore.getState().clearCart();
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 's1', email: 'sales@kwatapos.com', role: 'sales' },
      accessToken: 'token-abc',
      refreshToken: 'refresh-abc',
      isLoading: false,
      login: jest.fn(),
      logout: mockLogout,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProducts,
    });
  });

  describe('Mobile Layout (< 768px)', () => {
    beforeEach(() => {
      mockUseWindowDimensions.mockReturnValue({
        width: 390,
        height: 844,
        scale: 3,
        fontScale: 1,
      });
    });

    it('renders header with user email, role badge, and mobile tabs', async () => {
      render(<SalesDashboard />);

      expect(screen.getByText('Sales Dashboard')).toBeTruthy();
      expect(screen.getByText('sales@kwatapos.com')).toBeTruthy();
      expect(screen.getByText('sales')).toBeTruthy();
      expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();

      expect(screen.getByRole('tab', { name: 'Products' })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /cart \(0\)/i })).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByText('Castel Beer 65cl')).toBeTruthy();
      });
    });

    it('shows floating quick cart bar when items are in cart and switches to cart on tap', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Castel Beer 65cl')).toBeTruthy();
      });

      // Add product
      const addBtn = screen.getByTestId('product-add-prod-1');
      fireEvent.press(addBtn);

      // Floating cart bar should now be visible
      const floatingBar = screen.getByRole('button', {
        name: /view cart: 1 item, 1,000 fcfa/i,
      });
      expect(floatingBar).toBeTruthy();

      // Tap floating bar -> switches to Cart tab
      fireEvent.press(floatingBar);

      // Now in cart view: CartSidebar is displayed
      expect(screen.getByText('Current Order')).toBeTruthy();
      expect(screen.getByRole('button', { name: /checkout \(cash\)/i })).toBeTruthy();
    });

    it('switches between Products and Cart tabs using tab buttons', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Castel Beer 65cl')).toBeTruthy();
      });

      const cartTab = screen.getByRole('tab', { name: /cart \(0\)/i });
      fireEvent.press(cartTab);

      expect(screen.getByText('Your cart is empty')).toBeTruthy();

      const productsTab = screen.getByRole('tab', { name: 'Products' });
      fireEvent.press(productsTab);

      expect(screen.getByText('Castel Beer 65cl')).toBeTruthy();
    });
  });

  describe('Wide Layout (>= 768px)', () => {
    beforeEach(() => {
      mockUseWindowDimensions.mockReturnValue({
        width: 1024,
        height: 768,
        scale: 2,
        fontScale: 1,
      });
    });

    it('renders both ProductGrid and CartSidebar side-by-side without mobile tabs', async () => {
      render(<SalesDashboard />);

      // Mobile tabs should not be present
      expect(screen.queryByRole('tab', { name: 'Products' })).toBeNull();

      await waitFor(() => {
        expect(screen.getByText('Castel Beer 65cl')).toBeTruthy();
      });

      // Cart sidebar is also rendered simultaneously
      expect(screen.getByText('Current Order')).toBeTruthy();
      expect(screen.getByText('Your cart is empty')).toBeTruthy();
    });

    it('refetches products and updates stock badge after successful checkout', async () => {
      let fetchCount = 0;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/products')) {
          fetchCount++;
          return {
            ok: true,
            json: async () => [
              {
                id: 'prod-1',
                name: 'Castel Beer 65cl',
                price: 1000,
                category: 'Beer',
                quantity: fetchCount === 1 ? 20 : 19,
              },
            ],
          };
        }
        if (url.includes('/api/orders/cash')) {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              id: 'order-1',
              total_amount: 1000,
              items: [],
            }),
          };
        }
        return { ok: true, json: async () => [] };
      });

      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('20 in stock')).toBeTruthy();
      });

      const addBtn = screen.getByTestId('product-add-prod-1');
      fireEvent.press(addBtn);

      const checkoutBtn = screen.getByRole('button', { name: /checkout \(cash\)/i });
      fireEvent.press(checkoutBtn);

      await waitFor(() => {
        expect(screen.getByText('19 in stock')).toBeTruthy();
      });
    });
  });
});
