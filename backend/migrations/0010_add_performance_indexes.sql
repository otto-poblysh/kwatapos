-- Accelerate daily reconciliation, customer login, and public vendor lookups.
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_completed_updated_at
    ON orders(updated_at)
    WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_customers_phone_number ON customers(phone_number);

CREATE INDEX IF NOT EXISTS idx_requisitions_token ON requisitions(token);

CREATE INDEX IF NOT EXISTS idx_credits_customer_unpaid
    ON credits(customer_id)
    WHERE status = 'unpaid';

CREATE INDEX IF NOT EXISTS idx_direct_expenses_approved_updated_at
    ON direct_expenses(updated_at)
    WHERE status IN ('approved', 'receipt_uploaded');
