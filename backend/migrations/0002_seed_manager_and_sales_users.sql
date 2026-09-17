-- Seed default Manager (password: manager123)
INSERT INTO users (email, password_hash, role)
VALUES (
    'manager@kwatapos.com',
    '$argon2id$v=19$m=19456,t=2,p=1$dGVzdHNhbHQxMjM0NTY3OA$oVRkXZ7CXzZrVdAFQPwd0+uIaXyDUOjLOD5JjUByD0Y',
    'manager'
)
ON CONFLICT (email) DO NOTHING;

-- Seed default Sales (password: sales123)
INSERT INTO users (email, password_hash, role)
VALUES (
    'sales@kwatapos.com',
    '$argon2id$v=19$m=19456,t=2,p=1$dGVzdHNhbHQxMjM0NTY3OA$aPmKt/78762aiyrwuv3ddBvWBjaYD9ve30UpbXEBV48',
    'sales'
)
ON CONFLICT (email) DO NOTHING;
