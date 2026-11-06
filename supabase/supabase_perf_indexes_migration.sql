-- ============================================================
-- MATA-FOME 2: índices de leitura quente + limpeza de Storage
-- ============================================================
-- Objetivo: sustentar mais clientes no plano gratuito do Supabase sem trocar
-- de plano. O gargalo real do free tier é EGRESS (5 GB de banco + 5 GB cache),
-- não o tamanho do banco — então o alvo aqui é (a) fazer cada consulta ler o
-- mínimo possível e (b) não reenviar foto que já foi baixada.
--
-- Como rodar: cole tudo no SQL Editor do Supabase e execute uma vez.
-- É idempotente (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Índices que faltavam nas leituras quentes
-- ------------------------------------------------------------
-- O painel agora busca os pedidos de TODAS as lojas numa consulta `.in()`
-- ordenada por data. Sem um índice composto (restaurant_id, created_at DESC),
-- o Postgres ordena em memória a cada poll de 15s do celular.
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
  ON orders (restaurant_id, created_at DESC);

-- A contagem de cota do plano conta os pedidos do mês por loja e status.
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
  ON orders (restaurant_id, status, created_at DESC);

-- O cardápio público lê categorias/produtos por loja e ordena por sort_order.
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_sort
  ON categories (restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_sort
  ON products (restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_addons_restaurant_sort
  ON product_addons (restaurant_id, sort_order);

-- O cardápio filtra produto disponível; cobre o caso (loja, disponível).
CREATE INDEX IF NOT EXISTS idx_products_restaurant_available
  ON products (restaurant_id, available);

-- A busca do cardápio por slug (a query mais executada do sistema).
-- Já existe idx_restaurants_slug; mantido aqui por clareza se o schema não veio.

-- ------------------------------------------------------------
-- 2. Limpeza de imagens órfãs no Storage
-- ------------------------------------------------------------
-- Toda troca de logo/banner/produto grava um arquivo novo com timestamp no
-- nome; o antigo fica no bucket para sempre e ocupa a cota de 1 GB. Esta função
-- remove objetos que não são referenciados por nenhuma coluna de imagem e têm
-- mais de `retention_days` dias (a janela evita apagar uma foto recém-enviada
-- cujo UPDATE da URL ainda não commitou).
--
-- O Supabase bloqueia DELETE direto em `storage.objects` (trigger
-- `protect_objects_delete`) e manda usar a Storage API. Isso é bom contra
-- acidente, mas o cron rodava e FALHAVA TODO DIA em silêncio — a limpeza nunca
-- aconteceu. A saída suportada é liberar o delete só nesta transação via
-- `storage.allow_delete_query`; o trigger respeita esse setting.
--
-- `strpos` (substring exata) em vez de LIKE: o nome do arquivo tem `_`, que no
-- LIKE é curinga e casaria coisas demais.
CREATE OR REPLACE FUNCTION public.cleanup_orphan_images(retention_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  deleted integer := 0;
  cutoff timestamptz := now() - make_interval(days => retention_days);
BEGIN
  -- Libera o DELETE em storage.objects apenas para esta transação.
  PERFORM set_config('storage.allow_delete_query', 'true', true);

  WITH orphans AS (
    SELECT o.name
      FROM storage.objects o
     WHERE o.bucket_id = 'restaurant-images'
       AND o.created_at < cutoff
       AND NOT EXISTS (
         SELECT 1 FROM restaurants r
          WHERE strpos(r.logo_url, o.name) > 0
             OR strpos(r.banner_url, o.name) > 0
       )
       AND NOT EXISTS (
         SELECT 1 FROM products p
          WHERE strpos(p.image_url, o.name) > 0
       )
  )
  DELETE FROM storage.objects o
   USING orphans
   WHERE o.bucket_id = 'restaurant-images'
     AND o.name = orphans.name;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ------------------------------------------------------------
-- 3. Agendamento (pg_cron) — só se a extensão já estiver ligada
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('mata-fome-images')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mata-fome-images');
    -- Dollar-tag próprio para a query do job: o dollar-quote aninhado no corpo
    -- do DO confunde o parser do Postgres, então o job usa $cron$ ... $cron$.
    PERFORM cron.schedule(
      'mata-fome-images',
      '20 3 * * *',
      $cron$SELECT public.cleanup_orphan_images(7)$cron$
    );
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 4. Conferência (opcional)
-- ------------------------------------------------------------
-- SELECT public.cleanup_orphan_images(7);  -- roda na hora, se quiser ver
-- SELECT pg_size_pretty(pg_database_size(current_database()));
-- SELECT COUNT(*), pg_size_pretty(SUM((metadata->>'size')::bigint))
--   FROM storage.objects WHERE bucket_id = 'restaurant-images';
