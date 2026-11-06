-- Manutenção automática do banco: compacta o bloat que a retenção cria.
--
-- Por que existe: `cleanup_old_data` (supabase_retention.sql) roda um DELETE
-- diário nos pedidos com mais de 30 dias. No Postgres, DELETE não devolve o
-- espaço ao sistema — ele só marca as linhas como reutilizáveis. Sem uma
-- compactação periódica, o banco cresce sozinho todo dia e chega nos 500 MB do
-- plano free muito antes do volume real de pedidos justificar.
--
-- Medido em 2026-11-03: o banco marcava 140 MB com 10 pedidos. `orders` tinha
-- 24 kB de dados e um índice de 13 MB. Depois de um VACUUM FULL, 16 MB.
--
-- Solução: um job semanal por tabela que roda VACUUM (não FULL).
--   * VACUUM normal devolve espaço ao Postgres para reuso e mantém o tamanho
--     estável — é o suficiente aqui, e não trava a tabela.
--   * VACUUM FULL devolve espaço ao disco, mas trava a tabela; fica para
--     manutenção manual pontual (supabase/maintenance.sql), não para o cron.
--   * Um job POR TABELA, não um com vários comandos: o pg_cron envolve o
--     comando numa transação e "VACUUM cannot run inside a transaction block".
--     Com um comando só, o pg_cron roda o VACUUM direto e ele passa.
--
-- Idempotente: pode rodar de novo sem erro.

-- Remove as versões anteriores, se existirem (cron.schedule não sobrescreve).
DO $$
DECLARE
  j text;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'cidadela-maintenance', 'cidadela-vacuum-orders',
    'cidadela-vacuum-items', 'cidadela-vacuum-history'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;
END $$;

-- Domingo 04:00 UTC (01:00 em Brasília) — depois da limpeza diária das 03:00,
-- então o VACUUM enxerga o lixo do dia já removido.
SELECT cron.schedule('cidadela-vacuum-orders',  '0 4 * * 0', $$VACUUM (ANALYZE) orders$$);
SELECT cron.schedule('cidadela-vacuum-items',   '5 4 * * 0', $$VACUUM (ANALYZE) order_items$$);
SELECT cron.schedule('cidadela-vacuum-history', '10 4 * * 0', $$VACUUM (ANALYZE) order_status_history$$);

-- Conferência depois de aplicar:
--   select jobname, schedule, active from cron.job where jobname like 'cidadela-vacuum-%';
--   select pg_size_pretty(pg_database_size(current_database()));
