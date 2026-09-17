import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SettlementModal } from '../SettlementModal';

describe('SettlementModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    orderId: 'order-123',
    orderName: 'Table 4',
    totalAmount: 2600,
    apiBaseUrl: 'http://127.0.0.1:3014',
    onSettlementSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders modal with title, order name, formatted total, and 4 payment options', () => {
    render(<SettlementModal {...defaultProps} />);

    expect(screen.getByText('Settle Order')).toBeTruthy();
    expect(screen.getByText('Table 4')).toBeTruthy();
    expect(screen.getByText('2,600 FCFA')).toBeTruthy();

    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('Card')).toBeTruthy();
    expect(screen.getByText('Bank Transfer')).toBeTruthy();
    expect(screen.getByText('Credit')).toBeTruthy();

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Confirm Settlement')).toBeTruthy();
  });

  it('allows switching payment methods', () => {
    render(<SettlementModal {...defaultProps} />);

    const cardButton = screen.getByTestId('payment-method-card');
    fireEvent.press(cardButton);
    // Card button becomes active (checked via press)

    const transferButton = screen.getByTestId('payment-method-transfer');
    fireEvent.press(transferButton);

    const creditButton = screen.getByTestId('payment-method-credit');
    fireEvent.press(creditButton);

    // Credit reveals customer section
    expect(screen.getByTestId('credit-customer-section')).toBeTruthy();
  });

  it('settles with cash by sending POST /api/orders/:id/settle', async () => {
    const mockSettledOrder = {
      id: 'order-123',
      order_name: 'Table 4',
      status: 'closed',
      payment_method: 'cash',
      total_amount: 2600,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSettledOrder,
    });

    render(<SettlementModal {...defaultProps} />);

    const confirmButton = screen.getByTestId('confirm-settlement-button');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3014/api/orders/order-123/settle',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_method: 'cash' }),
        })
      );
      expect(defaultProps.onSettlementSuccess).toHaveBeenCalledWith(mockSettledOrder);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('settles with bank transfer by sending POST /api/orders/:id/settle', async () => {
    const mockSettledOrder = {
      id: 'order-123',
      status: 'closed',
      payment_method: 'transfer',
      total_amount: 2600,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSettledOrder,
    });

    render(<SettlementModal {...defaultProps} />);

    const transferButton = screen.getByTestId('payment-method-transfer');
    fireEvent.press(transferButton);

    const confirmButton = screen.getByTestId('confirm-settlement-button');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3014/api/orders/order-123/settle',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_method: 'transfer' }),
        })
      );
      expect(defaultProps.onSettlementSuccess).toHaveBeenCalledWith(mockSettledOrder);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('disables confirm button when credit is selected without customer attached', () => {
    render(<SettlementModal {...defaultProps} />);

    const creditButton = screen.getByTestId('payment-method-credit');
    fireEvent.press(creditButton);

    const confirmButton = screen.getByTestId('confirm-settlement-button');
    expect(confirmButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('searches customer on credit flow, selects existing customer, and settles with customer_id', async () => {
    const mockCustomer = {
      id: 'cust-uuid-1',
      name: 'John Doe',
      phone_number: '+237690000000',
    };

    const mockSettledOrder = {
      id: 'order-123',
      status: 'closed',
      payment_method: 'credit',
      customer_id: 'cust-uuid-1',
      total_amount: 2600,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCustomer,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSettledOrder,
      });

    render(<SettlementModal {...defaultProps} />);

    // Select credit
    fireEvent.press(screen.getByTestId('payment-method-credit'));

    // Type phone number and search
    const phoneInput = screen.getByTestId('customer-phone-input');
    fireEvent.changeText(phoneInput, '+237690000000');

    const searchButton = screen.getByTestId('search-customer-button');
    fireEvent.press(searchButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3014/api/customers?phone=%2B237690000000'
      );
      expect(
        screen.getByText('Customer: John Doe (+237690000000)')
      ).toBeTruthy();
    });

    // Confirm button should now be enabled
    const confirmButton = screen.getByTestId('confirm-settlement-button');
    expect(confirmButton.props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3014/api/orders/order-123/settle',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_method: 'credit',
            customer_id: 'cust-uuid-1',
          }),
        })
      );
      expect(defaultProps.onSettlementSuccess).toHaveBeenCalledWith(mockSettledOrder);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles customer not found and creates customer inline', async () => {
    const createdCustomer = {
      id: 'cust-new-2',
      name: 'Alice Wonder',
      phone_number: '+237699999999',
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => null, // Customer not found
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createdCustomer,
      });

    render(<SettlementModal {...defaultProps} />);

    fireEvent.press(screen.getByTestId('payment-method-credit'));

    const phoneInput = screen.getByTestId('customer-phone-input');
    fireEvent.changeText(phoneInput, '+237699999999');

    fireEvent.press(screen.getByTestId('search-customer-button'));

    await waitFor(() => {
      expect(screen.getByText('Customer not found')).toBeTruthy();
      expect(screen.getByTestId('new-customer-name-input')).toBeTruthy();
    });

    // Enter new customer name and create
    const nameInput = screen.getByTestId('new-customer-name-input');
    fireEvent.changeText(nameInput, 'Alice Wonder');

    fireEvent.press(screen.getByTestId('create-customer-button'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3014/api/customers',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Alice Wonder',
            phone_number: '+237699999999',
          }),
        })
      );
      expect(
        screen.getByText('Customer: Alice Wonder (+237699999999)')
      ).toBeTruthy();
    });
  });

  it('displays red error banner when settlement API fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Insufficient stock for product' }),
    });

    render(<SettlementModal {...defaultProps} />);

    const confirmButton = screen.getByTestId('confirm-settlement-button');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(screen.getByTestId('settlement-error-banner')).toBeTruthy();
      expect(screen.getByText('Insufficient stock for product')).toBeTruthy();
    });

    expect(defaultProps.onSettlementSuccess).not.toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('triggers onClose when Cancel or Close buttons are pressed', () => {
    render(<SettlementModal {...defaultProps} />);

    const cancelButton = screen.getByTestId('cancel-settlement-button');
    fireEvent.press(cancelButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

    const closeHeaderButton = screen.getByRole('button', { name: /close settlement modal/i });
    fireEvent.press(closeHeaderButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
  });
});
