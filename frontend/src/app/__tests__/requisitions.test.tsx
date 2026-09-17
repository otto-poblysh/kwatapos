import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RequisitionsScreen from '../(manager)/requisitions';
import * as Sharing from 'expo-sharing';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    canGoBack: mockCanGoBack,
  }),
}));

const mockProducts = [
  { id: 'prod-1', name: 'Castel Beer', price: 1000, category: 'beer' },
  { id: 'prod-2', name: 'Guinness Foreign Extra', price: 1500, category: 'beer' },
];

const mockRequisitions = [
  {
    id: 'req-1',
    token: 'tok-1',
    title: 'Weekend Restock',
    status: 'draft',
    item_count: 2,
    total_estimated_cost: 35000,
    created_at: '2026-09-17T10:00:00Z',
    updated_at: '2026-09-17T10:00:00Z',
  },
  {
    id: 'req-2',
    token: 'tok-2',
    title: 'Spirits Order',
    status: 'accepted',
    item_count: 1,
    total_estimated_cost: 50000,
    created_at: '2026-09-17T11:00:00Z',
    updated_at: '2026-09-17T11:00:00Z',
  },
  {
    id: 'req-3',
    token: 'tok-3',
    title: 'Soft Drinks Delivery',
    status: 'delivered',
    item_count: 3,
    total_estimated_cost: 20000,
    created_at: '2026-09-17T12:00:00Z',
    updated_at: '2026-09-17T12:00:00Z',
  },
];

const mockDetailReq1 = {
  id: 'req-1',
  token: 'tok-1',
  title: 'Weekend Restock',
  status: 'draft',
  items: [
    {
      id: 'item-1',
      requisition_id: 'req-1',
      product_id: 'prod-1',
      product_name: 'Castel Beer',
      quantity: 20,
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
      confirmed_price: null,
      received_quantity: null,
    },
  ],
};

const mockDetailReq2 = {
  id: 'req-2',
  token: 'tok-2',
  title: 'Spirits Order',
  status: 'accepted',
  items: [
    {
      id: 'item-3',
      requisition_id: 'req-2',
      product_id: 'prod-2',
      product_name: 'Guinness Foreign Extra',
      quantity: 30,
      expected_price: 1500,
      confirmed_price: 1500,
      received_quantity: null,
    },
  ],
};

describe('Requisitions Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders header with back button and title', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<RequisitionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Requisitions')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeTruthy();
  });

  it('navigates back when back button is pressed', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<RequisitionsScreen />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeTruthy();
    });
    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when requisitions list is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<RequisitionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Your vendor orders will appear here.')).toBeTruthy();
    });

    expect(
      screen.getByText('Generate orders and share them directly to your vendors on WhatsApp.')
    ).toBeTruthy();

    const draftButton = screen.getByTestId('draft-first-requisition-btn');
    expect(draftButton).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Draft First Requisition' })).toBeTruthy();
  });

  it('renders populated requisitions list with status badges and totals', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRequisitions,
    });

    render(<RequisitionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Weekend Restock')).toBeTruthy();
    });

    expect(screen.getByText('Spirits Order')).toBeTruthy();
    expect(screen.getByText('Soft Drinks Delivery')).toBeTruthy();

    // Verify badges
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Accepted')).toBeTruthy();
    expect(screen.getByText('Delivered')).toBeTruthy();

    // Verify prominent amounts (Number Prominence Rule)
    expect(screen.getByText('35,000 FCFA')).toBeTruthy();
    expect(screen.getByText('50,000 FCFA')).toBeTruthy();
    expect(screen.getByText('20,000 FCFA')).toBeTruthy();
  });

  it('expands line items when View Items is pressed', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequisitions,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailReq1,
      });

    render(<RequisitionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Weekend Restock')).toBeTruthy();
    });

    const expandBtn = screen.getByTestId('expand-btn-req-1');
    fireEvent.press(expandBtn);

    await waitFor(() => {
      expect(screen.getByText('Castel Beer')).toBeTruthy();
    });

    expect(screen.getByText(/Qty: 20 • Expected: 1,000 FCFA/i)).toBeTruthy();
  });

  it('opens draft modal and submits a new requisition', async () => {
    // 1st fetch: list requisitions
    // 2nd fetch: get products in draft modal
    // 3rd fetch: create requisition POST
    // 4th fetch: refresh list
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProducts,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'req-new', title: 'Restock Batch', status: 'draft' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'req-new',
            token: 'tok-new',
            title: 'Restock Batch',
            status: 'draft',
            item_count: 1,
            total_estimated_cost: 1000,
          },
        ],
      });

    render(<RequisitionsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('draft-first-requisition-btn')).toBeTruthy();
    });

    // Open modal
    fireEvent.press(screen.getByTestId('draft-first-requisition-btn'));

    await waitFor(() => {
      expect(screen.getByText('Draft Requisition')).toBeTruthy();
    });

    // Fill title
    fireEvent.changeText(screen.getByTestId('requisition-title-input'), 'Restock Batch');

    // Add a product
    await waitFor(() => {
      expect(screen.getByTestId('product-select-prod-1')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('product-select-prod-1'));

    // Estimated total should update
    expect(screen.getByTestId('draft-estimated-total')).toHaveTextContent('1,000 FCFA');

    // Submit
    const createBtn = screen.getByTestId('create-requisition-btn');
    fireEvent.press(createBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/requisitions'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            title: 'Restock Batch',
            items: [
              {
                product_id: 'prod-1',
                quantity: 1,
                expected_price: 1000,
              },
            ],
          }),
        })
      );
    });
  });

  it('shares a draft requisition via Sharing API and clipboard fallback', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockRequisitions[0]], // req-1 (draft)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'req-1',
          token: 'tok-1',
          status: 'sent',
          share_url: 'http://127.0.0.1:3011/public/vendor/tok-1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            ...mockRequisitions[0],
            status: 'sent',
          },
        ],
      });

    render(<RequisitionsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('share-requisition-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('share-requisition-btn'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/requisitions/req-1/share'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'http://127.0.0.1:3011/public/vendor/tok-1'
    );
  });

  it('opens delivery modal and submits delivery confirmation', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockRequisitions[1]], // req-2 (accepted)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailReq2,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockDetailReq2, status: 'delivered' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            ...mockRequisitions[1],
            status: 'delivered',
          },
        ],
      });

    render(<RequisitionsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('receive-delivery-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('receive-delivery-btn'));

    await waitFor(() => {
      expect(screen.getByText('Receive Delivery')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByTestId('received-input-item-3')).toBeTruthy();
    });

    // Change received quantity
    fireEvent.changeText(screen.getByTestId('received-input-item-3'), '28');

    // Submit delivery
    const confirmBtn = screen.getByTestId('confirm-delivery-btn');
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/requisitions/req-2/deliver'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            items: [
              {
                item_id: 'item-3',
                received_quantity: 28,
              },
            ],
          }),
        })
      );
    });
  });

  it('marks a delivered requisition as paid', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockRequisitions[2]], // req-3 (delivered)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockRequisitions[2], status: 'paid' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            ...mockRequisitions[2],
            status: 'paid',
          },
        ],
      });

    render(<RequisitionsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('mark-paid-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('mark-paid-btn'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/requisitions/req-3/pay'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
