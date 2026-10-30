-- ============================================================
-- DIÁRIA (PAY-PER-USE) — acesso por 24 horas via Mercado Pago
-- ============================================================
-- O plano anual (admin_trials.premium_expires_at) continua sendo a janela
-- longa. A diária é uma janela curta: o dono paga R$ 1,49 e a loja fica
-- liberada por 24 HORAS CORRIDAS a partir da aprovação do pagamento — não
-- expira à meia-noite e o tempo corre com a loja aberta ou fechada.
--
-- Como rodar: cole TUDO isto no SQL Editor do Supabase e execute uma vez.
-- É idempotente (IF NOT EXISTS / CREATE OR REPLACE) — pode rodar de novo.
--
-- Segurança: a diária NUNCA é gravável pelo cliente. Vive numa tabela
-- separada (store_day_passes) com RLS só de leitura para o dono e sem grant
-- para anon; quem concede é a RPC SECURITY DEFINER `grant_day_pass`, com
-- EXECUTE apenas para a service role (webhook do Mercado Pago). É o mesmo
-- desenho de store_bonus_orders — se o acesso ficasse gravável no cliente,
-- bastaria um INSERT para liberar a loja de graça.
--
-- Aditivo: sem esta migração, as RPCs anteriores continuam valendo e nada
-- trava. O webhook só chama `grant_day_pass` quando o pagamento traz
-- metadata.kind = 'day_pass'.
-- ============================================================

-- ------------------------------------------------------------
-- 1. store_day_passes — livro-razão das diárias concedidas
-- ------------------------------------------------------------
-- Uma linha por pagamento aprovado. `unlocked_until` é o fim da janela de
-- 24h (now() + interval '24 hours' no momento da concessão). `mp_payment_id`
-- é UNIQUE para o webhook ser idempotente (o Mercado Pago reentrega a
-- notificação) — sem ele, cada reentrega somaria mais 24h de graça.
CREATE TABLE IF NOT EXISTS store_day_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  unlocked_until TIMESTAMPTZ NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 149,
  source TEXT NOT NULL DEFAULT 'pix',
  mp_payment_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_day_passes_store
  ON store_day_passes (restaurant_id, unlocked_until);

