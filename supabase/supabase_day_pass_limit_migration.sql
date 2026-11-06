-- Limite mensal de diárias por loja.
--
-- A diária (R$ 1,99 / 24h) é isca de conversão, não sustento: 15 diárias
-- custam R$ 29,85, mais que o Premium mensal (R$ 28,99). O limite existe para
-- o cliente perceber isso sozinho, em vez de pagar diária para sempre.
--
-- O LIMITE É APLICADO NA CRIAÇÃO DO LINK (src/routes/api.payment.day-pass.ts),
-- não na concessão. Bloquear em `grant_day_pass` seria bloquear DEPOIS do
-- Mercado Pago já ter aprovado o pagamento — o cliente pagaria e não receberia.
-- Aqui só EXPOMOS o uso do mês; a decisão de recusar a compra é da rota.
--
-- `store_access_state` devolve JSONB, então CREATE OR REPLACE basta (não muda
-- a lista de colunas como um RETURNS TABLE mudaria).
--
-- Idempotente.

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
  v_day_month INTEGER;
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

  -- Diárias COMPRADAS neste mês. `source = 'credit'` são as ganhas por
  -- recompensa (resgate) — não contam contra o teto, porque não foram pagas.
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
