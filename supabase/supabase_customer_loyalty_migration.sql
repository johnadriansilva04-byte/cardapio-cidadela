-- ============================================================
-- CONTA DO CLIENTE, PONTOS DE SOBERANIA (SOV) E PROMOÇÕES
-- ============================================================
-- Migração opcional e incremental: o app continua funcionando sem ela
-- (a seção de pontos/promoções some sozinha). Rode no SQL Editor do
-- Supabase para habilitar.
--
-- O que esta migração resolve:
--   1. Os pedidos do convidado viviam só num guest_id no localStorage,
--      então trocar de navegador "perdia" o histórico. Agora o convidado
--      pode reivindicar seus pedidos para a conta real (auth.uid()).
--   2. Os pontos de soberania eram calculados no cliente e mostrados uma
--      vez; nada era persistido nem somado entre pedidos. Agora existe um
--      livro-razão imutável (point_transactions) por restaurante.
--   3. Promoções do restaurante deixam de ser texto solto e viram dados.
-- ============================================================

-- ============================================================
-- PROMOÇÕES — o restaurante publica; o cliente vê no perfil
-- ============================================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- 'points_multiplier' (pontos em dobro), 'bonus_points' (pontos fixos),
  -- 'reward' (troca de pontos por benefício), 'discount' (desconto %)
  kind TEXT NOT NULL DEFAULT 'reward'
    CHECK (kind IN ('points_multiplier', 'bonus_points', 'reward', 'discount')),
  -- Para 'reward': custo em SOV. Para 'discount': percentual.
  -- Para 'bonus_points': pontos concedidos. Para 'points_multiplier': fator.
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'reward';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS value NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_promotions_restaurant
  ON promotions(restaurant_id, sort_order);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Leitura pública: qualquer visitante do cardápio enxerga as promoções ativas.
