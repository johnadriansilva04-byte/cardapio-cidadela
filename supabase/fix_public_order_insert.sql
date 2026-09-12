-- ============================================================
-- FIX: permite clientes anônimos criarem pedidos (checkout público)
-- ------------------------------------------------------------
-- Problema: a Base de Dados de produção está sem as policies abaixo,
-- por isso o checkout público retorna 42501 (RLS violation) ao tentar
-- inserir em orders / order_items / order_status_history.
--
-- Executar UMA vez no SQL Editor do Supabase:
--   Dashboard → SQL Editor → New query → colar → Run
--
-- Idempotente: pode rodar quantas vezes quiser.
-- ============================================================

-- Policies de INSERT público
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert_orders" ON orders FOR INSERT TO anon, authenticated
  WITH CHECK (true);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert_order_items" ON order_items FOR INSERT TO anon, authenticated
  WITH CHECK (true);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert_order_status_history" ON order_status_history FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ============================================================
-- FIX 2: rastreio público do pedido (página /pedido/<id>)
-- ------------------------------------------------------------
-- A view order_tracking lê de orders, que tem RLS ativa. Sem essa
-- função SECURITY DEFINER, cliente anônimo recebe 0 linhas e a
-- página diz "Pedido não encontrado" mesmo com pedido criado.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_order_tracking(p_oid UUID)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  comanda TEXT,
  status TEXT,
  total NUMERIC,
  observations TEXT,
  created_at TIMESTAMPTZ,
  order_items JSON
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.restaurant_id,
    o.comanda,
    o.status,
    o.total,
    o.observations,
    o.created_at,
    COALESCE(
      (SELECT json_agg(row_to_json(oi)) FROM order_items oi WHERE oi.order_id = o.id),
      '[]'::json
    ) AS order_items
  FROM orders o
  WHERE o.id = p_oid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_tracking(UUID) TO anon, authenticated;

-- Validação (deve listar as policies e a function):
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN ('orders', 'order_items', 'order_status_history')
-- ORDER BY tablename, policyname;
-- SELECT proname FROM pg_proc WHERE proname = 'get_order_tracking';