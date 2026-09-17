export type ExpenseStatus = 'requested' | 'approved' | 'receipt_uploaded';

export const EXPENSE_CATEGORIES = [
  'Cigarettes',
  'Fish',
  'Supplies',
  'Soap',
  'Maintenance',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface DirectExpense {
  id: string;
  requested_by?: string | null;
  category: string;
  amount: number | string;
  status: ExpenseStatus;
  receipt_image_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExpensePayload {
  category: string;
  amount: number;
  notes?: string;
  requested_by?: string;
}

export interface UploadReceiptPayload {
  receipt_image_url: string;
}
