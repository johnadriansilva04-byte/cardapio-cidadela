-- ============================================================
-- MATA-FOME: exclusão automática de contas inativas (30 dias)
-- ============================================================
-- Regra: uma conta que passa 30 dias SEM NENHUMA atividade é removida por
-- completo — restaurantes, cardápio, pedidos e o próprio usuário do auth.
--
-- O que conta como "atividade" (basta UMA para a conta continuar viva):
--   1. `profiles.last_seen_at`  → o dono abriu o painel (batimento do app)
--   2. pedido recebido          → `orders.created_at`
--   3. loja online              → `store_usage.day` (tempo online da loja)
--
-- É deliberadamente conservador: se QUALQUER um desses sinais for recente, a
-- conta fica. Um dono que não abre o painel há um mês mas continua recebendo
-- pedido NÃO é apagado.
--
-- Nunca apaga: conta com Premium vigente (`premium_expires_at > now()`). Quem
-- pagou não perde a conta por inatividade.
--
-- Como rodar: cole TUDO isto no SQL Editor do Supabase e execute uma vez.
-- É idempotente (IF NOT EXISTS / CREATE OR REPLACE), pode rodar de novo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Sinal de presença no app
-- ------------------------------------------------------------
-- Gravado pelo cliente a cada abertura do painel (RPC `touch_last_seen`).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON profiles (last_seen_at DESC NULLS LAST);

-- Batimento do dono: só escreve a própria linha (auth.uid()).
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid uuid := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RETURN;
  END IF;
  UPDATE profiles SET last_seen_at = now() WHERE id = current_uid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- ------------------------------------------------------------
-- 2. Status para a tela de Configurações
-- ------------------------------------------------------------
-- A tela lê isto para avisar o dono: "sua conta está ativa" / "será removida
-- em N dias". Devolve também a última atividade conhecida (a mais recente
-- entre os três sinais), para o dono se localizar.
CREATE OR REPLACE FUNCTION public.account_purge_status(p_retention_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid uuid := auth.uid();
  last_seen timestamptz;
  last_order timestamptz;
  last_usage timestamptz;
  last_activity timestamptz;
  days_left integer;
BEGIN
  IF current_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT last_seen_at INTO last_seen FROM profiles WHERE id = current_uid;

  SELECT max(o.created_at) INTO last_order
    FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
   WHERE r.owner_id = current_uid::text;

  SELECT max(u.day)::timestamptz INTO last_usage
    FROM store_usage u
    JOIN restaurants r ON r.id = u.restaurant_id
   WHERE r.owner_id = current_uid::text;

  last_activity := greatest(
    coalesce(last_seen, 'epoch'::timestamptz),
    coalesce(last_order, 'epoch'::timestamptz),
    coalesce(last_usage, 'epoch'::timestamptz)
  );

  IF last_activity <= 'epoch'::timestamptz THEN
    -- Conta nova, nunca usada: o relógio começa do cadastro do perfil.
    SELECT created_at INTO last_activity FROM profiles WHERE id = current_uid;
    IF last_activity IS NULL THEN
      last_activity := now();
    END IF;
  END IF;

  days_left := p_retention_days - floor(extract(epoch FROM now() - last_activity) / 86400)::int;

  RETURN jsonb_build_object(
    'ok', true,
    'retention_days', p_retention_days,
    'last_activity', last_activity,
    'days_left', greatest(0, days_left)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.account_purge_status(integer) TO authenticated;

-- ------------------------------------------------------------
-- 3. A limpeza (roda no pg_cron, como postgres)
-- ------------------------------------------------------------
-- SECURITY DEFINER: apaga dados de qualquer dono. Só o cron (postgres) chama —
-- o cliente não tem EXECUTE.
CREATE OR REPLACE FUNCTION public.purge_inactive_accounts(
  p_retention_days integer DEFAULT 30,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - make_interval(days => p_retention_days);
  victim RECORD;
  purged integer := 0;
  kept_premium integer := 0;
  slugs text[] := ARRAY[]::text[];
BEGIN
  IF p_retention_days IS NULL OR p_retention_days < 1 THEN
    RAISE EXCEPTION 'p_retention_days deve ser >= 1';
  END IF;

  FOR victim IN
    SELECT p.id,
           p.created_at,
           coalesce(
             greatest(
               coalesce(p.last_seen_at, 'epoch'::timestamptz),
               coalesce((SELECT max(o.created_at)
                           FROM orders o
                           JOIN restaurants r ON r.id = o.restaurant_id
                          WHERE r.owner_id = p.id::text), 'epoch'::timestamptz),
               coalesce((SELECT max(u.day)::timestamptz
                           FROM store_usage u
                           JOIN restaurants r ON r.id = u.restaurant_id
                          WHERE r.owner_id = p.id::text), 'epoch'::timestamptz)
             ),
             p.created_at
           ) AS last_activity,
           (SELECT bool_or(t.is_premium AND t.premium_expires_at > now())
              FROM admin_trials t
              -- `admin_trials.store_id` é varchar (legado); sem o cast a
              -- comparação com `restaurants.id` (uuid) estoura e o job falha.
              JOIN restaurants r ON r.id = t.store_id::uuid
             WHERE r.owner_id = p.id::text) AS has_active_premium
      FROM profiles p
  LOOP
    CONTINUE WHEN victim.last_activity >= cutoff;

    -- Quem paga não é apagado por inatividade.
    IF victim.has_active_premium THEN
      kept_premium := kept_premium + 1;
      CONTINUE;
    END IF;

    IF p_dry_run THEN
      purged := purged + 1;
      slugs := slugs || victim.id::text;
      CONTINUE;
    END IF;

    -- Mesma ordem do `delete_own_account`: restaurantes (cascata em cardápio,
    -- pedidos e histórico) → perfil → usuário do auth.
    DELETE FROM cidadela_unlocks
     WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = victim.id::text);
    DELETE FROM restaurants WHERE owner_id = victim.id::text;
    DELETE FROM profiles WHERE id = victim.id;
    DELETE FROM auth.users WHERE id = victim.id;

    purged := purged + 1;
    slugs := slugs || victim.id::text;
  END LOOP;

  RETURN jsonb_build_object(
    'ran_at', now(),
    'cutoff', cutoff,
    'dry_run', p_dry_run,
    'accounts_purged', purged,
    'kept_for_premium', kept_premium,
    'account_ids', slugs
  );
END;
$$;

-- Só o cron/postgres executa a limpeza — o cliente não tem EXECUTE.
REVOKE ALL ON FUNCTION public.purge_inactive_accounts(integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_inactive_accounts(integer, boolean) FROM anon, authenticated;

-- ------------------------------------------------------------
-- 4. Agendamento (pg_cron)
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 04:00 UTC (~01:00 BRT) — depois da retenção de pedidos (03:00).
SELECT cron.unschedule('mata-fome-inactive-accounts')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mata-fome-inactive-accounts');

SELECT cron.schedule(
  'mata-fome-inactive-accounts',
  '0 4 * * *',
  $$SELECT public.purge_inactive_accounts(30, false)$$
);

-- ------------------------------------------------------------
-- 5. Conferência (opcional)
-- ------------------------------------------------------------
-- Quem seria apagado hoje, SEM apagar nada:
--   SELECT public.purge_inactive_accounts(30, true);
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'mata-fome%';
