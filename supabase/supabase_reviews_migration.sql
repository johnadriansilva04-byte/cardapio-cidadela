-- ============================================================
-- AVALIAÇÕES (reviews) — sistema simples de nota + comentário
-- ============================================================
-- Migração opcional: o app funciona sem ela (a seção de avaliações
-- simplesmente não aparece). Rode este arquivo no SQL Editor do
-- Supabase para habilitar a funcionalidade.
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT 'Cliente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_created
  ON reviews(restaurant_id, created_at DESC);

-- Uma avaliação por pedido: o cliente pode reenviar o formulário e não
-- deve inflar a média com duplicatas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order_unique
  ON reviews(order_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Leitura pública: qualquer visitante do cardápio vê as notas.
DO $$ BEGIN
  CREATE POLICY "public_read_reviews" ON reviews FOR SELECT
    USING (restaurant_id IN (SELECT id FROM restaurants WHERE status = 'published'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Escrita pública: o pedido é anônimo, então o cliente que avaliou não tem
-- sessão. Ainda assim ele só pode inserir — não editar nem apagar.
DO $$ BEGIN
  CREATE POLICY "public_insert_reviews" ON reviews FOR INSERT TO anon, authenticated
    WITH CHECK (rating BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- O dono enxerga e gerencia as avaliações dos próprios restaurantes.
DO $$ BEGIN
  CREATE POLICY "owner_manage_reviews" ON reviews FOR ALL TO authenticated
    USING (is_restaurant_owner(restaurant_id))
    WITH CHECK (is_restaurant_owner(restaurant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON TABLE reviews TO anon, authenticated;