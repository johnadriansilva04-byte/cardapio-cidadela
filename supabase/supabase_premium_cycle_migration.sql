-- ============================================================
-- CICLO DO PREMIUM (mensal × anual) + pacotes de assinatura
-- ============================================================
-- Idempotente. Aplicar em bancos que já rodaram o schema.sql sem esta parte
-- (a coluna e o guard também estão no schema.sql).
--
-- Por que existe: o pacote ANUAL libera um recurso que custa IA por uso — a
-- leitura do cardápio por FOTO. O mensal NÃO libera. Para o servidor decidir,
-- precisa saber qual ciclo está vigente; até aqui só havia `is_premium` +
-- vencimento, sem distinguir os dois pacotes pagos.
--
-- A coluna é somente leitura para o dono (guard abaixo). Se ele pudesse gravá-la,
-- bastava um PATCH premium_cycle='annual' para ganhar o recurso pago.

-- 1. Coluna do ciclo vigente
ALTER TABLE admin_trials ADD COLUMN IF NOT EXISTS premium_cycle VARCHAR(10);

-- 2. Guard: o dono não escreve premium_cycle (só o webhook/sync, service role).
CREATE OR REPLACE FUNCTION public.guard_admin_trials_premium()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  is_privileged BOOLEAN := current_user IN ('service_role', 'postgres', 'supabase_admin');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT is_privileged THEN
      IF COALESCE(NEW.is_premium, false) THEN
        RAISE EXCEPTION 'is_premium só pode ser definido pelo webhook do Mercado Pago';
      END IF;
      IF NEW.premium_expires_at IS NOT NULL THEN
        RAISE EXCEPTION 'premium_expires_at só pode ser definido pelo webhook do Mercado Pago';
      END IF;
      IF NEW.premium_cycle IS NOT NULL THEN
        RAISE EXCEPTION 'premium_cycle só pode ser definido pelo webhook do Mercado Pago';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT is_privileged THEN
    IF COALESCE(NEW.is_premium, false) AND NOT COALESCE(OLD.is_premium, false) THEN
      RAISE EXCEPTION 'is_premium só pode ser ativado pelo webhook do Mercado Pago';
    END IF;
    IF NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at
       AND NEW.premium_expires_at IS NOT NULL THEN
      RAISE EXCEPTION 'premium_expires_at é somente leitura para o cliente';
    END IF;
    IF NEW.mercadopago_preapproval_id IS DISTINCT FROM OLD.mercadopago_preapproval_id
       AND NEW.mercadopago_preapproval_id IS NOT NULL THEN
      RAISE EXCEPTION 'mercadopago_preapproval_id é somente leitura para o cliente';
    END IF;
    IF NEW.premium_cycle IS DISTINCT FROM OLD.premium_cycle
       AND NEW.premium_cycle IS NOT NULL THEN
      RAISE EXCEPTION 'premium_cycle é somente leitura para o cliente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_admin_trials_premium ON admin_trials;
CREATE TRIGGER trg_guard_admin_trials_premium
  BEFORE INSERT OR UPDATE ON admin_trials
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_trials_premium();

-- 3. store_access_state devolve o ciclo vigente (a UI usa para liberar a foto).
-- JSONB: CREATE OR REPLACE basta, sem DROP.
CREATE OR REPLACE FUNCTION public.store_access_state(p_store UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_annual TIMESTAMPTZ;
  v_cycle VARCHAR(10);
  v_day TIMESTAMPTZ;
  v_used INTEGER;
  v_bonus INTEGER;
  v_credits INTEGER;
  v_limit INTEGER;
  v_day_month INTEGER;
BEGIN
  IF NOT is_restaurant_owner(p_store) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT a.premium_expires_at, a.premium_cycle INTO v_annual, v_cycle
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

  SELECT count(*) INTO v_day_month
  FROM store_day_passes d
  WHERE d.restaurant_id = p_store
    AND d.source <> 'credit'
    AND d.created_at >= date_trunc('month', CURRENT_DATE);

  v_credits := public.owner_day_pass_credits(p_store);
  v_limit := 5 + COALESCE(v_bonus, 0);

  RETURN jsonb_build_object(
    'unlocked', (v_annual IS NOT NULL OR v_day IS NOT NULL),
    'source', CASE WHEN v_annual IS NOT NULL THEN 'annual'
                   WHEN v_day IS NOT NULL THEN 'day'
                   ELSE 'free' END,
    'annual_expires_at', v_annual,
    'premium_cycle', v_cycle,
    'unlocked_until', v_day,
    'quota_used', COALESCE(v_used, 0),
    'quota_limit', v_limit,
    'day_pass_credits', v_credits,
    'day_pass_month_used', COALESCE(v_day_month, 0),
    'day_pass_month_limit', 15
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.store_access_state(UUID) TO authenticated;

-- 4. Conferência (opcional)
-- SELECT public.store_access_state('<store-uuid>');
-- SELECT store_id, premium_cycle, premium_expires_at FROM admin_trials WHERE is_premium;
