
CREATE TABLE public.admin_trials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id VARCHAR NOT NULL UNIQUE,
  store_name VARCHAR,
  store_slogan TEXT,
  store_marquee TEXT,
  pix_key VARCHAR,
  whatsapp VARCHAR,
  admin_phone VARCHAR,
  admin_email VARCHAR,
  access_code VARCHAR,
  trial_started_at TIMESTAMPTZ DEFAULT now(),
  trial_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  config_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.admin_trials TO anon, authenticated;
GRANT ALL ON public.admin_trials TO service_role;
ALTER TABLE public.admin_trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_trials_read" ON public.admin_trials FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_trials_insert" ON public.admin_trials FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin_trials_update" ON public.admin_trials FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id VARCHAR,
  customer_name VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  delivery_address TEXT,
  delivery_type VARCHAR,
  observations TEXT,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR,
  change_for DECIMAL(10,2),
  comanda VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'pendente',
  cidadela_code VARCHAR,
  cidadela_access_type VARCHAR,
  payment_status VARCHAR NOT NULL DEFAULT 'pending',
  payment_confirmed_at TIMESTAMPTZ,
  payment_proof_url TEXT,
  payment_rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_read" ON public.orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id VARCHAR,
  product_name VARCHAR,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO anon, authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_read" ON public.order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.cidadela_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR NOT NULL,
  store_id VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  access_type VARCHAR NOT NULL CHECK (access_type IN ('15_min','15_dias')),
  order_total DECIMAL(10,2),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cidadela_codes TO anon, authenticated;
GRANT ALL ON public.cidadela_codes TO service_role;
ALTER TABLE public.cidadela_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cidadela_codes_read" ON public.cidadela_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cidadela_codes_insert" ON public.cidadela_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "cidadela_codes_update" ON public.cidadela_codes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.soberania_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  points INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.soberania_points TO anon, authenticated;
GRANT ALL ON public.soberania_points TO service_role;
ALTER TABLE public.soberania_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "soberania_points_read" ON public.soberania_points FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "soberania_points_insert" ON public.soberania_points FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "soberania_points_update" ON public.soberania_points FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.soberania_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  type VARCHAR NOT NULL CHECK (type IN ('earned','lost','spent','rewarded')),
  amount INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  source VARCHAR NOT NULL CHECK (source IN ('game','order','ad','admin')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.soberania_transactions TO anon, authenticated;
GRANT ALL ON public.soberania_transactions TO service_role;
ALTER TABLE public.soberania_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "soberania_transactions_read" ON public.soberania_transactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "soberania_transactions_insert" ON public.soberania_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
