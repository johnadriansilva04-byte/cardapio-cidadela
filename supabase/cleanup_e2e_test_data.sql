-- ============================================================
-- LIMPEZA DOS DADOS DE TESTE E2E — MenuFácil (cardapio-cidadela)
-- Rode no Supabase SQL Editor (pode rodar quantas vezes quiser).
-- Escopo seguro: só remove restaurantes/pedidos que seguem os padrões de teste E2E.

-- Deleter o restaurante e2e também remove (via ON DELETE CASCADE):
--   categories, products, orders, order_items, order_status_history,
--   addon_groups, addons, cidadela_unlocks
-- NÃO remove: profiles / auth.users (a conta do dono permanece intacta.

-- ============================================================

-- 1) Pedidos de teste (por nome cliente, telefone ou comanda usado nos testes E2E):
DELETE FROM orders
WHERE customer_name IN ('cliente-e2e-api', 'Cliente E2E', 'Cliente Duplo')
   OR customer_phone IN ('11977776666', '11999999999', '11988887777')
   OR comanda LIKE 'E2E-%'
RETURNING id, comanda, customer_name;

-- 2) Restaurantes de teste (slug e2e-* ou nome/slug com e2e) — cascade limpa o restante:


DELETE FROM restaurants
  
WHERE slug LIKE 'e2e-%'
   OR slug ILIKE '%e2e%teste%'
   OR slug ILIKE '%teste-auditoria%'
   OR name ILIKE '%e2e%'
   OR name ILIKE '%auditoria%'
RETURNING id, slug, name;

-- 3) Verificação final — deve retornar 0 linhas em ambos:
SELECT (SELECT COUNT(*) FROM restaurants WHERE slug LIKE 'e2e-%' OR slug ILIKE '%e2e%teste%' OR slug ILIKE '%teste-auditoria%' OR name ILIKE '%e2e%' OR name ILIKE '%auditoria%') AS restaurantes_e2e_restantes,
       (SELECT COUNT(*) FROM orders WHERE customer_name LIKE '%e2e%' OR comanda LIKE 'E2E-%' OR customer_phone IN ('11977776666', '11999999999', '11988887777')) AS pedidos_e2e_restantes;