-- ============================================================
-- RECOMPENSAS → DIÁRIAS (Pay-per-Use)
-- ============================================================
-- Antes: bater uma meta dava PEDIDOS BÔNUS na cota do mês (store_bonus_orders).
-- Agora: bater a meta dá DIÁRIAS (acesso de 24h), acumuláveis e resgatáveis
-- pelo dono. A cota do plano gratuito volta a ser 5/mês; o que cresce com o
-- engajamento é o saldo de diárias.
--
-- Como funciona o saldo:
--   concedido = SUM(store_day_credits.amount)      (só o cron concede)
--   usado     = count(store_day_passes WHERE source = 'credit')
--   saldo     = concedido - usado
-- O resgate (`redeem_day_pass`) é do dono, mas só CONSOME crédito — nunca cria.
-- Um dono malicioso não consegue inflar o saldo (mesma regra do bônus antigo).
--
-- Como rodar: cole TUDO isto no SQL Editor do Supabase e execute uma vez.
-- Depende de `supabase_day_pass_migration.sql` (store_day_passes).
-- É idempotente (IF NOT EXISTS / CREATE OR REPLACE / DROP+CREATE onde muda
-- a assinatura). Pode rodar de novo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Metas passam a carregar quantas diárias valem
-- ------------------------------------------------------------
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS day_credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reward_grants ADD COLUMN IF NOT EXISTS day_credits INTEGER NOT NULL DEFAULT 0;

-- O prêmio agora é diária, não cota: `bonus_orders` pode ser 0. Sem isto a
-- meta "conquistada" estourava o CHECK (bonus_orders > 0) do schema antigo.
ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_bonus_orders_check;
ALTER TABLE rewards ADD CONSTRAINT rewards_bonus_orders_check CHECK (bonus_orders >= 0);

-- Semeia as metas existentes (só onde ainda não há diárias definidas).
UPDATE rewards SET day_credits = 3 WHERE metric = 'usage_seconds' AND day_credits = 0;
UPDATE rewards SET day_credits = 10 WHERE metric = 'orders' AND day_credits = 0;

-- ------------------------------------------------------------
-- 2. store_day_credits — livro-razão das diárias conquistadas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_day_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL DEFAULT 'reward',
  period_month DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_day_credits_store
  ON store_day_credits (restaurant_id, period_month);

