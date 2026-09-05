-- ============================================================
-- MENU DIGITAL PLATFORM — Complete Database Schema
-- Run this in Supabase SQL Editor to set up all tables
-- ============================================================

-- ENUMS
DO $$ BEGIN
  CREATE TYPE restaurant_status AS ENUM ('draft', 'published', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('received', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- RESTAURANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  address TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#06b6d4',
  secondary_color TEXT DEFAULT '#8b5cf6',
  status restaurant_status DEFAULT 'draft',
  pix_key TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT DEFAULT '',
  available BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- ============================================================
-- ADD-ON GROUPS (optional)
-- ============================================================
CREATE TABLE IF NOT EXISTS addon_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_select INT DEFAULT 0,
  max_select INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  available BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  comanda TEXT NOT NULL,
  idempotency_key TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  customer_email TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  delivery_type TEXT DEFAULT 'retirada',
  observations TEXT DEFAULT '',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'pix',
  payment_status TEXT DEFAULT 'pending',
  status order_status DEFAULT 'received',
  cidadela_unlocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Migração segura: garante colunas exigidas pelo app em bancos criados por versões antigas do schema
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comanda TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'retirada';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS observations TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pix';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cidadela_unlocked BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS pix_key TEXT DEFAULT '';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#8b5cf6';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_comanda ON orders(comanda);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================================
-- ORDER STATUS HISTORY (for tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
-- View pública de tracking do pedido (SEM dados pessoais — só status/valores/itens)
-- Qualquer um que saiba o order id pode acompanha-lo; nada de nome/telefone/endereço vaza.
CREATE OR REPLACE VIEW order_tracking AS
SELECT
  o.id,
  o.restaurant_id,
  o.comanda,
  o.status,
  o.total,
  o.observations,
  o.created_at,
  COALESCE(
    (SELECT json_agg(row_to_json(oi)) FROM order_items oi WHERE oi.order_id = o.id),
    '[]'::json
  ) AS order_items
FROM orders o;

-- ============================================================
-- CIDADELA UNLOCKS (auto-unlock after order confirmation)
-- ============================================================
CREATE TABLE IF NOT EXISTS cidadela_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_cidadela_unlocks_restaurant ON cidadela_unlocks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_cidadela_unlocks_phone ON cidadela_unlocks(customer_phone);

-- ============================================================
-- AUTO-SLUG GENERATION
-- ============================================================
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(
            name,
            'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ',
            'aaaaaaeeeeiiiiooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC'
          ),
          '[^a-z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_restaurant_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := generate_slug(NEW.name);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM restaurants WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_restaurant_slug ON restaurants;
CREATE TRIGGER trg_set_restaurant_slug
  BEFORE INSERT OR UPDATE OF name, slug ON restaurants
  FOR EACH ROW EXECUTE FUNCTION set_restaurant_slug();

-- ============================================================
-- HELPFUL VIEWS
-- ============================================================

-- Admin dashboard: restaurant summary
CREATE OR REPLACE VIEW admin_restaurant_summary AS
SELECT
  r.id,
  r.name,
  r.slug,
  r.status,
  r.owner_id,
  (SELECT COUNT(*) FROM categories c WHERE c.restaurant_id = r.id) AS category_count,
  (SELECT COUNT(*) FROM products p WHERE p.restaurant_id = r.id) AS product_count,
  (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id) AS total_orders,
  (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id AND o.status IN ('received', 'preparing')) AS active_orders,
  r.created_at,
  r.updated_at
FROM restaurants r;

-- Admin dashboard: today's orders count per restaurant
CREATE OR REPLACE VIEW admin_today_orders AS
SELECT
  restaurant_id,
  COUNT(*) AS order_count,
  COALESCE(SUM(total), 0) AS total_revenue
FROM orders
WHERE created_at >= CURRENT_DATE
GROUP BY restaurant_id;

-- ============================================================
CREATE TABLE IF NOT EXISTS admin_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) UNIQUE,
  store_name VARCHAR(255),
  store_slogan TEXT,
  store_marquee TEXT,
  pix_key VARCHAR(255),
  whatsapp VARCHAR(20),
  admin_phone VARCHAR(20),
  admin_email VARCHAR(255) UNIQUE,
  access_code TEXT,
  trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trial_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '2 minutes',
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMP WITH TIME ZONE,
  config_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_trials_email ON admin_trials(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_trials_phone ON admin_trials(admin_phone);
CREATE INDEX IF NOT EXISTS idx_admin_trials_store_id ON admin_trials(store_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'pracinha')),
  text TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'iq_test',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session ON chat_messages(user_id, session_type);

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('battle', 'iq_test', 'chess', 'dama', 'trilha')),
  player1_id VARCHAR(255) NOT NULL,
  player1_name VARCHAR(255) NOT NULL,
  player1_data JSONB,
  player1_email VARCHAR(255),
  store_id VARCHAR(255),
  player2_id VARCHAR(255),
  player2_name VARCHAR(255),
  player2_data JSONB,
  player2_email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  current_turn INTEGER DEFAULT 1,
  winner VARCHAR(255),
  game_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON game_sessions(created_at);

CREATE TABLE IF NOT EXISTS game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id VARCHAR(255) NOT NULL,
  player_number INTEGER NOT NULL CHECK (player_number IN (1, 2)),
  move_type VARCHAR(50) NOT NULL,
  move_data JSONB,
  player_email VARCHAR(255),
  round_number INTEGER DEFAULT 1,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_moves_session ON game_moves(session_id);

-- PROFILES (auth users + roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('admin', 'owner', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Se a tabela já existe mas faltam colunas, adiciona
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Só cria as policies se ainda não existirem
DO $$ BEGIN
  CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow profile creation"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY — Tabelas principais
-- ============================================================

-- RESTAURANTS: limpa políticas antigas e cria novas
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Dropa qualquer política antiga pra evitar conflito
DO $$ DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'restaurants' LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON restaurants';
  END LOOP;
END $$;

CREATE POLICY "owner_select"
  ON restaurants FOR SELECT
  USING (owner_id = auth.uid()::text);

CREATE POLICY "owner_insert"
  ON restaurants FOR INSERT
  WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "owner_update"
  ON restaurants FOR UPDATE
  USING (owner_id = auth.uid()::text);

CREATE POLICY "owner_delete"
  ON restaurants FOR DELETE
  USING (owner_id = auth.uid()::text);

-- Política pública: qualquer pessoa vê restaurantes publicados
CREATE POLICY "public_read_published"
  ON restaurants FOR SELECT
  USING (status = 'published');

-- Funcao auxiliar: limpa policies antigas de uma tabela
CREATE OR REPLACE FUNCTION drop_policies_if_exist(target_table TEXT)
RETURNS VOID AS $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN EXECUTE format(
    'SELECT policyname FROM pg_policies WHERE tablename = %L',
    target_table
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol.policyname, target_table);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Macro pra checar se dono do restaurante
-- (restaurant_id → owner_id → auth.uid())
CREATE OR REPLACE FUNCTION is_restaurant_owner(rid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = rid AND owner_id = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CATEGORIES
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
SELECT drop_policies_if_exist('categories');
CREATE POLICY "owner_categories" ON categories FOR ALL
  USING (is_restaurant_owner(restaurant_id));
-- Público lê categorias de restaurantes publicados
CREATE POLICY "public_read_categories" ON categories FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE status = 'published'));

-- PRODUCTS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
SELECT drop_policies_if_exist('products');
CREATE POLICY "owner_products" ON products FOR ALL
  USING (is_restaurant_owner(restaurant_id));
-- Público lê produtos de restaurantes publicados
CREATE POLICY "public_read_products" ON products FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE status = 'published'));

