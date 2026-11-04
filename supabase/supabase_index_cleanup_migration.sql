-- ============================================================
-- MATA-FOME 3: índices redundantes (menos escrita, mesma leitura)
-- ============================================================
-- Objetivo: manter as leituras quentes cobertas e parar de pagar escrita por
-- índice que não serve a nenhuma consulta. Um índice de coluna única cujo
-- prefixo já está num índice composto não é usado pelo planejador (o composto
-- atende o `WHERE restaurant_id = ?` pela primeira coluna) — ele só custa
-- INSERT/UPDATE/DELETE e espaço.
--
-- Idempotente (DROP INDEX IF EXISTS). Rodar uma vez no SQL Editor.
--
-- Os compostos que COBREM cada um destes já existem em
-- `supabase_perf_indexes_migration.sql` / `supabase_retention.sql`; não os
-- remova ou a leitura volta a ordenar em memória.
-- ============================================================

-- Duplicata EXATA de idx_orders_restaurant_created (mesmas colunas e ordem).
DROP INDEX IF EXISTS public.idx_orders_store_created;

-- Prefixos cobertos por índices compostos (leading column = mesma coluna).
DROP INDEX IF EXISTS public.idx_orders_restaurant;        -- coberto por idx_orders_restaurant_created
DROP INDEX IF EXISTS public.idx_categories_restaurant;    -- coberto por idx_categories_restaurant_sort
DROP INDEX IF EXISTS public.idx_products_restaurant;      -- coberto por idx_products_restaurant_sort
DROP INDEX IF EXISTS public.idx_orders_guest;             -- coberto por idx_orders_guest_created

-- ------------------------------------------------------------
-- Conferência (opcional)
-- ------------------------------------------------------------
-- SELECT indexrelname, idx_scan FROM pg_stat_user_indexes
--   WHERE schemaname = 'public' ORDER BY relname, indexrelname;
