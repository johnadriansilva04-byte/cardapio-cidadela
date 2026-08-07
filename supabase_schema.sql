-- ============================================
-- TABELAS DE ADMINISTRAÇÃO (DONOS DO CARDÁPIO)
-- ============================================

-- Tabela de administradores/donos de cardápio
CREATE TABLE IF NOT EXISTS admin_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) UNIQUE NOT NULL,
  store_name VARCHAR(255) NOT NULL,
  store_slogan TEXT,
  store_marquee TEXT,
  pix_key VARCHAR(255),
  whatsapp VARCHAR(20),
  admin_phone VARCHAR(20) NOT NULL,
  admin_email VARCHAR(255) UNIQUE NOT NULL,
  access_code VARCHAR(255),
  trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trial_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '2 days',
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMP WITH TIME ZONE,
  config_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para admin
CREATE INDEX IF NOT EXISTS idx_admin_trials_email ON admin_trials(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_trials_phone ON admin_trials(admin_phone);
CREATE INDEX IF NOT EXISTS idx_admin_trials_store_id ON admin_trials(store_id);

-- Tabela de códigos de liberação premium para admins
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
-- TABELAS DE CLIENTES (VINCULADOS A CADA ADMIN)
-- ============================================

-- Tabela de clientes (cada cliente pertence a um admin/store)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL REFERENCES admin_trials(store_id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, email),
  UNIQUE(store_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ============================================
-- TABELAS DE PEDIDOS
-- ============================================

-- Tabela principal de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL REFERENCES admin_trials(store_id),
  customer_id UUID REFERENCES customers(id),
  comanda VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(255),
  delivery_address TEXT,
  delivery_type VARCHAR(20) NOT NULL CHECK (delivery_type IN ('entrega', 'retirada')),
  observations TEXT,
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('pix', 'dinheiro', 'cartao')),
  payment_status VARCHAR(30) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'awaiting_confirmation', 'paid', 'rejected')),
  payment_proof_url TEXT,
  payment_confirmed_at TIMESTAMP WITH TIME ZONE,
  payment_confirmed_by VARCHAR(255),
  payment_rejected_reason TEXT,
  change_for DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'delivering', 'completed', 'cancelled')),
  cidadela_code VARCHAR(255),
  cidadela_access_type VARCHAR(20),
  webhook_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_comanda ON orders(comanda);

-- Tabela de itens dos pedidos
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ============================================
-- TABELAS DE SOBERANIA (POR STORE_ID)
-- ============================================

-- Tabela para armazenar pontos de soberania dos clientes
CREATE TABLE IF NOT EXISTS soberania_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL REFERENCES admin_trials(store_id),
  customer_id UUID REFERENCES customers(id),
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  points INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, customer_email)
);

-- Tabela para registrar transações de soberania
CREATE TABLE IF NOT EXISTS soberania_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL REFERENCES admin_trials(store_id),
  customer_id UUID REFERENCES customers(id),
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'lost', 'spent', 'rewarded')),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('game', 'order', 'ad', 'admin')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_soberania_points_store_id ON soberania_points(store_id);
CREATE INDEX IF NOT EXISTS idx_soberania_points_customer_email ON soberania_points(customer_email);
CREATE INDEX IF NOT EXISTS idx_soberania_points_customer_phone ON soberania_points(customer_phone);
CREATE INDEX IF NOT EXISTS idx_soberania_transactions_store_id ON soberania_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_soberania_transactions_customer_email ON soberania_transactions(customer_email);
CREATE INDEX IF NOT EXISTS idx_soberania_transactions_timestamp ON soberania_transactions(timestamp);

-- ============================================
-- TABELAS DE CIDADELA (POR STORE_ID)
-- ============================================

-- Tabela de códigos de acesso à Cidadela (enviados para e-mail do cliente)
CREATE TABLE IF NOT EXISTS cidadela_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL REFERENCES admin_trials(store_id),
  customer_id UUID REFERENCES customers(id),
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  code VARCHAR(255) UNIQUE NOT NULL,
  access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('15_min', '15_dias')),
  order_total DECIMAL(10,2),
  order_id UUID REFERENCES orders(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cidadela_codes_store_id ON cidadela_codes(store_id);
CREATE INDEX IF NOT EXISTS idx_cidadela_codes_customer_email ON cidadela_codes(customer_email);
CREATE INDEX IF NOT EXISTS idx_cidadela_codes_customer_phone ON cidadela_codes(customer_phone);
CREATE INDEX IF NOT EXISTS idx_cidadela_codes_code ON cidadela_codes(code);
CREATE INDEX IF NOT EXISTS idx_cidadela_codes_order_id ON cidadela_codes(order_id);

-- ============================================
-- TABELAS DE JOGOS (POR STORE_ID)
-- ============================================

-- Tabela de sessões de jogos
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL REFERENCES admin_trials(store_id),
  game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('battle', 'iq_test', 'chess', 'dama', 'trilha')),
  player1_id VARCHAR(255) NOT NULL,
  player1_name VARCHAR(255) NOT NULL,
  player1_email VARCHAR(255),
  player1_data JSONB,
  player2_id VARCHAR(255),
  player2_name VARCHAR(255),
  player2_email VARCHAR(255),
  player2_data JSONB,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  current_turn INTEGER DEFAULT 1,
  winner VARCHAR(255),
  game_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_store_id ON game_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_player1 ON game_sessions(player1_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_player2 ON game_sessions(player2_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_type ON game_sessions(game_type);

-- Tabela de movimentos dos jogos
CREATE TABLE IF NOT EXISTS game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id VARCHAR(255) NOT NULL,
  player_email VARCHAR(255),
  player_number INTEGER NOT NULL CHECK (player_number IN (1, 2)),
  move_type VARCHAR(50) NOT NULL,
  move_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  round_number INTEGER DEFAULT 1
);

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

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
