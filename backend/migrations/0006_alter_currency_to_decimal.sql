ALTER TABLE products ALTER COLUMN price TYPE DECIMAL(12, 2);
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_check;
ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0);

ALTER TABLE orders ALTER COLUMN total_amount TYPE DECIMAL(12, 2);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_total_amount_check;
ALTER TABLE orders ADD CONSTRAINT orders_total_amount_check CHECK (total_amount >= 0);

ALTER TABLE order_items ALTER COLUMN unit_price TYPE DECIMAL(12, 2);
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_unit_price_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0);
