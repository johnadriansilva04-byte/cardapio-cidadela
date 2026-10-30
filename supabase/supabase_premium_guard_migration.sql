-- Endurecimento do Premium (idempotente).
--
-- Fecha dois furos que permitiam Premium de graça:
--   1. `premium_expires_at` não era protegido: o dono podia dar um PATCH na
--      própria linha e empurrar o vencimento para 2099.
--   2. `premium_expires_at IS NULL` significava "sem prazo", então uma linha
--      com `is_premium = true` e data nula virava assinatura perpétua.
--
-- Também (re)cria o trigger que faltava: sem ele o dono ativava o Premium
-- sozinho via PostgREST. O dono continua podendo CANCELAR (desligar e limpar a
-- data); só a service role (webhook/sync do Mercado Pago) liga.
--
-- As duas RPCs passam a contar os pedidos REAIS do mês em vez de confiar em
-- `monthly_order_count`, que o dono também pode editar na própria linha.

-- 1. Guard: só a service role ativa o Premium ou escreve o vencimento.
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
    END IF;
    RETURN NEW;
  END IF;

  IF NOT is_privileged THEN
    -- O dono só pode DESLIGAR o Premium (botão cancelar); ligar é só o webhook.
    IF COALESCE(NEW.is_premium, false) AND NOT COALESCE(OLD.is_premium, false) THEN
      RAISE EXCEPTION 'is_premium só pode ser ativado pelo webhook do Mercado Pago';
    END IF;
    -- A data de vencimento é do servidor: só o cancelamento pode limpá-la.
    IF NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at
       AND NEW.premium_expires_at IS NOT NULL THEN
      RAISE EXCEPTION 'premium_expires_at é somente leitura para o cliente';
    END IF;
    IF NEW.mercadopago_preapproval_id IS DISTINCT FROM OLD.mercadopago_preapproval_id
       AND NEW.mercadopago_preapproval_id IS NOT NULL THEN
      RAISE EXCEPTION 'mercadopago_preapproval_id é somente leitura para o cliente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_admin_trials_premium ON admin_trials;
CREATE TRIGGER trg_guard_admin_trials_premium
  BEFORE INSERT OR UPDATE ON admin_trials
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_trials_premium();

-- 2. Detalhes do pedido para o dono. Premium válido = flag + data futura
--    (sem data não é Premium). A cota conta pedidos reais do mês.
CREATE OR REPLACE FUNCTION public.get_order_for_owner(p_oid UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store_id UUID;
  v_premium BOOLEAN;
  v_expires TIMESTAMPTZ;
  v_count INTEGER;
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

    IF COALESCE(v_count, 0) >= 5 THEN
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

GRANT EXECUTE ON FUNCTION public.get_order_for_owner(UUID) TO authenticated;

-- 3. IDs dos restaurantes do dono com a cota gratuita estourada.
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
    ) >= 5;
$$;

GRANT EXECUTE ON FUNCTION public.owner_locked_stores() TO authenticated;

-- 4. Contagem real do mês para o painel (mesma regra das RPCs acima).
CREATE OR REPLACE FUNCTION public.owner_monthly_order_count(p_store UUID)
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN is_restaurant_owner(p_store) THEN (
      SELECT count(*)::int
      FROM orders o
      WHERE o.restaurant_id = p_store
        AND o.status <> 'cancelled'
        AND o.created_at >= date_trunc('month', CURRENT_DATE)
    )
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_monthly_order_count(UUID) TO authenticated;
