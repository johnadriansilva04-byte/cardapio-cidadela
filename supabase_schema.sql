-- Tabela para armazenar pontos de soberania dos clientes
CREATE TABLE IF NOT EXISTS soberania_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone VARCHAR(20) UNIQUE NOT NULL,
  customer_email VARCHAR(255),
  points INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para registrar transações de soberania
CREATE TABLE IF NOT EXISTS soberania_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'lost', 'spent', 'rewarded')),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('game', 'order', 'ad', 'admin')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_soberania_points_phone ON soberania_points(customer_phone);
CREATE INDEX IF NOT EXISTS idx_soberania_transactions_phone ON soberania_transactions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_soberania_transactions_timestamp ON soberania_transactions(timestamp);

-- Tabela de trials de admin já existe, vamos garantir que tenha admin_email
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);

-- Adicionar índice para admin_email se não existir
CREATE INDEX IF NOT EXISTS idx_admin_trials_email ON admin_trials(admin_email);
