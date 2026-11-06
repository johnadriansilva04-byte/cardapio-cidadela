-- ============================================================
-- Endurece a view pública `order_tracking`.
--
-- A view foi criada sem `security_invoker`, então rodava com as permissões do
-- dono (`postgres`) e ignorava o RLS de `orders` por completo. Com o grant
-- default do Supabase para `anon` (ALL), um visitante sem login conseguia:
--   - SELECT: listar TODOS os pedidos (comanda, cliente, total, itens);
--   - UPDATE/DELETE: alterar ou apagar qualquer pedido (a view é
--     auto-updatable, e o grant default dá escrita).
-- Confirmado em produção: `set role anon; select count(*) from order_tracking`
-- devolvia 9 (todos os pedidos) enquanto `orders` devolvia 0.
--
-- Correção: `security_invoker = true` (a view passa a respeitar o RLS de quem
-- consulta) + revogar o acesso do `anon`. A leitura pública de um pedido
-- específico continua na RPC `get_order_tracking` (SECURITY DEFINER, recebe o
-- id e devolve só as colunas públicas) — é ela que a página /pedido/<id> usa.
--
-- Idempotente: pode rodar de novo sem efeito colateral.
-- ============================================================

ALTER VIEW public.order_tracking SET (security_invoker = true);

REVOKE ALL ON public.order_tracking FROM anon;
GRANT SELECT ON public.order_tracking TO authenticated;
