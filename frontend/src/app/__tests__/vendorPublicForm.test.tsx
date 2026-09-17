import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import VendorPublicForm from '../public/vendor/[token]';

let mockParams = { token: 'token-test-123' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

const mockRequisition = {
  id: 'req-1',
  token: 'token-test-123',
  title: 'Weekly Restock Order',
  status: 'sent',
  items: [
    {
      id: 'item-1',
      requisition_id: 'req-1',
      product_id: 'prod-1',
      product_name: 'Beaufort Lager',
      quantity: 24,
      expected_price: 1000,
      confirmed_price: null,
      received_quantity: null,
    },
    {
      id: 'item-2',
      requisition_id: 'req-1',
      product_id: 'prod-2',
      product_name: 'Guinness Foreign Extra',
      quantity: 10,
      expected_price: 1500,
      confirmed_price: 1500,
      received_quantity: null,
    },
  ],
};

describe('VendorPublicForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockParams = { token: 'token-test-123' };
  });

  it('displays loading state while fetching requisition', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<VendorPublicForm />);

    expect(screen.getByTestId('vendor-loading')).toBeTruthy();
    expect(screen.getByText('Loading requisition...')).toBeTruthy();
  });

  it('renders clean error message if fetching fails or 404', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    render(<VendorPublicForm />);

    await waitFor(() => {
      expect(screen.getByTestId('vendor-error')).toBeTruthy();
    });

    expect(screen.getByText('Requisition not found or link has expired.')).toBeTruthy();
  });

  it('fetches vendor requisition by token and renders details and prices', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRequisition,
    });

    render(<VendorPublicForm />);

    await waitFor(() => {
      expect(screen.getByText('Vendor Price Confirmation')).toBeTruthy();
    });

    expect(screen.getByText('Weekly Restock Order')).toBeTruthy();
    expect(screen.getByText('Beaufort Lager')).toBeTruthy();
    expect(screen.getByText('Qty: 24')).toBeTruthy();
    expect(screen.getByText('Guinness Foreign Extra')).toBeTruthy();
    expect(screen.getByText('Qty: 10')).toBeTruthy();

    // Prominent total display: 24 * 1000 + 10 * 1500 = 39,000 FCFA
    expect(screen.getByTestId('vendor-total-value')).toBeTruthy();
    expect(screen.getByText('39,000 FCFA')).toBeTruthy();

    // Confirm button is present
    expect(screen.getByTestId('confirm-submit-prices-btn')).toBeTruthy();
  });

  it('allows editing confirmed prices, updates total, and submits confirmation', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequisition,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockRequisition,
          status: 'accepted',
        }),
      });

    render(<VendorPublicForm />);

    await waitFor(() => {
      expect(screen.getByTestId('price-input-item-1')).toBeTruthy();
    });

    // Edit unit price of item 1 from 1000 to 1100
    fireEvent.changeText(screen.getByTestId('price-input-item-1'), '1100');

    // New total should be: 24 * 1100 + 10 * 1500 = 26,400 + 15,000 = 41,400 FCFA
    expect(screen.getByText('41,400 FCFA')).toBeTruthy();

    // Submit prices
    const submitBtn = screen.getByTestId('confirm-submit-prices-btn');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/public/requisition/token-test-123'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              { item_id: 'item-1', confirmed_price: 1100 },
              { item_id: 'item-2', confirmed_price: 1500 },
            ],
          }),
        })
      );
    });
  });

  it('renders System Green success banner on submission success', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequisition,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockRequisition, status: 'accepted' }),
      });

    render(<VendorPublicForm />);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-submit-prices-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('confirm-submit-prices-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-success-banner')).toBeTruthy();
    });

    expect(
      screen.getByText('Prices Confirmed! Thank you. The manager has been notified.')
    ).toBeTruthy();

    // Submit button should be hidden after confirmation
    expect(screen.queryByTestId('confirm-submit-prices-btn')).toBeNull();
  });
});