DO $$ BEGIN
  CREATE POLICY "public_read_promotions" ON promotions FOR SELECT
    USING (restaurant_id IN (SELECT id FROM restaurants WHERE status = 'published'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- O dono administra as promoções dos próprios restaurantes.
DO $$ BEGIN
  CREATE POLICY "owner_manage_promotions" ON promotions FOR ALL TO authenticated
    USING (is_restaurant_owner(restaurant_id))
    WITH CHECK (is_restaurant_owner(restaurant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON TABLE promotions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE promotions TO authenticated;

-- ============================================================
-- LIVRO-RAZÃO DE PONTOS DE SOBERANIA (SOV)
-- ============================================================
-- Imutável por natureza: o saldo é a soma das transações. Isso permite
-- auditar resgates e evita o saldo "mágico" que se perdia ao limpar o
-- navegador. `guest_id` guarda os pontos de quem ainda não entrou.
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  -- 'order' (ganho por compra), 'reward_redeemed' (resgate), 'bonus',
  -- 'claim' (migração dos pontos do convidado), 'adjustment' (ajuste do dono)
  reason TEXT NOT NULL DEFAULT 'order',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uma linha precisa ter dono: ou conta real, ou convidado.
  CONSTRAINT point_transactions_owner_check
    CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user
  ON point_transactions(user_id, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_guest
  ON point_transactions(guest_id, restaurant_id);

-- Concede pontos uma única vez por pedido: se o trigger rodar duas vezes
-- (retry, reprocessamento), a segunda tentativa falha em vez de duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_order_once
  ON point_transactions(order_id, reason)
  WHERE order_id IS NOT NULL AND reason = 'order';

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

-- Cada cliente vê apenas o próprio extrato.
DO $$ BEGIN
  CREATE POLICY "customer_read_own_points" ON point_transactions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- O dono enxerga os pontos concedidos nos próprios restaurantes.
DO $$ BEGIN
  CREATE POLICY "owner_read_points" ON point_transactions FOR SELECT
    TO authenticated
    USING (is_restaurant_owner(restaurant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sem INSERT direto: pontos só entram pelo trigger de pedido e pelas RPCs
-- SECURITY DEFINER abaixo, para o cliente não poder fabricar saldo.
GRANT SELECT ON TABLE point_transactions TO authenticated;

-- ============================================================
-- RESGATES — trilha do que o cliente já trocou
-- ============================================================
CREATE TABLE IF NOT EXISTS promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  points_spent INTEGER NOT NULL CHECK (points_spent >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_user
  ON promotion_redemptions(user_id, restaurant_id);

ALTER TABLE promotion_redemptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "customer_read_own_redemptions" ON promotion_redemptions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "owner_read_redemptions" ON promotion_redemptions FOR SELECT
    TO authenticated
    USING (is_restaurant_owner(restaurant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON TABLE promotion_redemptions TO authenticated;

-- ============================================================
-- PONTOS POR PEDIDO — calculados no servidor
-- ============================================================
-- Antes os pontos só existiam na tela de sucesso (1 SOV a cada R$ 30).
-- Aqui o cálculo passa a ser do banco, então vale para o histórico e para
-- qualquer aparelho. Multiplicadores de promoção ativa são aplicados no ato.
CREATE OR REPLACE FUNCTION public.award_order_points()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_points INTEGER;
  multiplier NUMERIC := 1;
BEGIN
  base_points := FLOOR(COALESCE(NEW.total, 0) / 30);
  IF base_points <= 0 THEN
    RETURN NEW;
  END IF;

  -- Promoção de pontos em dobro/triplo vigente, se houver.
  SELECT COALESCE(MAX(value), 1) INTO multiplier
  FROM promotions
  WHERE restaurant_id = NEW.restaurant_id
    AND kind = 'points_multiplier'
    AND active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now());

  INSERT INTO point_transactions (
    restaurant_id, user_id, guest_id, order_id, amount, reason, description
  )
  VALUES (
    NEW.restaurant_id,
    -- customer_id é TEXT no schema; só vale como UUID de auth quando bate.
    CASE WHEN NEW.customer_id ~ '^[0-9a-f]{8}-' THEN NEW.customer_id::uuid ELSE NULL END,
    NEW.guest_id,
    NEW.id,
    GREATEST(1, FLOOR(base_points * COALESCE(multiplier, 1)))::integer,
    'order',
    'Pontos do pedido ' || COALESCE(NEW.comanda, '')
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Pontos nunca devem impedir um pedido de existir.
  RAISE WARNING 'award_order_points falhou para o pedido %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_order_points ON orders;
CREATE TRIGGER trg_award_order_points
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.award_order_points();

-- ============================================================
-- RECLASSIFICAR PONTOS DO CONVIDADO AO ENTRAR NA CONTA
-- ============================================================
-- Chamado depois do login: move pontos e pedidos do guest_id deste
-- dispositivo para a conta real. Só toca registros ainda órfãos.
CREATE OR REPLACE FUNCTION public.claim_guest_data(p_guest TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_points INTEGER := 0;
  v_orders INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'claim_guest_data exige usuário autenticado';
  END IF;
  IF p_guest IS NULL OR length(trim(p_guest)) = 0 THEN
    RETURN jsonb_build_object('points', 0, 'orders', 0);
  END IF;

  -- Pontos do convidado viram pontos da conta.
  UPDATE point_transactions
     SET user_id = v_uid, guest_id = NULL
   WHERE guest_id = p_guest
     AND user_id IS NULL;
  GET DIAGNOSTICS v_points = ROW_COUNT;

  -- Pedidos feitos como convidado passam a pertencer à conta.
  UPDATE orders
     SET customer_id = v_uid::text
   WHERE guest_id = p_guest
     AND (customer_id IS NULL OR customer_id = '');
  GET DIAGNOSTICS v_orders = ROW_COUNT;

  RETURN jsonb_build_object('points', v_points, 'orders', v_orders);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_guest_data(TEXT) TO authenticated;

-- ============================================================
-- SALDO DE SOV DA CONTA
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_sovereignty()
RETURNS TABLE (
  restaurant_id UUID,
  restaurant_name TEXT,
  balance INTEGER,
  earned INTEGER,
  spent INTEGER
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.restaurant_id,
    r.name AS restaurant_name,
    COALESCE(SUM(t.amount), 0)::integer AS balance,
    COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0)::integer AS earned,
    COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.amount < 0)), 0)::integer AS spent
  FROM point_transactions t
  JOIN restaurants r ON r.id = t.restaurant_id
  WHERE t.user_id = auth.uid()
  GROUP BY t.restaurant_id, r.name
  ORDER BY balance DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_sovereignty() TO authenticated;

-- ============================================================
-- RESGATAR PROMOÇÃO COM PONTOS
-- ============================================================
-- O saldo é conferido no servidor contra o livro-razão. O cliente não
-- consegue resgatar mais do que tem, mesmo adulterando a tela.
CREATE OR REPLACE FUNCTION public.redeem_promotion(
  p_promotion UUID,
  p_order UUID DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_promo RECORD;
  v_balance INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'redeem_promotion exige usuário autenticado';
  END IF;

  SELECT * INTO v_promo FROM promotions WHERE id = p_promotion;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promoção não encontrada';
  END IF;
  IF NOT v_promo.active THEN
    RAISE EXCEPTION 'Promoção inativa';
  END IF;
  IF v_promo.kind <> 'reward' THEN
    RAISE EXCEPTION 'Somente promoções do tipo reward podem ser resgatadas';
  END IF;
  IF v_promo.ends_at IS NOT NULL AND v_promo.ends_at < now() THEN
    RAISE EXCEPTION 'Promoção expirada';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM point_transactions
  WHERE user_id = v_uid AND restaurant_id = v_promo.restaurant_id;

  IF v_balance < v_promo.value THEN
    RAISE EXCEPTION 'Pontos insuficientes: saldo %, necessário %', v_balance, v_promo.value;
  END IF;

  INSERT INTO point_transactions (
    restaurant_id, user_id, order_id, amount, reason, description
  ) VALUES (
    v_promo.restaurant_id, v_uid, p_order, -v_promo.value, 'reward_redeemed', v_promo.title
  );

  INSERT INTO promotion_redemptions (
    promotion_id, restaurant_id, user_id, order_id, points_spent
  ) VALUES (
    v_promo.id, v_promo.restaurant_id, v_uid, p_order, v_promo.value
  );

  RETURN jsonb_build_object(
    'ok', true,
    'spent', v_promo.value,
    'balance', v_balance - v_promo.value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_promotion(UUID, UUID) TO authenticated;

-- ============================================================
-- RESGATE PÚBLICO POR COMANDA (opcional, para o fluxo sem login)
-- ============================================================
-- Mantém o comportamento antigo de consultar um pedido pela comanda,
-- agora restrito ao restaurante dono.
CREATE OR REPLACE FUNCTION public.get_restaurant_promotions(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  kind TEXT,
  value NUMERIC,
  ends_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.title, p.description, p.kind, p.value, p.ends_at
  FROM promotions p
  JOIN restaurants r ON r.id = p.restaurant_id
  WHERE r.slug = p_slug
    AND r.status = 'published'
    AND p.active = true
    AND (p.starts_at IS NULL OR p.starts_at <= now())
    AND (p.ends_at IS NULL OR p.ends_at >= now())
  ORDER BY p.sort_order, p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_promotions(TEXT) TO anon, authenticated;