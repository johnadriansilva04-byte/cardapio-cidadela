-- ============================================================
-- MATA-FOME: retenção de dados e autolimpeza
-- ============================================================
-- Filosofia: o sistema NÃO é um ERP. Guardamos só o que sustenta a operação
-- (estabelecimento, cardápio, contador de cota). Pedido antigo e dado de
-- cliente final são descartáveis: ficam 30 dias para o lojista fechar o dia e
-- acompanhar a entrega, depois somem.
--
-- Como rodar: cole TUDO isto no SQL Editor do Supabase e execute uma vez.
-- É idempotente (usa IF NOT EXISTS / CREATE OR REPLACE), pode rodar de novo.
--
-- Free tier: o pg_cron é habilitado por padrão no Supabase. A retenção roda
-- 1x por dia, é uma operação curta e indexada, então cabe no plano grátis.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bucket de imagens: cache agressivo + teto de tamanho
-- ------------------------------------------------------------
-- 1 ano de cache (as URLs de imagem são imutáveis: o nome carrega timestamp).
-- Teto de 5 MB por arquivo; o frontend já comprime para poucos KB antes.
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-images', 'restaurant-images', true)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ------------------------------------------------------------
-- 2. Índices mínimos que faltavam (queries ultra-leves)
-- ------------------------------------------------------------
-- A busca do cardápio por slug e a ordenação do menu já têm índice; estes
-- cobrem os filtros que a limpeza e o tracking usam.
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
  ON orders (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_guest_created
  ON orders (guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_available
  ON products (restaurant_id, available);

-- ------------------------------------------------------------
-- 3. Procedure de limpeza
-- ------------------------------------------------------------
-- Apaga pedidos/linhas/itens antigos (cascata) e os resíduos não essenciais
-- (conversa do bot, partidas de jogo). O contador de cota em `admin_trials`
-- NUNCA é tocado — ele é a única memória que precisa sobreviver.
CREATE OR REPLACE FUNCTION public.cleanup_old_data(retention_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - make_interval(days => retention_days);
  orders_deleted integer := 0;
  messages_deleted integer := 0;
  sessions_deleted integer := 0;
BEGIN
  IF retention_days IS NULL OR retention_days < 1 THEN
    RAISE EXCEPTION 'retention_days deve ser >= 1';
  END IF;

  -- Pedidos antigos. order_items e order_status_history caem por CASCADE.
  DELETE FROM orders WHERE created_at < cutoff;
  GET DIAGNOSTICS orders_deleted = ROW_COUNT;

  -- Resíduos não essenciais: conversa do bot e partidas de jogo encerradas.
  DELETE FROM chat_messages WHERE timestamp < cutoff;
  GET DIAGNOSTICS messages_deleted = ROW_COUNT;

  DELETE FROM game_sessions
   WHERE completed_at IS NOT NULL AND completed_at < cutoff;
  DELETE FROM game_sessions
   WHERE status IN ('waiting', 'abandoned') AND created_at < cutoff;
  GET DIAGNOSTICS sessions_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ran_at', now(),
    'cutoff', cutoff,
    'orders_deleted', orders_deleted,
    'chat_messages_deleted', messages_deleted,
    'game_sessions_deleted', sessions_deleted
  );
END;
$$;

-- ------------------------------------------------------------
-- 4. Agendamento (pg_cron)
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 03:00 UTC (~00:00 BRT) — fora do horário de pico do restaurante.
SELECT cron.unschedule('mata-fome-cleanup')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mata-fome-cleanup');

SELECT cron.schedule(
  'mata-fome-cleanup',
  '0 3 * * *',
  $$SELECT public.cleanup_old_data(30)$$
);

-- ------------------------------------------------------------
-- 5. Reset do contador de cota (reforço no banco)
-- ------------------------------------------------------------
-- O app já zera no primeiro pedido de cada mês; este cron garante a virada
-- mesmo para restaurante que não recebeu pedido. NÃO apaga a linha.
CREATE OR REPLACE FUNCTION public.reset_monthly_order_counts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  UPDATE admin_trials
     SET monthly_order_count = 0,
         monthly_order_reset_date = CURRENT_DATE
   WHERE monthly_order_reset_date IS NULL
      OR date_trunc('month', monthly_order_reset_date)
         <> date_trunc('month', CURRENT_DATE);
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;

SELECT cron.unschedule('mata-fome-reset-monthly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mata-fome-reset-monthly');

SELECT cron.schedule(
  'mata-fome-reset-monthly',
  '5 3 * * *',
  $$SELECT public.reset_monthly_order_counts()$$
);

-- ------------------------------------------------------------
-- 6. Conferência (opcional)
-- ------------------------------------------------------------
-- SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- SELECT public.cleanup_old_data(30);  -- roda a limpeza na hora, se quiser ver
