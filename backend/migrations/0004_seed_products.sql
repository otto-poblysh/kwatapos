-- Seed initial products
INSERT INTO products (id, name, price, category)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Castel Beer', 650.0, 'beer'),
    ('22222222-2222-2222-2222-222222222222', 'Guinness', 1000.0, 'beer'),
    ('33333333-3333-3333-3333-333333333333', 'Heineken', 1000.0, 'beer'),
    ('44444444-4444-4444-4444-444444444444', 'Roasted Fish (Medium)', 2500.0, 'fish'),
    ('55555555-5555-5555-5555-555555555555', 'Roasted Fish (Large)', 4000.0, 'fish')
ON CONFLICT (id) DO NOTHING;

-- Seed corresponding initial inventory
INSERT INTO inventory (product_id, quantity)
VALUES
    ('11111111-1111-1111-1111-111111111111', 50),
    ('22222222-2222-2222-2222-222222222222', 40),
    ('33333333-3333-3333-3333-333333333333', 30),
    ('44444444-4444-4444-4444-444444444444', 20),
    ('55555555-5555-5555-5555-555555555555', 15)
ON CONFLICT (product_id) DO NOTHING;
