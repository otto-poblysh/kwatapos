-- Create requisitions table
CREATE TABLE IF NOT EXISTS requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL DEFAULT 'Stock Requisition',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create requisition items table
CREATE TABLE IF NOT EXISTS requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    expected_price DECIMAL(12, 2) NOT NULL CHECK (expected_price >= 0),
    confirmed_price DECIMAL(12, 2) CHECK (confirmed_price IS NULL OR confirmed_price >= 0),
    received_quantity INT CHECK (received_quantity IS NULL OR received_quantity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create direct expenses table
CREATE TABLE IF NOT EXISTS direct_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'requested',
    receipt_image_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for requisitions, requisition items, and direct expenses
CREATE INDEX IF NOT EXISTS idx_requisitions_token ON requisitions(token);
CREATE INDEX IF NOT EXISTS idx_requisition_items_requisition_id ON requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS idx_requisition_items_product_id ON requisition_items(product_id);
CREATE INDEX IF NOT EXISTS idx_direct_expenses_status ON direct_expenses(status);
CREATE INDEX IF NOT EXISTS idx_direct_expenses_requested_by ON direct_expenses(requested_by);