-- ORDERS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
SELECT drop_policies_if_exist('orders');
CREATE POLICY "owner_orders" ON orders FOR ALL
  USING (is_restaurant_owner(restaurant_id));
CREATE POLICY "public_insert_orders" ON orders FOR INSERT TO anon,authenticated
  WITH CHECK (true);

-- ORDER ITEMS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
SELECT drop_policies_if_exist('order_items');
CREATE POLICY "owner_order_items" ON order_items FOR ALL
  USING (order_id IN (
    SELECT o.id FROM orders o WHERE is_restaurant_owner(o.restaurant_id)
  ));
CREATE POLICY "public_insert_order_items" ON order_items FOR INSERT TO anon,authenticated
  WITH CHECK (true);
-- ORDER STATUS HISTORY
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
SELECT drop_policies_if_exist('order_status_history');
CREATE POLICY "owner_order_status_history" ON order_status_history FOR ALL
  USING (order_id IN (
    SELECT o.id FROM orders o WHERE is_restaurant_owner(o.restaurant_id)
  ));
CREATE POLICY "public_insert_order_status_history" ON order_status_history FOR INSERT TO anon,authenticated
  WITH CHECK (true);

-- ADDON GROUPS
ALTER TABLE addon_groups ENABLE ROW LEVEL SECURITY;
SELECT drop_policies_if_exist('addon_groups');
CREATE POLICY "owner_addon_groups" ON addon_groups FOR ALL
  USING (is_restaurant_owner(restaurant_id));

