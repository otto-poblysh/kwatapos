-- Alter orders table for open tabs and flexible checkout
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_name VARCHAR(255);
ALTER TABLE orders ALTER COLUMN payment_method DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create credits table
CREATE TABLE IF NOT EXISTS credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indices for foreign key performance
CREATE INDEX IF NOT EXISTS idx_credits_customer_id ON credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_credits_order_id ON credits(order_id);
