-- Granular RBAC: permissions, role grants, and per-user overrides.
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_name VARCHAR(50) NOT NULL REFERENCES roles(name) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_name, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    is_granted BOOLEAN NOT NULL,
    PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id
    ON role_permissions (permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id
    ON user_permissions (permission_id);

INSERT INTO permissions (name, description)
VALUES
    ('users.manage', 'Invite, update, and remove staff users'),
    ('roles.manage', 'Create roles and assign their permissions'),
    ('catalog.manage', 'Full catalog create, update, and delete'),
    ('catalog.read', 'View products and stock'),
    ('catalog.update', 'Update product prices, names, and stock'),
    ('customers.manage', 'Manage the customer roster and credit PINs'),
    ('pos.sale', 'Create and settle point-of-sale orders'),
    ('reports.view', 'View daily reconciliation reports')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_name, permission_id)
SELECT 'admin', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_name, permission_id)
SELECT 'manager', id FROM permissions
WHERE name IN (
    'catalog.manage',
    'catalog.read',
    'catalog.update',
    'customers.manage',
    'pos.sale',
    'reports.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_name, permission_id)
SELECT 'sales', id FROM permissions
WHERE name IN ('pos.sale', 'catalog.read')
ON CONFLICT DO NOTHING;
