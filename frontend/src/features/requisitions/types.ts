export type RequisitionStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'partial_delivery'
  | 'delivered'
  | 'paid';

export interface RequisitionItem {
  id: string;
  requisition_id?: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  expected_price: number | string;
  confirmed_price?: number | string | null;
  received_quantity?: number | null;
  created_at?: string;
}

export interface RequisitionSummary {
  id: string;
  token: string;
  title: string;
  status: RequisitionStatus | string;
  item_count?: number;
  items_count?: number;
  total_estimated_cost?: number | string;
  total_amount?: number | string;
  created_at?: string;
  updated_at?: string;
}

export interface RequisitionDetail {
  id: string;
  token: string;
  title: string;
  status: RequisitionStatus | string;
  items: RequisitionItem[];
  created_at?: string;
  updated_at?: string;
}
