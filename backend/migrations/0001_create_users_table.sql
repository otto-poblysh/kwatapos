-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    name VARCHAR(50) PRIMARY KEY
);

-- Insert default roles
INSERT INTO roles (name)
VALUES ('admin'), ('manager'), ('sales')
ON CONFLICT (name) DO NOTHING;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL REFERENCES roles(name),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default Super Admin (password: admin123)
INSERT INTO users (email, password_hash, role)
VALUES (
    'admin@kwatapos.com',
    '$argon2id$v=19$m=19456,t=2,p=1$dGVzdHNhbHQxMjM0NTY3OA$/HsJXz9mg/LrShdTcvyCkWT4k8FnnMa5bxtf0bX9sSE',
    'admin'
)
ON CONFLICT (email) DO NOTHING;