ALTER TABLE store_day_credits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "owner_read_day_credits" ON store_day_credits FOR SELECT
    TO authenticated USING (is_restaurant_owner(restaurant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON TABLE store_day_credits TO authenticated;
GRANT ALL ON TABLE store_day_credits TO service_role;
REVOKE ALL ON TABLE store_day_credits FROM anon;

-- ------------------------------------------------------------
-- 3. Leitura do saldo para o cliente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owner_day_pass_credits(p_store UUID)
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(0,
    COALESCE((
      SELECT SUM(c.amount) FROM store_day_credits c
      WHERE c.restaurant_id = p_store AND is_restaurant_owner(p_store)
    ), 0)
    - COALESCE((
      SELECT count(*) FROM store_day_passes d
      WHERE d.restaurant_id = p_store AND d.source = 'credit'
    ), 0)
  )::int;
$$;
GRANT EXECUTE ON FUNCTION public.owner_day_pass_credits(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 4. redeem_day_pass — o dono troca 1 crédito por 24h de acesso
-- ------------------------------------------------------------
-- Só consome: valida a posse, exige saldo > 0 e grava a janela de 24h. O
-- advisory lock evita que dois cliques simultâneos resgatem o mesmo crédito.
CREATE OR REPLACE FUNCTION public.redeem_day_pass(p_store UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance INTEGER;
  v_until TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR NOT is_restaurant_owner(p_store) THEN
    RAISE EXCEPTION 'sem permissao';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('day_pass:' || p_store::text));

  v_balance := public.owner_day_pass_credits(p_store);
  IF v_balance <= 0 THEN
    RAISE EXCEPTION 'sem diarias disponiveis';
  END IF;

  INSERT INTO store_day_passes (restaurant_id, unlocked_until, amount_cents, source)
  VALUES (p_store, now() + interval '24 hours', 0, 'credit')
  RETURNING unlocked_until INTO v_until;

  RETURN v_until;
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_day_pass(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 5. owner_rewards — agora devolve quantas diárias a meta vale
-- ------------------------------------------------------------
-- Muda a lista de colunas do RETURNS TABLE, então precisa de DROP antes.
DROP FUNCTION IF EXISTS public.owner_rewards(UUID);

CREATE OR REPLACE FUNCTION public.owner_rewards(p_store UUID)
RETURNS TABLE(
  reward_id UUID,
  title TEXT,
  metric TEXT,
  threshold BIGINT,
  bonus_orders INTEGER,
  day_credits INTEGER,
  progress BIGINT,
  granted BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_restaurant_owner(p_store) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id AS reward_id,
    r.title,
    r.metric,
    r.threshold,
    r.bonus_orders,
    r.day_credits,
    CASE
      WHEN r.metric = 'orders' THEN (
        SELECT count(*) FROM orders o
        WHERE o.restaurant_id = p_store AND o.status <> 'cancelled'
          AND o.created_at >= date_trunc('month', CURRENT_DATE)
      )
      WHEN r.metric = 'usage_seconds' THEN (
        SELECT COALESCE(SUM(u.seconds), 0)::bigint FROM store_usage u
        WHERE u.restaurant_id = p_store
          AND u.day >= date_trunc('month', CURRENT_DATE)::date
      )
      ELSE 0::bigint
    END AS progress,
    EXISTS (
      SELECT 1 FROM reward_grants g
      WHERE g.reward_id = r.id AND g.restaurant_id = p_store
        AND g.period_month = date_trunc('month', CURRENT_DATE)::date
    ) AS granted
  FROM rewards r
  WHERE r.active = true
  ORDER BY r.threshold;
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_rewards(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 6. notify_reward_push — passa a avisar sobre diárias
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.notify_reward_push(UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.notify_reward_push(
  p_store UUID, p_title TEXT, p_day_credits INTEGER
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net AS $$
DECLARE
  v_base TEXT;
BEGIN
  SELECT value INTO v_base FROM app_settings WHERE key = 'functions_base_url';
  IF v_base IS NULL OR length(trim(v_base)) = 0 THEN
    RETURN; -- push opcional: sem URL configurada, as diárias já foram concedidas
  END IF;
  PERFORM net.http_post(
    url := rtrim(v_base, '/') || '/notify-reward',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'restaurant_id', p_store, 'title', p_title, 'day_credits', p_day_credits
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_reward_push falhou: %', SQLERRM;
END;
$$;

-- ------------------------------------------------------------
-- 7. evaluate_rewards — concede DIÁRIAS quando a meta é batida
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_rewards()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period DATE := date_trunc('month', CURRENT_DATE)::date;
  r RECORD;
  v_store RECORD;
  v_value BIGINT;
  v_granted INTEGER := 0;
BEGIN
  FOR r IN SELECT * FROM rewards WHERE active = true LOOP
    FOR v_store IN
      SELECT s.id FROM restaurants s
      WHERE NOT EXISTS (
        SELECT 1 FROM reward_grants g
        WHERE g.reward_id = r.id AND g.restaurant_id = s.id
          AND g.period_month = v_period
      )
    LOOP
      IF r.metric = 'orders' THEN
        SELECT count(*) INTO v_value FROM orders o
         WHERE o.restaurant_id = v_store.id AND o.status <> 'cancelled'
           AND o.created_at >= date_trunc('month', CURRENT_DATE);
      ELSIF r.metric = 'usage_seconds' THEN
        SELECT COALESCE(SUM(u.seconds), 0) INTO v_value FROM store_usage u
         WHERE u.restaurant_id = v_store.id AND u.day >= v_period;
      ELSE
        v_value := 0;
      END IF;

      IF COALESCE(v_value, 0) >= r.threshold THEN
        -- bonus_orders fica 0: o prêmio agora é diária, não cota.
        INSERT INTO reward_grants (reward_id, restaurant_id, period_month, bonus_orders, day_credits)
        VALUES (r.id, v_store.id, v_period, 0, r.day_credits)
        ON CONFLICT DO NOTHING;
        IF FOUND THEN
          INSERT INTO store_day_credits (restaurant_id, amount, reason, period_month)
          VALUES (v_store.id, GREATEST(r.day_credits, 1), 'reward:' || r.id, v_period);
          v_granted := v_granted + 1;
          PERFORM public.notify_reward_push(v_store.id, r.title, r.day_credits);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('granted', v_granted, 'period', v_period);
END;
$$;

-- ------------------------------------------------------------
-- 8. store_access_state — inclui o saldo de diárias
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_access_state(p_store UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_annual TIMESTAMPTZ;
  v_day TIMESTAMPTZ;
  v_used INTEGER;
  v_bonus INTEGER;
  v_credits INTEGER;
  v_limit INTEGER;
BEGIN
  IF NOT is_restaurant_owner(p_store) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT a.premium_expires_at INTO v_annual
  FROM admin_trials a
  WHERE a.store_id::text = p_store::text
    AND COALESCE(a.is_premium, false)
    AND a.premium_expires_at IS NOT NULL
    AND a.premium_expires_at > now();

  SELECT MAX(d.unlocked_until) INTO v_day
  FROM store_day_passes d
  WHERE d.restaurant_id = p_store
    AND d.unlocked_until > now();

  SELECT count(*) INTO v_used
  FROM orders o
  WHERE o.restaurant_id = p_store
    AND o.status <> 'cancelled'
    AND o.created_at >= date_trunc('month', CURRENT_DATE);

  SELECT COALESCE(SUM(b.amount), 0) INTO v_bonus
  FROM store_bonus_orders b
  WHERE b.restaurant_id = p_store
    AND b.period_month = date_trunc('month', CURRENT_DATE)::date;

  v_credits := public.owner_day_pass_credits(p_store);
  v_limit := 5 + COALESCE(v_bonus, 0);

  RETURN jsonb_build_object(
    'unlocked', (v_annual IS NOT NULL OR v_day IS NOT NULL),
    'source', CASE WHEN v_annual IS NOT NULL THEN 'annual'
                   WHEN v_day IS NOT NULL THEN 'day'
                   ELSE 'free' END,
    'annual_expires_at', v_annual,
    'unlocked_until', v_day,
    'quota_used', COALESCE(v_used, 0),
    'quota_limit', v_limit,
    'day_pass_credits', v_credits
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.store_access_state(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 9. Conferência (opcional)
-- ------------------------------------------------------------
-- SELECT public.owner_day_pass_credits('<store-uuid>');   -- saldo
-- SELECT public.owner_rewards('<store-uuid>');            -- metas + progresso
-- SELECT public.evaluate_rewards();                       -- roda a avaliação agora
