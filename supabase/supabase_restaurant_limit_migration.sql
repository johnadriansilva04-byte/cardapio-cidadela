-- ============================================================
-- LIMITE DE RESTAURANTES POR CONTA
-- ============================================================
-- Regra de negócio: a conta tem 1 restaurante no plano gratuito; criar mais é
-- benefício do Premium. O gate vive no BANCO (trigger na tabela `restaurants`),
-- não só na UI: a policy `owner_insert` só exige `owner_id = auth.uid()`, então
-- um INSERT direto via PostgREST criaria quantos restaurantes quisesse sem
-- passar pela tela. Um check só de cliente é contornável — o que vale é o que
-- está no servidor.
--
-- Premium = qualquer loja do dono com `admin_trials.is_premium` E
-- `premium_expires_at > now()` — a MESMA definição usada por
-- `get_order_for_owner`/`owner_locked_stores`. A diária de 24h NÃO libera
-- multi-loja de propósito (ela libera pedidos ilimitados, não várias lojas).
--
-- Idempotente: pode rodar mais de uma vez no SQL Editor.

-- True quando o dono tem QUALQUER loja com Premium vigente. SECURITY DEFINER
-- para ler `admin_trials` sem depender de RLS; recebe o owner por parâmetro
-- para funcionar também quando `auth.uid()` já é o dono (o dono pode ser outro
-- em contextos de service role).
CREATE OR REPLACE FUNCTION public.owner_has_premium_access(p_owner TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM restaurants r
    JOIN admin_trials a ON a.store_id::text = r.id::text
    WHERE r.owner_id = p_owner
      AND COALESCE(a.is_premium, false)
      AND a.premium_expires_at IS NOT NULL
      AND a.premium_expires_at > now()
  );
$$;

-- Bloqueia o INSERT do dono quando ele já tem 1 restaurante e não é Premium.
-- SECURITY INVOKER (padrão): a contagem roda com o RLS do próprio dono, que
-- enxerga as próprias linhas. Service role (webhook, migrações, import legado
-- server-side) passa direto.
CREATE OR REPLACE FUNCTION public.guard_restaurant_limit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  is_privileged BOOLEAN := current_user IN ('service_role', 'postgres', 'supabase_admin');
  existing_count INTEGER;
BEGIN
  IF is_privileged THEN
    RETURN NEW;
  END IF;

  IF owner_has_premium_access(NEW.owner_id) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO existing_count
  FROM restaurants
  WHERE owner_id = NEW.owner_id;

  IF existing_count >= 1 THEN
    RAISE EXCEPTION 'Plano gratuito permite 1 restaurante por conta. Assine o Premium para criar mais.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_restaurant_limit ON restaurants;
CREATE TRIGGER trg_guard_restaurant_limit
  BEFORE INSERT ON restaurants
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_limit();

-- Estado do limite para a UI: quantos restaurantes o dono tem e se é Premium.
-- SECURITY DEFINER + auth.uid() só revela os dados do próprio chamador.
CREATE OR REPLACE FUNCTION public.owner_restaurant_limit()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'premium', COALESCE(auth.uid() IS NOT NULL AND owner_has_premium_access(auth.uid()::text), false),
    'count', COALESCE((
      SELECT count(*) FROM restaurants r WHERE r.owner_id = auth.uid()::text
    ), 0)
  );
$$;

GRANT EXECUTE ON FUNCTION public.owner_restaurant_limit() TO authenticated;