-- ADDONS
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
SELECT drop_policies_if_exist('addons');
CREATE POLICY "owner_addons" ON addons FOR ALL
  USING (is_restaurant_owner(restaurant_id));

-- CIDADELA UNLOCKS
ALTER TABLE cidadela_unlocks ENABLE ROW LEVEL SECURITY;
SELECT drop_policies_if_exist('cidadela_unlocks');
CREATE POLICY "owner_cidadela" ON cidadela_unlocks FOR ALL
  USING (is_restaurant_owner(restaurant_id));
CREATE POLICY "public_insert_cidadela_unlocks" ON cidadela_unlocks FOR INSERT TO anon,authenticated
  WITH CHECK (true);
DO $$ BEGIN
  CREATE POLICY "public_all_admin_trials" ON admin_trials FOR ALL TO anon,authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public_all_chat_messages" ON chat_messages FOR ALL TO anon,authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public_all_game_sessions" ON game_sessions FOR ALL TO anon,authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public_all_game_moves" ON game_moves FOR ALL TO anon,authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- CARDÁPIO PRÉ-PROGRAMADO
-- Roda uma vez só. Se já existir, não duplica.
-- ============================================================
DO $$ BEGIN
  CREATE POLICY "public_read_order_status_history" ON order_status_history FOR SELECT TO anon,authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT SELECT ON order_tracking TO anon,authenticated;

DO $$
DECLARE
  rest_id UUID;
  cat_lanches UUID;
  cat_bebidas UUID;
  cat_combos UUID;
