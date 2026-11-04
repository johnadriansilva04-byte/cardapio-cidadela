-- ============================================================
-- LIMPEZA ÚNICA: lojas/contas de teste
-- ============================================================
-- Roda UMA vez, à mão, no SQL Editor do Supabase. Não é migração e não entra
-- no `apply-all.mjs` — é uma faxina pontual, não um comportamento do app.
--
-- Por que à mão: apagar loja de OUTRO dono exige privilégio que o cliente não
-- tem (RLS bloqueia; foi assim que a tentativa pela API devolveu 0 linhas). O
-- SQL Editor roda como `postgres` e passa por cima do RLS.
--
-- O que sai (4 lojas de teste e seus donos):
--   udit-enior · e2e-restaurante-teste · cidadela · restaurante-qa-teste
-- O que fica (3 lojas reais): dona-da-pensao, variant, variant-proteicc.
--
-- As FKs para `restaurants` são ON DELETE CASCADE, então apagar a loja já leva
-- categorias, produtos, adicionais, pedidos, itens e histórico.
-- ============================================================

-- PASSO 1 — PREVIEW: confira quem vai sair ANTES de apagar nada.
SELECT r.slug, r.name, r.owner_id, p.name AS owner_name, r.created_at
  FROM restaurants r
  LEFT JOIN profiles p ON p.id = r.owner_id
 WHERE r.slug IN ('udit-enior', 'e2e-restaurante-teste', 'cidadela', 'restaurante-qa-teste')
 ORDER BY r.created_at;

-- PASSO 2 — APAGAR: só depois de conferir o preview acima.
DO $$
DECLARE
  victim uuid;
  test_slugs text[] := ARRAY['udit-enior', 'e2e-restaurante-teste', 'cidadela', 'restaurante-qa-teste'];
BEGIN
  FOR victim IN
    SELECT DISTINCT owner_id FROM restaurants WHERE slug = ANY(test_slugs)
  LOOP
    -- Liberações de comanda não têm FK em cascata — apaga antes da loja.
    DELETE FROM cidadela_unlocks
     WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = victim);

    DELETE FROM restaurants
     WHERE owner_id = victim AND slug = ANY(test_slugs);

    -- Só remove a conta se o dono ficou sem NENHUMA loja (não derruba um dono
    -- que por acaso tenha uma loja real além da de teste).
    IF NOT EXISTS (SELECT 1 FROM restaurants WHERE owner_id = victim) THEN
      DELETE FROM profiles WHERE id = victim;
      DELETE FROM auth.users WHERE id = victim;
    END IF;
  END LOOP;
END $$;

-- PASSO 3 — CONFERÊNCIA: devem sobrar exatamente 3 lojas.
SELECT count(*) AS lojas_restantes FROM restaurants;
SELECT slug, name FROM restaurants ORDER BY created_at;
