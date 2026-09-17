import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import SalesExpensesScreen from '../(sales)/expenses';
import ManagerExpensesScreen from '../(manager)/expenses';
import { ExpenseRequestModal } from '../../features/expenses/components/ExpenseRequestModal';
import { useAuth } from '../../core/hooks/useAuth';

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

jest.mock('../../core/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

const mockExpenses = [
  {
    id: 'exp-1',
    category: 'Cigarettes',
    amount: 12000,
    status: 'requested',
    receipt_image_url: null,
    notes: '2 cartons of Dunhill for bar counter',
    requested_by: 'user-sales-1',
    created_at: '2026-09-17T14:00:00Z',
    updated_at: '2026-09-17T14:00:00Z',
  },
  {
    id: 'exp-2',
    category: 'Fish',
    amount: 25000,
    status: 'approved',
    receipt_image_url: null,
    notes: 'Fresh fish from market for evening grill',
    requested_by: 'user-sales-1',
    created_at: '2026-09-17T12:00:00Z',
    updated_at: '2026-09-17T12:30:00Z',
  },
  {
    id: 'exp-3',
    category: 'Soap',
    amount: 4500,
    status: 'receipt_uploaded',
    receipt_image_url: 'data:image/jpeg;base64,mockreceiptbase64string',
    notes: 'Dishwashing soap and detergent',
    requested_by: 'user-sales-1',
    created_at: '2026-09-17T10:00:00Z',
    updated_at: '2026-09-17T10:45:00Z',
  },
];

describe('Direct Expenses & Camera Receipt Uploads', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-sales-1', email: 'sales@kwatapos.com', role: 'sales' },
      accessToken: 'token',
      refreshToken: 'refresh',
      isLoading: false,
      login: jest.fn(),
      loginCustomer: jest.fn(),
      logout: jest.fn(),
    });

    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ base64: 'samplebase64data', uri: 'file:///receipt.jpg' }],
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ base64: 'samplebase64data', uri: 'file:///receipt.jpg' }],
    });
  });

  describe('ExpenseRequestModal', () => {
    it('renders all preset categories and submits cash request with correct payload', async () => {
      const mockClose = jest.fn();
      const mockSuccess = jest.fn();

      global.fetch = jest.fn().mockImplementation((url, options) => {
        if (url.endsWith('/api/expenses') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({
              id: 'exp-new',
              category: 'Fish',
              amount: 15000,
              notes: 'Market purchase',
              status: 'requested',
            }),
          });
        }
        return Promise.reject(new Error('Unknown route'));
      });

      render(
        <ExpenseRequestModal
          visible={true}
          onClose={mockClose}
          onSuccess={mockSuccess}
          apiBaseUrl="http://127.0.0.1:3014"
        />
      );

      expect(screen.getByText('New Cash Request')).toBeTruthy();

      // Verify preset categories
      expect(screen.getByTestId('category-chip-cigarettes')).toBeTruthy();
      expect(screen.getByTestId('category-chip-fish')).toBeTruthy();
      expect(screen.getByTestId('category-chip-supplies')).toBeTruthy();
      expect(screen.getByTestId('category-chip-soap')).toBeTruthy();
      expect(screen.getByTestId('category-chip-maintenance')).toBeTruthy();
      expect(screen.getByTestId('category-chip-other')).toBeTruthy();

      // Select Fish category
      fireEvent.press(screen.getByTestId('category-chip-fish'));

      // Enter amount
      const amountInput = screen.getByTestId('expense-amount-input');
      fireEvent.changeText(amountInput, '15000');

      // Check number prominence preview
      expect(screen.getByText('15,000 FCFA')).toBeTruthy();

      // Enter notes
      const notesInput = screen.getByTestId('expense-notes-input');
      fireEvent.changeText(notesInput, 'Market purchase');

      // Submit
      const submitBtn = screen.getByTestId('submit-expense-request-btn');
      fireEvent.press(submitBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://127.0.0.1:3014/api/expenses',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              category: 'Fish',
              amount: 15000,
              notes: 'Market purchase',
              requested_by: 'user-sales-1',
            }),
          })
        );
        expect(mockSuccess).toHaveBeenCalledTimes(1);
        expect(mockClose).toHaveBeenCalledTimes(1);
      });
    });

    it('shows validation error if amount is missing or non-positive', async () => {
      const mockClose = jest.fn();
      const mockSuccess = jest.fn();

      render(
        <ExpenseRequestModal
          visible={true}
          onClose={mockClose}
          onSuccess={mockSuccess}
          apiBaseUrl="http://127.0.0.1:3014"
        />
      );

      const submitBtn = screen.getByTestId('submit-expense-request-btn');
      fireEvent.press(submitBtn);

      expect(screen.getByText('Please enter a valid amount greater than 0')).toBeTruthy();
      expect(mockSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Shopkeeper / Sales Expense Screen', () => {
    it('displays expense items with status badges and opens modal on new request', async () => {
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.endsWith('/api/expenses')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockExpenses,
          });
        }
        return Promise.reject(new Error('Unknown route'));
      });

      render(<SalesExpensesScreen apiBaseUrl="http://127.0.0.1:3014" />);

      // Wait for loading to finish and list to render
      await waitFor(() => {
        expect(screen.getByText('Expenses & Cash Requests')).toBeTruthy();
        expect(screen.getByText('Cigarettes')).toBeTruthy();
        expect(screen.getByText('Fish')).toBeTruthy();
        expect(screen.getByText('Soap')).toBeTruthy();
      });

      // Status badges
      expect(screen.getByTestId('badge-requested-exp-1')).toBeTruthy();
      expect(screen.getByText('Pending Approval')).toBeTruthy();

      expect(screen.getByTestId('badge-approved-exp-2')).toBeTruthy();
      expect(screen.getByText('Approved')).toBeTruthy();

      expect(screen.getByTestId('badge-reconciled-exp-3')).toBeTruthy();
      expect(screen.getByText('Reconciled')).toBeTruthy();

      // Receipt thumbnail should be rendered for reconciled expense
      expect(screen.getByTestId('receipt-thumbnail-exp-3')).toBeTruthy();

      // Back button
      fireEvent.press(screen.getByTestId('sales-expenses-back-btn'));
      expect(mockBack).toHaveBeenCalled();

      // Open new cash request modal
      fireEvent.press(screen.getByTestId('new-cash-request-btn'));
      expect(screen.getByTestId('expense-request-modal')).toBeTruthy();
    });

    it('handles camera launch, base64 formatting, and receipt upload for approved expense', async () => {
      let expenseList = [...mockExpenses];

      global.fetch = jest.fn().mockImplementation((url, options) => {
        if (url.endsWith('/api/expenses') && (!options || options.method === 'GET')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => expenseList,
          });
        }
        if (url.includes('/api/expenses/exp-2/receipt') && options?.method === 'POST') {
          const body = JSON.parse(options.body as string);
          expenseList = expenseList.map((e) =>
            e.id === 'exp-2'
              ? {
                  ...e,
                  status: 'receipt_uploaded' as const,
                  receipt_image_url: body.receipt_image_url,
                }
              : e
          );
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => expenseList[1],
          });
        }
        return Promise.reject(new Error('Unknown route'));
      });

      render(<SalesExpensesScreen apiBaseUrl="http://127.0.0.1:3014" />);

      await waitFor(() => {
        expect(screen.getByTestId('upload-receipt-btn-exp-2')).toBeTruthy();
      });

      // Press Upload Receipt
      fireEvent.press(screen.getByTestId('upload-receipt-btn-exp-2'));

      await waitFor(() => {
        expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.7,
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'http://127.0.0.1:3014/api/expenses/exp-2/receipt',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              receipt_image_url: 'data:image/jpeg;base64,samplebase64data',
            }),
          })
        );
      });

      // Should show success toast and updated thumbnail
      await waitFor(() => {
        expect(screen.getByText('Receipt uploaded successfully!')).toBeTruthy();
        expect(screen.getByTestId('receipt-thumbnail-exp-2')).toBeTruthy();
      });
    });

    it('falls back to launchImageLibraryAsync if camera permissions fail or camera throws', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: false,
      });

      global.fetch = jest.fn().mockImplementation((url, options) => {
        if (url.endsWith('/api/expenses') && (!options || options.method === 'GET')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockExpenses,
          });
        }
        if (url.includes('/api/expenses/exp-2/receipt') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ...mockExpenses[1], status: 'receipt_uploaded' }),
          });
        }
        return Promise.reject(new Error('Unknown route'));
      });

      render(<SalesExpensesScreen apiBaseUrl="http://127.0.0.1:3014" />);

      await waitFor(() => {
        expect(screen.getByTestId('upload-receipt-btn-exp-2')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('upload-receipt-btn-exp-2'));

      await waitFor(() => {
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.7,
        });
      });
    });
  });

  describe('Manager Expense Oversight Screen', () => {
    it('displays all expenses and filters by status', async () => {
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.endsWith('/api/expenses')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockExpenses,
          });
        }
        return Promise.reject(new Error('Unknown route'));
      });

      render(<ManagerExpensesScreen apiBaseUrl="http://127.0.0.1:3014" />);

      await waitFor(() => {
        expect(screen.getByText('Direct Expenses Oversight')).toBeTruthy();
        expect(screen.getByText('All (3)')).toBeTruthy();
        expect(screen.getByText('Pending Approval (1)')).toBeTruthy();
        expect(screen.getByText('Approved (1)')).toBeTruthy();
        expect(screen.getByText('Reconciled (1)')).toBeTruthy();
      });

      // Filter by Pending Approval
      fireEvent.press(screen.getByTestId('filter-requested'));
      expect(screen.getByText('Cigarettes')).toBeTruthy();
      expect(screen.queryByText('Fish')).toBeNull();
      expect(screen.queryByText('Soap')).toBeNull();

      // Filter by Reconciled
      fireEvent.press(screen.getByTestId('filter-reconciled'));
      expect(screen.getByText('Soap')).toBeTruthy();
      expect(screen.queryByText('Cigarettes')).toBeNull();
      expect(screen.getByTestId('receipt-thumbnail-exp-3')).toBeTruthy();
    });

    it('allows manager to approve a requested expense', async () => {
      let expenseList = [...mockExpenses];

      global.fetch = jest.fn().mockImplementation((url, options) => {
        if (url.endsWith('/api/expenses') && (!options || options.method === 'GET')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => expenseList,
          });
        }
        if (url.includes('/api/expenses/exp-1/approve') && options?.method === 'POST') {
          expenseList = expenseList.map((e) =>
            e.id === 'exp-1' ? { ...e, status: 'approved' as const } : e
          );
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => expenseList[0],
          });
        }
        return Promise.reject(new Error('Unknown route'));
      });

      render(<ManagerExpensesScreen apiBaseUrl="http://127.0.0.1:3014" />);

      await waitFor(() => {
        expect(screen.getByTestId('approve-btn-exp-1')).toBeTruthy();
      });

      // Press Approve Expense
      fireEvent.press(screen.getByTestId('approve-btn-exp-1'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://127.0.0.1:3014/api/expenses/exp-1/approve',
          expect.objectContaining({ method: 'POST' })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Expense approved successfully!')).toBeTruthy();
        expect(screen.getByTestId('badge-approved-exp-1')).toBeTruthy();
      });
    });
  });
});
