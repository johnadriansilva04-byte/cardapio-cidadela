-- Garçom digital (Pracinha monta o pedido do cliente) é recurso Premium.
--
-- O gate REAL é no servidor: `POST /api/order/draft` checa `isStorePremium` e
-- devolve 403 para loja sem Premium. Esta migração só adiciona o predicado
-- público que o cardápio usa para mostrar/esconder o botão "Pedir por texto"
-- (o cliente do cardápio é anônimo e não enxerga `admin_trials`, que é RLS do
-- dono).
--
-- `store_is_premium` devolve SÓ um booleano sobre a loja pedida — nenhum dado
-- do dono, do plano ou do pagamento. É o mínimo necessário para a UI decidir, e
-- não substitui o gate do servidor (que é quem barra de verdade).
--
-- Diferente de `store_is_unlocked`, aqui NÃO entra a diária: o garçom digital é
-- exclusivo do Premium (anual/mensal), de propósito — é o recurso que puxa a
-- conversão da diária para a assinatura.
--
-- Idempotente.

CREATE OR REPLACE FUNCTION public.store_is_premium(p_store UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_trials a
    WHERE a.store_id::text = p_store::text
      AND COALESCE(a.is_premium, false)
      AND a.premium_expires_at IS NOT NULL
      AND a.premium_expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.store_is_premium(UUID) TO anon, authenticated;