BEGIN
  -- Só cria se não existir nenhum restaurante ainda
  IF EXISTS (SELECT 1 FROM restaurants LIMIT 1) THEN
    RAISE NOTICE 'Restaurantes já existem, pulando seed.';
    RETURN;
  END IF;

  -- Criar restaurante
  INSERT INTO restaurants (
    owner_id, name, slug, description, status,
    primary_color, secondary_color
  ) VALUES (
    'seed_owner', 'Meu Restaurante', 'meu-restaurante',
    'Cardápio digital', 'published',
    '#06b6d4', '#8b5cf6'
  ) RETURNING id INTO rest_id;

  -- Criar categorias
  INSERT INTO categories (restaurant_id, name, sort_order) VALUES
    (rest_id, 'Lanches', 0),
    (rest_id, 'Bebidas', 1),
    (rest_id, 'Combos', 2)
  RETURNING id INTO cat_lanches, cat_bebidas, cat_combos;

  -- se só retornou 1 linha, ajusta
  IF cat_bebidas IS NULL THEN
    SELECT id INTO cat_bebidas FROM categories
      WHERE restaurant_id = rest_id AND name = 'Bebidas';
    SELECT id INTO cat_combos FROM categories
      WHERE restaurant_id = rest_id AND name = 'Combos';
  END IF;

  -- LANCHES
  INSERT INTO products (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (rest_id, cat_lanches, 'X-Burger', 'Pão, hambúrguer, queijo, alface e tomate', 18.90, 0),
    (rest_id, cat_lanches, 'X-Bacon', 'Pão, hambúrguer, queijo, bacon crocante', 21.90, 1),
    (rest_id, cat_lanches, 'X-Tudo', 'Hambúrguer duplo, queijo, bacon, ovo, presunto', 28.90, 2),
    (rest_id, cat_lanches, 'Frango Grelhado', 'Peito de frango grelhado com salada', 22.90, 3),
    (rest_id, cat_lanches, 'Hot Dog Especial', 'Salsicha, purê, milho, batata palha', 16.90, 4);

  -- BEBIDAS
  INSERT INTO products (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (rest_id, cat_bebidas, 'Coca-Cola Lata', '350ml gelada', 5.90, 0),
    (rest_id, cat_bebidas, 'Guaraná Lata', '350ml gelada', 5.90, 1),
    (rest_id, cat_bebidas, 'Água Mineral', '500ml sem gás', 3.90, 2),
    (rest_id, cat_bebidas, 'Suco Natural', 'Laranja ou limão 400ml', 7.90, 3),
    (rest_id, cat_bebidas, 'Cerveja Lata', 'Brahma ou Skol 350ml', 7.90, 4);

  -- COMBOS
  INSERT INTO products (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (rest_id, cat_combos, 'Combo Burger + Refri', 'X-Burger + Coca-Cola Lata por apenas', 22.90, 0),
    (rest_id, cat_combos, 'Combo Família', '2 X-Tudo + 2 Refris + Batata', 69.90, 1),
    (rest_id, cat_combos, 'Combo Fome Zero', 'X-Bacon + Batata + Refri', 32.90, 2);

  RAISE NOTICE 'Cardápio seed criado com sucesso! Slug: meu-restaurante';
END
$$;

-- ============================================================
-- Função: popular cardápio padrão num restaurante existente
-- Uso: SELECT setup_default_menu('ID_DO_RESTAURANTE');
-- ============================================================
CREATE OR REPLACE FUNCTION setup_default_menu(target_restaurant_id UUID)
RETURNS TEXT AS $$
DECLARE
  cat_lanches UUID;
  cat_bebidas UUID;
  cat_combos UUID;
BEGIN
  -- Verificar se já tem categorias
  IF EXISTS (SELECT 1 FROM categories WHERE restaurant_id = target_restaurant_id LIMIT 1) THEN
    RETURN 'Este restaurante já tem categorias. Limpe antes de popular.';
  END IF;

  -- Criar categorias
  INSERT INTO categories (restaurant_id, name, sort_order) VALUES
    (target_restaurant_id, 'Lanches', 0),
    (target_restaurant_id, 'Bebidas', 1),
    (target_restaurant_id, 'Combos', 2);

  SELECT id INTO cat_lanches FROM categories
    WHERE restaurant_id = target_restaurant_id AND name = 'Lanches';
  SELECT id INTO cat_bebidas FROM categories
    WHERE restaurant_id = target_restaurant_id AND name = 'Bebidas';
  SELECT id INTO cat_combos FROM categories
    WHERE restaurant_id = target_restaurant_id AND name = 'Combos';

  -- LANCHES
  INSERT INTO products (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (target_restaurant_id, cat_lanches, 'X-Burger', 'Pão, hambúrguer, queijo, alface e tomate', 18.90, 0),
    (target_restaurant_id, cat_lanches, 'X-Bacon', 'Pão, hambúrguer, queijo, bacon crocante', 21.90, 1),
    (target_restaurant_id, cat_lanches, 'X-Tudo', 'Hambúrguer duplo, queijo, bacon, ovo, presunto', 28.90, 2),
    (target_restaurant_id, cat_lanches, 'Frango Grelhado', 'Peito de frango grelhado com salada', 22.90, 3),
    (target_restaurant_id, cat_lanches, 'Hot Dog Especial', 'Salsicha, purê, milho, batata palha', 16.90, 4);

  -- BEBIDAS
  INSERT INTO products (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (target_restaurant_id, cat_bebidas, 'Coca-Cola Lata', '350ml gelada', 5.90, 0),
    (target_restaurant_id, cat_bebidas, 'Guaraná Lata', '350ml gelada', 5.90, 1),
    (target_restaurant_id, cat_bebidas, 'Água Mineral', '500ml sem gás', 3.90, 2),
    (target_restaurant_id, cat_bebidas, 'Suco Natural', 'Laranja ou limão 400ml', 7.90, 3),
    (target_restaurant_id, cat_bebidas, 'Cerveja Lata', 'Brahma ou Skol 350ml', 7.90, 4);

  -- COMBOS
  INSERT INTO products (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (target_restaurant_id, cat_combos, 'Combo Burger + Refri', 'X-Burger + Coca-Cola Lata por apenas', 22.90, 0),
    (target_restaurant_id, cat_combos, 'Combo Família', '2 X-Tudo + 2 Refris + Batata', 69.90, 1),
    (target_restaurant_id, cat_combos, 'Combo Fome Zero', 'X-Bacon + Batata + Refri', 32.90, 2);

  RETURN 'Cardápio padrão criado com sucesso!';
END;
$$ LANGUAGE plpgsql;
