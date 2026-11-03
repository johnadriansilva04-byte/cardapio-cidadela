-- Manutenção do banco: devolve o espaço morto (bloat) sem tocar nos dados.
--
-- Por que existe: cada `ALTER TABLE ... ADD COLUMN` e cada `CREATE INDEX`
-- reescreve a tabela no Postgres e deixa a versão antiga como espaço morto.
-- As migrações deste repo rodam o `schema.sql` inteiro de novo, então o bloat
-- se acumula. Medido em 2026-11-03: `orders` tinha 24 kB de dados e um índice
-- de 13 MB; o banco marcava 140 MB com 10 pedidos. Depois do VACUUM FULL,
-- 16 MB.
--
-- Quando rodar: no SQL Editor do Supabase, quando o tamanho do banco no painel
-- não bater com o volume de pedidos. Não há perda de dado — o VACUUM FULL
-- reescreve a tabela compactada e devolve o espaço ao sistema.
--
-- Rode uma instrução por vez se o SQL Editor reclamar de múltiplos comandos.

VACUUM FULL orders;
VACUUM FULL order_items;
VACUUM FULL order_status_history;
VACUUM FULL products;
VACUUM FULL store_leads;
VACUUM FULL store_daily_stats;

-- Depois de rodar, confira:
--   select pg_size_pretty(pg_database_size(current_database()));
