-- ============================================
-- SISTEMA COMPLETO CIDADELA PRACINHA - SUPABASE
-- Cardápio Digital, Pedidos, Autenticação, Chat, Jogos
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- ============================================
-- LIMPEZA DE TABELAS EXISTENTES
-- ============================================
DROP TABLE IF EXISTS game_moves CASCADE;
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS liberation_codes CASCADE;
DROP TABLE IF EXISTS admin_trials CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;

-- ============================================
-- CARDÁPIO E PEDIDOS
-- ============================================

-- Tabela de produtos do cardápio
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  preparation_time INTEGER, -- minutos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- AUTENTICAÇÃO E ADMINISTRAÇÃO
-- ============================================

-- Tabela de trials de administradores (MOVIDA PARA CIMA PARA RESOLVER FOREIGN KEY)
CREATE TABLE admin_trials (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  store_name TEXT NOT NULL,
  admin_phone TEXT NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  trial_started_at TIMESTAMPTZ NOT NULL,
  trial_expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de pedidos
CREATE TABLE orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  store_id TEXT NOT NULL REFERENCES admin_trials(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('entrega', 'retirada')),
  observations TEXT,
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('pix', 'dinheiro', 'cartao')),
  change_for DECIMAL(10,2),
  distance_km DECIMAL(10,2) DEFAULT 0,
  comanda TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  cidadela_code TEXT,
  cidadela_access_type TEXT CHECK (cidadela_access_type IN ('15_min', '15_dias')),
  webhook_sent BOOLEAN DEFAULT false,
  webhook_error TEXT,
  -- Campos de pagamento PIX
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'awaiting_confirmation', 'paid', 'rejected')),
  payment_proof_url TEXT,
  payment_confirmed_at TIMESTAMPTZ,
  payment_confirmed_by TEXT,
  payment_rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de itens do pedido
CREATE TABLE order_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES menu_items(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de códigos de liberação
CREATE TABLE liberation_codes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  store_id TEXT REFERENCES admin_trials(id),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('mensal', 'semestral', 'anual')),
  duration_days INTEGER NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

-- Tabela de configurações da loja (cardápio)
CREATE TABLE store_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  store_id TEXT NOT NULL REFERENCES admin_trials(id) ON DELETE CASCADE,
  
  -- Dados da loja
  store_name TEXT NOT NULL,
  slogan TEXT,
  marquee TEXT,
  cover_photo TEXT,
  
  -- Configurações de pagamento
  pix_key TEXT NOT NULL,
  
  -- Cardápio (categorias e itens em JSONB)
  categories JSONB NOT NULL DEFAULT '[]',
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Garantir uma config por loja
  UNIQUE(store_id)
);

-- Tabela de códigos da Cidadela
CREATE TABLE cidadela_codes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  store_id TEXT NOT NULL REFERENCES admin_trials(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id),
  
  -- Tipo de acesso
  access_type TEXT NOT NULL CHECK (access_type IN ('15_min', '15_dias')),
  
  -- Valores
  order_total DECIMAL(10,2) NOT NULL,
  
  -- Controle de validade
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  
  -- Metadados
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

-- ============================================
-- CHAT PERSISTENTE
-- ============================================

-- Tabela de mensagens do chat
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  message TEXT NOT NULL,
  room_id TEXT NOT NULL DEFAULT 'general',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SISTEMA DE JOGOS ONLINE
-- ============================================

-- Tabela genérica de sessões de jogo
CREATE TABLE game_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  game_type TEXT NOT NULL CHECK (game_type IN ('battle', 'iq_test', 'chess', 'dama', 'trilha')),
  
  -- Dados dos jogadores
  player1_id TEXT NOT NULL,
  player1_name TEXT NOT NULL,
  player1_data JSONB NOT NULL DEFAULT '{}',
  player2_id TEXT,
  player2_name TEXT,
  player2_data JSONB DEFAULT '{}',
  
  -- Status do jogo
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  current_turn INTEGER DEFAULT 1,
  winner TEXT,
  
  -- Estado genérico do jogo (específico por tipo)
  game_state JSONB NOT NULL DEFAULT '{}',
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Tabela genérica de movimentos/jogadas
CREATE TABLE game_moves (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_number INTEGER NOT NULL CHECK (player_number IN (1, 2)),
  
  -- Dados do movimento (específico por tipo de jogo)
  move_type TEXT NOT NULL,
  move_data JSONB NOT NULL DEFAULT '{}',
  
  -- Metadados
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  round_number INTEGER DEFAULT 1
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- menu_items
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_available ON menu_items(available);

-- orders
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_cidadela_code ON orders(cidadela_code);

-- order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- admin_trials
CREATE INDEX idx_admin_trials_access_code ON admin_trials(access_code);
CREATE INDEX idx_admin_trials_admin_phone ON admin_trials(admin_phone);
CREATE INDEX idx_admin_trials_is_active ON admin_trials(is_active);

-- liberation_codes
CREATE INDEX idx_liberation_codes_code ON liberation_codes(code);
CREATE INDEX idx_liberation_codes_store_id ON liberation_codes(store_id);
CREATE INDEX idx_liberation_codes_used ON liberation_codes(used);

-- store_configs
CREATE INDEX idx_store_configs_store_id ON store_configs(store_id);

-- cidadela_codes
CREATE INDEX idx_cidadela_codes_code ON cidadela_codes(code);
CREATE INDEX idx_cidadela_codes_store_id ON cidadela_codes(store_id);
CREATE INDEX idx_cidadela_codes_customer_phone ON cidadela_codes(customer_phone);
CREATE INDEX idx_cidadela_codes_expires_at ON cidadela_codes(expires_at);
CREATE INDEX idx_cidadela_codes_is_active ON cidadela_codes(is_active);

-- chat_messages
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp DESC);

