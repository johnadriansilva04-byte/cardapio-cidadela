-- ============================================
-- ATUALIZAÇÃO DE TABELAS EXISTENTES PARA MULTI-TENANCY
-- ============================================

-- Adicionar colunas em admin_trials se não existirem
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS store_id VARCHAR(255) UNIQUE;
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS store_slogan TEXT;
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS store_marquee TEXT;
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS admin_phone VARCHAR(20);
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '2 minutes';
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS config_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Adicionar índices para admin
CREATE INDEX IF NOT EXISTS idx_admin_trials_email ON admin_trials(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_trials_phone ON admin_trials(admin_phone);
CREATE INDEX IF NOT EXISTS idx_admin_trials_store_id ON admin_trials(store_id);

-- Tornar access_code opcional já que agora usamos e-mail
ALTER TABLE admin_trials ALTER COLUMN access_code DROP NOT NULL;

-- ============================================
-- TABELAS DE SOBERANIA
-- ============================================

-- Tabela para armazenar pontos de soberania dos clientes
CREATE TABLE IF NOT EXISTS soberania_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  points INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas store_id em soberania_points se não existir
ALTER TABLE soberania_points ADD COLUMN IF NOT EXISTS store_id VARCHAR(255);
ALTER TABLE soberania_points ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

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

-- Adicionar colunas store_id e customer_email em soberania_transactions se não existirem
ALTER TABLE soberania_transactions ADD COLUMN IF NOT EXISTS store_id VARCHAR(255);
ALTER TABLE soberania_transactions ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_soberania_points_phone ON soberania_points(customer_phone);
CREATE INDEX IF NOT EXISTS idx_soberania_points_store_id ON soberania_points(store_id);
CREATE INDEX IF NOT EXISTS idx_soberania_points_customer_email ON soberania_points(customer_email);
CREATE INDEX IF NOT EXISTS idx_soberania_transactions_phone ON soberania_transactions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_soberania_transactions_store_id ON soberania_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_soberania_transactions_customer_email ON soberania_transactions(customer_email);
CREATE INDEX IF NOT EXISTS idx_soberania_transactions_timestamp ON soberania_transactions(timestamp);

-- ============================================
-- TABELAS DE PEDIDOS
-- ============================================

-- Adicionar colunas em orders se não existirem
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Adicionar índices para orders
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);

-- Tabela de itens dos pedidos
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ============================================
-- TABELAS DE CIDADELA
-- ============================================

-- Tabela de códigos de acesso à Cidadela
CREATE TABLE IF NOT EXISTS cidadela_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(255) UNIQUE NOT NULL,
  store_id VARCHAR(255),
  customer_phone VARCHAR(20),
  access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('15_min', '15_dias')),
  order_total DECIMAL(10,2),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas customer_email em cidadela_codes se não existir
ALTER TABLE cidadela_codes ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE cidadela_codes ADD COLUMN IF NOT EXISTS order_id UUID;

-- Adicionar índices para cidadela_codes
CREATE INDEX IF NOT EXISTS idx_cidadela_codes_store_id ON cidadela_codes(store_id);
CREATE INDEX IF NOT EXISTS idx_cidadela_codes_customer_email ON cidadela_codes(customer_email);
CREATE INDEX IF NOT EXISTS idx_cidadela_codes_customer_phone ON cidadela_codes(customer_phone);
CREATE INDEX IF NOT EXISTS idx_cidadela_codes_order_id ON cidadela_codes(order_id);

-- ============================================
-- TABELAS DE LIBERAÇÃO PREMIUM
-- ============================================

-- Tabela de códigos de liberação premium
CREATE TABLE IF NOT EXISTS liberation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(255) UNIQUE NOT NULL,
  store_id VARCHAR(255) NOT NULL,
  plan_type VARCHAR(50) NOT NULL,
  duration_days INTEGER NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liberation_codes_code ON liberation_codes(code);
CREATE INDEX IF NOT EXISTS idx_liberation_codes_store_id ON liberation_codes(store_id);

-- ============================================
-- TABELAS DE JOGOS
-- ============================================

-- Tabela de sessões de jogos
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('battle', 'iq_test', 'chess', 'dama', 'trilha')),
  player1_id VARCHAR(255) NOT NULL,
  player1_name VARCHAR(255) NOT NULL,
  player1_data JSONB,
  player2_id VARCHAR(255),
  player2_name VARCHAR(255),
  player2_data JSONB,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  current_turn INTEGER DEFAULT 1,
  winner VARCHAR(255),
  game_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Adicionar colunas store_id e player_email em game_sessions se não existirem
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS store_id VARCHAR(255);
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS player1_email VARCHAR(255);
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS player2_email VARCHAR(255);

-- Adicionar índices para game_sessions
CREATE INDEX IF NOT EXISTS idx_game_sessions_store_id ON game_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_player1 ON game_sessions(player1_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_player2 ON game_sessions(player2_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);

-- Tabela de movimentos dos jogos
CREATE TABLE IF NOT EXISTS game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  player_id VARCHAR(255) NOT NULL,
  player_number INTEGER NOT NULL CHECK (player_number IN (1, 2)),
  move_type VARCHAR(50) NOT NULL,
  move_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  round_number INTEGER DEFAULT 1
);

-- Adicionar coluna player_email em game_moves se não existir
ALTER TABLE game_moves ADD COLUMN IF NOT EXISTS player_email VARCHAR(255);

-- Adicionar índices para game_moves
CREATE INDEX IF NOT EXISTS idx_game_moves_session_id ON game_moves(session_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_player_id ON game_moves(player_id);

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger se existir antes de criar
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_sessions_updated_at ON game_sessions;
CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
