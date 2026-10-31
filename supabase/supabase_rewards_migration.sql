-- ============================================================
-- RECOMPENSAS POR ENGAJAMENTO — pedidos bônus na cota
-- ============================================================
-- Ideia: em vez de cupom de desconto, a loja que usa o sistema ganha
-- PEDIDOS A MAIS na cota do mês. A cota efetiva vira:
--
--     limite efetivo = 5 (grátis) + bônus conquistado no mês
--
-- Ex.: "ficou 20h online no mês → +5 pedidos", "bateu 1.000 pedidos → +20".
-- Quando a meta é atingida o dono recebe uma NOTIFICAÇÃO (push) e um banner.
--
-- Como rodar: cole TUDO isto no SQL Editor do Supabase e execute uma vez.
-- É idempotente (IF NOT EXISTS / CREATE OR REPLACE) — pode rodar de novo.
--
-- Segurança: o saldo de bônus NUNCA é gravável pelo cliente. Ele vive numa
-- tabela separada (store_bonus_orders) com RLS só de leitura para o dono; só
-- o cron/service role concede. Isso é essencial: se ficasse em admin_trials
-- (que o dono edita), bastava um PATCH bonus=9999 para furar o limite.
--
-- Mercado Pago NÃO é tocado: o fluxo de assinatura segue idêntico.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Configuração (opcional) — base da Edge Function de push
-- ------------------------------------------------------------
-- O cron precisa da URL pública das Edge Functions para avisar o dono. Guarde
-- uma vez, ex.: https://<seu-projeto>.supabase.co/functions/v1
-- Sem esta linha, o bônus ainda é concedido — só não sai o push.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: só service role / SECURITY DEFINER leem. Não é dado de app.

-- ------------------------------------------------------------
-- 1. store_bonus_orders — o saldo de pedidos bônus (por mês)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_bonus_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL DEFAULT 'reward',
  period_month DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_bonus_store_period
  ON store_bonus_orders (restaurant_id, period_month);

-- ------------------------------------------------------------
-- 2. store_usage — tempo online da loja (só dentro do horário aberto)
-- ------------------------------------------------------------
-- O app manda um batimento enquanto o painel está visível E a loja está
-- aberta (dentro do operating_hours). Um dia por linha, somando segundos.
CREATE TABLE IF NOT EXISTS store_usage (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  seconds BIGINT NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  PRIMARY KEY (restaurant_id, day)
);

-- ------------------------------------------------------------
-- 3. rewards — as metas (editáveis)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL CHECK (metric IN ('orders', 'usage_seconds')),
  threshold BIGINT NOT NULL CHECK (threshold > 0),
  bonus_orders INTEGER NOT NULL CHECK (bonus_orders > 0),
  title TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4. reward_grants — quem já ganhou (dedupe automático pela PK)