ALTER TABLE store_day_passes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "owner_read_day_passes" ON store_day_passes FOR SELECT
    TO authenticated USING (is_restaurant_owner(restaurant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON TABLE store_day_passes TO authenticated;
GRANT ALL ON TABLE store_day_passes TO service_role;

-- O anon não tem policy nenhuma aqui: RLS já barra, o REVOKE é defesa em
-- profundidade (não depender só do RLS).
REVOKE ALL ON TABLE store_day_passes FROM anon;

-- ------------------------------------------------------------
-- 2. store_is_unlocked — o predicado único de "loja liberada agora?"
-- ------------------------------------------------------------
-- Anual ativo OU diária em vigor. É a única regra de acesso; as RPCs de
-- leitura do pedido passam a chamá-la em vez de repetir a checagem.
CREATE OR REPLACE FUNCTION public.store_is_unlocked(p_store UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM admin_trials a
      WHERE a.store_id::text = p_store::text
        AND COALESCE(a.is_premium, false)
        AND a.premium_expires_at IS NOT NULL
        AND a.premium_expires_at > now()
    )
    OR EXISTS (
      SELECT 1 FROM store_day_passes d
      WHERE d.restaurant_id = p_store
        AND d.unlocked_until > now()
    );
$$;
GRANT EXECUTE ON FUNCTION public.store_is_unlocked(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 3. grant_day_pass — concede 24h × quantidade (só o webhook/service role)
-- ------------------------------------------------------------
-- Idempotente por mp_payment_id: uma reentrega do webhook não soma horas de
-- novo. Devolve o `unlocked_until` resultante para o log do webhook.
--
-- Empilha: se a loja já tem uma diária em vigor, o novo período começa no fim
-- da atual (comprar 2 diárias com 5h restantes libera 5h + 48h). Sem isso, uma
-- segunda compra durante o período ativo desperdiçaria o tempo restante.
-- Sem EXECUTE para anon/authenticated: o cliente não se dá diária.
DROP FUNCTION IF EXISTS public.grant_day_pass(UUID, TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.grant_day_pass(
  p_store UUID,
  p_mp_payment_id TEXT DEFAULT NULL,
  p_amount_cents INTEGER DEFAULT 149,
  p_source TEXT DEFAULT 'pix',
  p_quantity INTEGER DEFAULT 1
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_until TIMESTAMPTZ;
  v_qty INTEGER := GREATEST(1, LEAST(COALESCE(p_quantity, 1), 60));
  v_base TIMESTAMPTZ;
BEGIN
  IF p_store IS NULL THEN
    RAISE EXCEPTION 'store obrigatória';
  END IF;

  -- Mesmo pagamento já aplicado: devolve a janela existente, sem estender.
  IF p_mp_payment_id IS NOT NULL THEN
    SELECT d.unlocked_until INTO v_until
    FROM store_day_passes d
    WHERE d.mp_payment_id = p_mp_payment_id;
    IF v_until IS NOT NULL THEN
      RETURN v_until;
    END IF;
  END IF;

  -- Ponto de partida: o fim da diária atual, se ainda em vigor; senão agora.
  SELECT MAX(d.unlocked_until) INTO v_base
  FROM store_day_passes d
  WHERE d.restaurant_id = p_store AND d.unlocked_until > now();
  v_base := GREATEST(COALESCE(v_base, now()), now());

  INSERT INTO store_day_passes (restaurant_id, unlocked_until, amount_cents, source, mp_payment_id)
  VALUES (
    p_store,
    v_base + (interval '24 hours' * v_qty),
    COALESCE(p_amount_cents, 149),
    COALESCE(p_source, 'pix'),
    p_mp_payment_id
  )
  RETURNING unlocked_until INTO v_until;

  RETURN v_until;
END;
$$;

-- Só a service role (webhook/sync) concede. O dono não executa.
REVOKE ALL ON FUNCTION public.grant_day_pass(UUID, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_day_pass(UUID, TEXT, INTEGER, TEXT, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 4. get_order_for_owner — mesma regra, com a diária no lugar do Premium
-- ------------------------------------------------------------
-- Bloqueio = NÃO (anual ativo OU diária em vigor) E cota do mês estourada.
-- A cota segue derivada de `orders` (5 + bônus), à prova de adulteração.
CREATE OR REPLACE FUNCTION public.get_order_for_owner(p_oid UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store_id UUID;
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
    RETURN NULL; -- pedido inexistente ou não pertence ao dono
  END IF;

  IF NOT store_is_unlocked(v_store_id) THEN
    SELECT count(*) INTO v_count
    FROM orders o
    WHERE o.restaurant_id = v_store_id
      AND o.status <> 'cancelled'
      AND o.created_at >= date_trunc('month', CURRENT_DATE);

    SELECT COALESCE(SUM(amount), 0) INTO v_bonus
    FROM store_bonus_orders
    WHERE restaurant_id = v_store_id
      AND period_month = date_trunc('month', CURRENT_DATE)::date;

    IF COALESCE(v_count, 0) >= (5 + COALESCE(v_bonus, 0)) THEN
      v_blocked := true;
    END IF;
  END IF;

  -- Bloqueado devolve só o sinal: nada do pedido (nem itens) vaza para o dono
  -- enquanto ele não assinar ou liberar o dia.
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

GRANT EXECUTE ON FUNCTION public.get_order_for_owner(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 5. owner_locked_stores — lojas bloqueadas agora (para o painel)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owner_locked_stores()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id
  FROM restaurants r
  WHERE is_restaurant_owner(r.id)
    AND NOT store_is_unlocked(r.id)
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

GRANT EXECUTE ON FUNCTION public.owner_locked_stores() TO authenticated;

-- ------------------------------------------------------------
-- 6. store_access_state — estado do acesso para a UI
-- ------------------------------------------------------------
-- Devolve o que a tela precisa para o selo e o cronômetro regressivo:
--   source = 'annual'  → Premium ativo (mostra a data de vencimento)
--   source = 'day'     → diária em vigor (mostra o cronômetro de 24h)
--   source = 'free'    → sem acesso pago (mostra a cota do mês)
-- `unlocked_until` é o instante exato do fim da diária (ISO), usado no
-- contador HH:MM:SS do frontend.
CREATE OR REPLACE FUNCTION public.store_access_state(p_store UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_annual TIMESTAMPTZ;
  v_day TIMESTAMPTZ;
  v_used INTEGER;
  v_bonus INTEGER;
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

  -- Maior unlocked_until ainda em vigor (o cronômetro usa o mais distante).
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

  v_limit := 5 + COALESCE(v_bonus, 0);

  RETURN jsonb_build_object(
    'unlocked', (v_annual IS NOT NULL OR v_day IS NOT NULL),
    'source', CASE WHEN v_annual IS NOT NULL THEN 'annual'
                   WHEN v_day IS NOT NULL THEN 'day'
                   ELSE 'free' END,
    'annual_expires_at', v_annual,
    'unlocked_until', v_day,
    'quota_used', COALESCE(v_used, 0),
    'quota_limit', v_limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_access_state(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 7. Conferência (opcional)
-- ------------------------------------------------------------
-- SELECT public.store_access_state('<store-uuid>');
-- SELECT * FROM public.store_day_passes ORDER BY created_at DESC LIMIT 5;