-- game_sessions
CREATE INDEX idx_game_sessions_type ON game_sessions(game_type);
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_sessions_player1 ON game_sessions(player1_id);
CREATE INDEX idx_game_sessions_player2 ON game_sessions(player2_id);
CREATE INDEX idx_game_sessions_created_at ON game_sessions(created_at DESC);
CREATE INDEX idx_game_sessions_active ON game_sessions(status, game_type) WHERE status = 'waiting';

-- game_moves
CREATE INDEX idx_game_moves_session ON game_moves(session_id);
CREATE INDEX idx_game_moves_player ON game_moves(player_id);
CREATE INDEX idx_game_moves_timestamp ON game_moves(timestamp DESC);
CREATE INDEX idx_game_moves_round ON game_moves(session_id, round_number);

-- ============================================
-- TRIGGERS PARA updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas com updated_at
DROP TRIGGER IF EXISTS update_menu_items_updated_at ON menu_items;
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_trials_updated_at ON admin_trials;
CREATE TRIGGER update_admin_trials_updated_at BEFORE UPDATE ON admin_trials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_sessions_updated_at ON game_sessions;
CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNÇÕES AUXILIARES PARA TRILHA
-- ============================================

-- Verifica se posição forma moinho (três em linha)
CREATE OR REPLACE FUNCTION check_mill(board JSONB, pos INTEGER, player TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  mill_lines INTEGER[][] := ARRAY[
    ARRAY[0,1,2], ARRAY[3,4,5], ARRAY[6,7,8],
    ARRAY[9,10,11], ARRAY[12,13,14],
    ARRAY[15,16,17], ARRAY[18,19,20], ARRAY[21,22,23],
    ARRAY[0,9,21], ARRAY[3,10,18], ARRAY[6,15,23],
    ARRAY[1,4,7], ARRAY[16,19,22],
    ARRAY[8,12,17], ARRAY[5,13,20], ARRAY[2,14,23]
  ];
  line INTEGER[];
BEGIN
  FOREACH line IN ARRAY mill_lines LOOP
    IF pos = ANY(line) THEN
      IF board->(line[1]::text)::text = player 
         AND board->(line[2]::text)::text = player THEN
        RETURN TRUE;
      END IF;
    END IF;
  END LOOP;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Verifica se jogador pode mover (não está bloqueado)
CREATE OR REPLACE FUNCTION can_player_move(board JSONB, player TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  adjacent_positions INTEGER[][] := ARRAY[
    ARRAY[0,1,9], ARRAY[1,0,2,4], ARRAY[2,1,14],
    ARRAY[3,4,10], ARRAY[4,1,3,5,7], ARRAY[5,4,13],
    ARRAY[6,7,15], ARRAY[7,4,6,8], ARRAY[8,7,12],
    ARRAY[9,0,10,21], ARRAY[10,3,9,11,18], ARRAY[11,4,10,14],
    ARRAY[12,8,13,17], ARRAY[13,5,12,14,20], ARRAY[14,2,11,13,23],
    ARRAY[15,6,16], ARRAY[16,15,17,19], ARRAY[17,12,16],
    ARRAY[18,9,19], ARRAY[19,16,18,20,22], ARRAY[20,13,19],
    ARRAY[21,15,22], ARRAY[22,19,21,23], ARRAY[23,14,22]
  ];
  pos INTEGER;
  adj INTEGER[];
  adj_pos INTEGER;
BEGIN
  IF (SELECT COUNT(*) FROM jsonb_each_text(board) WHERE value = player) = 3 THEN
    RETURN (SELECT COUNT(*) FROM jsonb_each_text(board) WHERE value IS NULL) > 0;
  END IF;
  
  FOR pos IN SELECT key::integer FROM jsonb_each_text(board) WHERE value = player LOOP
    adj := adjacent_positions[pos + 1];
    FOREACH adj_pos IN ARRAY adj LOOP
      IF board->(adj_pos::text)::text IS NULL THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================

-- menu_items
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura pública em menu_items" ON menu_items;
CREATE POLICY "Permitir leitura pública em menu_items" ON menu_items FOR SELECT USING (true);

-- orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção pública em orders" ON orders;
DROP POLICY IF EXISTS "Permitir leitura pública em orders" ON orders;
DROP POLICY IF EXISTS "Permitir atualização pública em orders" ON orders;
CREATE POLICY "Permitir inserção pública em orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura pública em orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Permitir atualização pública em orders" ON orders FOR UPDATE WITH CHECK (true);

-- order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção pública em order_items" ON order_items;
DROP POLICY IF EXISTS "Permitir leitura pública em order_items" ON order_items;
CREATE POLICY "Permitir inserção pública em order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura pública em order_items" ON order_items FOR SELECT USING (true);

-- admin_trials
ALTER TABLE admin_trials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção pública em admin_trials" ON admin_trials;
DROP POLICY IF EXISTS "Permitir leitura pública em admin_trials" ON admin_trials;
DROP POLICY IF EXISTS "Permitir atualização pública em admin_trials" ON admin_trials;
CREATE POLICY "Permitir inserção pública em admin_trials" ON admin_trials FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura pública em admin_trials" ON admin_trials FOR SELECT USING (true);
CREATE POLICY "Permitir atualização pública em admin_trials" ON admin_trials FOR UPDATE WITH CHECK (true);

-- liberation_codes
ALTER TABLE liberation_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção pública em liberation_codes" ON liberation_codes;
DROP POLICY IF EXISTS "Permitir leitura pública em liberation_codes" ON liberation_codes;
DROP POLICY IF EXISTS "Permitir atualização pública em liberation_codes" ON liberation_codes;
CREATE POLICY "Permitir inserção pública em liberation_codes" ON liberation_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura pública em liberation_codes" ON liberation_codes FOR SELECT USING (true);
CREATE POLICY "Permitir atualização pública em liberation_codes" ON liberation_codes FOR UPDATE WITH CHECK (true);

-- chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção pública em chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Permitir leitura pública em chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Permitir atualização pública em chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Permitir deleção pública em chat_messages" ON chat_messages;
CREATE POLICY "Permitir inserção pública em chat_messages" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura pública em chat_messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Permitir atualização pública em chat_messages" ON chat_messages FOR UPDATE WITH CHECK (true);
CREATE POLICY "Permitir deleção pública em chat_messages" ON chat_messages FOR DELETE USING (true);

-- game_sessions
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção pública em game_sessions" ON game_sessions;
DROP POLICY IF EXISTS "Permitir leitura pública em game_sessions" ON game_sessions;
DROP POLICY IF EXISTS "Permitir atualização pública em game_sessions" ON game_sessions;
DROP POLICY IF EXISTS "Permitir deleção pública em game_sessions" ON game_sessions;
CREATE POLICY "Permitir inserção pública em game_sessions" ON game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura pública em game_sessions" ON game_sessions FOR SELECT USING (true);
CREATE POLICY "Permitir atualização pública em game_sessions" ON game_sessions FOR UPDATE WITH CHECK (true);
CREATE POLICY "Permitir deleção pública em game_sessions" ON game_sessions FOR DELETE USING (true);

-- game_moves
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção pública em game_moves" ON game_moves;
DROP POLICY IF EXISTS "Permitir leitura pública em game_moves" ON game_moves;
DROP POLICY IF EXISTS "Permitir atualização pública em game_moves" ON game_moves;
DROP POLICY IF EXISTS "Permitir deleção pública em game_moves" ON game_moves;
CREATE POLICY "Permitir inserção pública em game_moves" ON game_moves FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura pública em game_moves" ON game_moves FOR SELECT USING (true);
CREATE POLICY "Permitir atualização pública em game_moves" ON game_moves FOR UPDATE WITH CHECK (true);
CREATE POLICY "Permitir deleção pública em game_moves" ON game_moves FOR DELETE USING (true);

-- cidadela_codes
ALTER TABLE cidadela_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção pública em cidadela_codes" ON cidadela_codes;
DROP POLICY IF EXISTS "Permitir leitura pública em cidadela_codes" ON cidadela_codes;
DROP POLICY IF EXISTS "Permitir atualização pública em cidadela_codes" ON cidadela_codes;
CREATE POLICY "Permitir inserção pública em cidadela_codes" ON cidadela_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura pública em cidadela_codes" ON cidadela_codes FOR SELECT USING (true);
CREATE POLICY "Permitir atualização pública em cidadela_codes" ON cidadela_codes FOR UPDATE WITH CHECK (true);
