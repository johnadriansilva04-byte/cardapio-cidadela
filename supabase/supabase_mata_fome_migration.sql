-- ============================================================
-- MATA FOME — movimento solidário opcional do dono
-- ============================================================
-- Idempotente. Aplicar em bancos que já rodaram o schema.sql sem esta parte
-- (as colunas também estão no schema.sql).
--
-- O que é: um movimento que a loja adere por opção. Ligado, o cardápio público
-- ganha uma faixa "Tá com pressa? Escolha seu MATA FOME" — o cliente escolhe
-- qualquer item do próprio cardápio para um belisque, ou para quem não tem
-- como pagar. Nada é padronizado: é o cardápio da casa, com um convite.
--
-- São colunas do dono (ele liga/desliga quando quiser), então não há guard:
-- o RLS de `restaurants` já restringe a escrita ao próprio dono.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS mata_fome_enabled BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS mata_fome_note TEXT DEFAULT '';

-- Conferência (opcional)
-- SELECT id, name, mata_fome_enabled, mata_fome_note FROM restaurants WHERE mata_fome_enabled;