-- ------------------------------------------------------------
-- period_month garante 1 conquista por meta por loja por mês.
CREATE TABLE IF NOT EXISTS reward_grants (
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  period_month DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  bonus_orders INTEGER NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reward_id, restaurant_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_reward_grants_store
  ON reward_grants (restaurant_id, period_month);

-- ------------------------------------------------------------
-- 5. RLS + GRANTs (leitura para o dono; escrita só server-side)
-- ------------------------------------------------------------
ALTER TABLE store_bonus_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_grants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "owner_read_bonus" ON store_bonus_orders FOR SELECT
    TO authenticated USING (is_restaurant_owner(restaurant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "owner_read_usage" ON store_usage FOR SELECT
    TO authenticated USING (is_restaurant_owner(restaurant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "owner_read_grants" ON reward_grants FOR SELECT
    TO authenticated USING (is_restaurant_owner(restaurant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Metas são conteúdo de referência (não sensível): qualquer conta autenticada
-- pode ler as ativas para exibir "próxima meta".
DO $$ BEGIN
  CREATE POLICY "read_active_rewards" ON rewards FOR SELECT
    TO authenticated USING (active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON TABLE store_bonus_orders, store_usage, reward_grants, rewards
  TO authenticated;
GRANT ALL ON TABLE app_settings, store_bonus_orders, store_usage, rewards, reward_grants
  TO service_role;

-- O anon não tem policy nenhuma aqui: nada de bônus/config para visitante.
-- RLS já barra; o REVOKE é defesa em profundidade (não depender só do RLS).
REVOKE ALL ON TABLE app_settings, store_bonus_orders, store_usage, rewards, reward_grants
  FROM anon;

-- ------------------------------------------------------------
-- 6. bump_store_usage — batimento do cliente (com teto anti-inflação)
-- ------------------------------------------------------------
-- O cliente só manda o restaurante e os segundos desde o último batimento.
-- O teto de 120s por chamada impede que um cliente malicioso infle o tempo.
-- Valida a posse. Devolve o total do mês (para o app não precisar reler).
CREATE OR REPLACE FUNCTION public.bump_store_usage(p_store UUID, p_seconds INTEGER)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sec INTEGER := LEAST(GREATEST(COALESCE(p_seconds, 0), 0), 120);
  v_total BIGINT;
BEGIN
  IF auth.uid() IS NULL OR NOT is_restaurant_owner(p_store) THEN
    RAISE EXCEPTION 'sem permissao';
  END IF;
  IF v_sec <= 0 THEN
    SELECT COALESCE(SUM(seconds), 0) INTO v_total FROM store_usage
     WHERE restaurant_id = p_store AND day >= date_trunc('month', CURRENT_DATE)::date;
    RETURN v_total;
  END IF;

  INSERT INTO store_usage (restaurant_id, day, seconds)
  VALUES (p_store, CURRENT_DATE, v_sec)
  ON CONFLICT (restaurant_id, day)
    DO UPDATE SET seconds = store_usage.seconds + EXCLUDED.seconds;

  SELECT COALESCE(SUM(seconds), 0) INTO v_total FROM store_usage
   WHERE restaurant_id = p_store AND day >= date_trunc('month', CURRENT_DATE)::date;
  RETURN v_total;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bump_store_usage(UUID, INTEGER) TO authenticated;

-- ------------------------------------------------------------
-- 7. Leituras para o cliente (bônus, uso, metas)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owner_bonus_orders(p_store UUID)
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount), 0)::int
  FROM store_bonus_orders
  WHERE restaurant_id = p_store
    AND is_restaurant_owner(p_store)
    AND period_month = date_trunc('month', CURRENT_DATE)::date;
$$;
GRANT EXECUTE ON FUNCTION public.owner_bonus_orders(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_usage_seconds(p_store UUID)
RETURNS BIGINT
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(seconds), 0)
  FROM store_usage
  WHERE restaurant_id = p_store
    AND is_restaurant_owner(p_store)
    AND day >= date_trunc('month', CURRENT_DATE)::date;
$$;
GRANT EXECUTE ON FUNCTION public.owner_usage_seconds(UUID) TO authenticated;

-- Recompensas do mês com progresso (para o banner e o "próximo objetivo").
-- O DROP é obrigatório: a migração de day-pass recria esta função com uma
-- coluna a mais (day_credits). `CREATE OR REPLACE` recusa mudar o tipo de
-- retorno, então sem o DROP a migração quebra ao re-rodar num banco que já
-- recebeu a versão mais nova.
DROP FUNCTION IF EXISTS public.owner_rewards(UUID);
CREATE OR REPLACE FUNCTION public.owner_rewards(p_store UUID)
RETURNS TABLE(
  reward_id UUID,
  title TEXT,
  metric TEXT,
  threshold BIGINT,
  bonus_orders INTEGER,
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
-- 8. notify_reward_push — avisa o dono (best-effort via pg_net)
-- ------------------------------------------------------------
-- Chama a Edge Function `notify-reward`, que faz o Web Push para os
-- dispositivos do restaurante. Se pg_net ou a URL não estiverem configurados,
-- apenas loga — a recompensa (o bônus) já foi concedida de qualquer forma.
-- O DROP é obrigatório: a migração de day-pass renomeia o 3º parâmetro
-- (p_bonus → p_day_credits). Sem ele, o CREATE OR REPLACE falha ao re-rodar.
DROP FUNCTION IF EXISTS public.notify_reward_push(UUID, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.notify_reward_push(
  p_store UUID, p_title TEXT, p_bonus INTEGER
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net AS $$
DECLARE
  v_base TEXT;
BEGIN
  SELECT value INTO v_base FROM app_settings WHERE key = 'functions_base_url';
  IF v_base IS NULL OR length(trim(v_base)) = 0 THEN
    RETURN; -- push opcional: sem URL configurada, só concede o bônus
  END IF;
  PERFORM net.http_post(
    url := rtrim(v_base, '/') || '/notify-reward',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'restaurant_id', p_store, 'title', p_title, 'bonus_orders', p_bonus
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_reward_push falhou: %', SQLERRM;
END;
$$;

-- ------------------------------------------------------------
-- 9. evaluate_rewards — concede o bônus quando a meta é batida
-- ------------------------------------------------------------
-- Roda no cron. Para cada meta ativa e loja que ainda não conquistou no mês,
-- compara o progresso com o limite; batendo, grava o grant + o bônus e avisa.
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
        INSERT INTO reward_grants (reward_id, restaurant_id, period_month, bonus_orders)
        VALUES (r.id, v_store.id, v_period, r.bonus_orders)
        ON CONFLICT DO NOTHING;
        IF FOUND THEN
          INSERT INTO store_bonus_orders (restaurant_id, amount, reason, period_month)
          VALUES (v_store.id, r.bonus_orders, 'reward:' || r.id, v_period);
          v_granted := v_granted + 1;
          PERFORM public.notify_reward_push(v_store.id, r.title, r.bonus_orders);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('granted', v_granted, 'period', v_period);
END;
$$;

-- ------------------------------------------------------------
-- 10. Cota com bônus — recria as RPCs de bloqueio
-- ------------------------------------------------------------
-- Só muda a constante: 5 vira (5 + bônus do mês). O resto da regra é idêntico
-- (contagem de pedidos reais, SECURITY DEFINER, posse validada).
CREATE OR REPLACE FUNCTION public.get_order_for_owner(p_oid UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store_id UUID;
  v_premium BOOLEAN;
  v_expires TIMESTAMPTZ;
  v_count INTEGER;
  v_bonus INTEGER;
  v_found UUID;
  v_order JSONB;
  v_blocked BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('blocked', true);
  END IF;

  SELECT o.restaurant_id, o.id INTO v_store_id, v_found
  FROM orders o
  WHERE o.id = p_oid AND is_restaurant_owner(o.restaurant_id);

  IF v_found IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.is_premium, a.premium_expires_at
    INTO v_premium, v_expires
  FROM admin_trials a
  WHERE a.store_id::text = v_store_id::text;

  IF NOT (COALESCE(v_premium, false) AND v_expires IS NOT NULL AND v_expires > now()) THEN
    SELECT count(*) INTO v_count
    FROM orders o
    WHERE o.restaurant_id = v_store_id
      AND o.status <> 'cancelled'
      AND o.created_at >= date_trunc('month', CURRENT_DATE);

    -- Bônus conquistado no mês eleva a cota efetiva (5 + bônus).
    SELECT COALESCE(SUM(amount), 0) INTO v_bonus
    FROM store_bonus_orders
    WHERE restaurant_id = v_store_id
      AND period_month = date_trunc('month', CURRENT_DATE)::date;

    IF COALESCE(v_count, 0) >= (5 + COALESCE(v_bonus, 0)) THEN
      v_blocked := true;
    END IF;
  END IF;

  IF v_blocked THEN
    RETURN jsonb_build_object('blocked', true);
  END IF;

  SELECT row_to_json(o)::jsonb
    || jsonb_build_object('order_items', COALESCE((
         SELECT jsonb_agg(row_to_json(i) ORDER BY i.created_at)
         FROM order_items i WHERE i.order_id = o.id
       ), '[]'::jsonb))
    INTO v_order
  FROM orders o WHERE o.id = p_oid;

  RETURN jsonb_build_object('blocked', false, 'order', v_order);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_locked_stores()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id
  FROM restaurants r
  LEFT JOIN admin_trials a ON a.store_id::text = r.id::text
  WHERE is_restaurant_owner(r.id)
    AND NOT (
      COALESCE(a.is_premium, false)
      AND a.premium_expires_at IS NOT NULL
      AND a.premium_expires_at > now()
    )
    AND (
      SELECT count(*)
      FROM orders o
      WHERE o.restaurant_id = r.id
        AND o.status <> 'cancelled'
        AND o.created_at >= date_trunc('month', CURRENT_DATE)
    ) >= (
      5 + COALESCE((
        SELECT SUM(b.amount) FROM store_bonus_orders b
        WHERE b.restaurant_id = r.id
          AND b.period_month = date_trunc('month', CURRENT_DATE)::date
      ), 0)
    );
$$;

-- ------------------------------------------------------------
-- 11. Agendamento (pg_cron) — avalia as metas de hora em hora
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- pg_net é opcional (só para o push). Se indisponível, o bônus ainda sai.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_net indisponível — push de recompensa ficará desligado: %', SQLERRM;
END $$;

SELECT cron.unschedule('cidadela-rewards')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cidadela-rewards');

SELECT cron.schedule(
  'cidadela-rewards',
  '10 * * * *',  -- de hora em hora, aos 10 min
  $$SELECT public.evaluate_rewards()$$
);

-- ------------------------------------------------------------
-- 12. Metas padrão (só insere se a tabela estiver vazia)
-- ------------------------------------------------------------
INSERT INTO rewards (metric, threshold, bonus_orders, title, description)
SELECT * FROM (VALUES
  ('usage_seconds', 72000::bigint, 5, 'Liga 20h no mês', 'Fique 20 horas com a loja aberta e ganhe +5 pedidos.'),
  ('orders', 1000::bigint, 20, 'Mil pedidos', 'Bata 1.000 pedidos no mês e ganhe +20 pedidos.')
) AS v(metric, threshold, bonus_orders, title, description)
WHERE NOT EXISTS (SELECT 1 FROM rewards);

-- ------------------------------------------------------------
-- 13. Conferência (opcional)
-- ------------------------------------------------------------
-- SELECT public.evaluate_rewards();          -- roda a avaliação na hora
-- SELECT * FROM public.owner_rewards();       -- metas + progresso da sua loja
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'cidadela-rewards';
