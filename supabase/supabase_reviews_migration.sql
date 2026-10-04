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
-- Valida (SECURITY DEFINER, pois o cliente não enxerga `orders` por RLS) que
-- o pedido avaliado pertence ao restaurante avaliado. Sem isso, qualquer
-- visitante podia colar uma avaliação em pedido de outra loja.
CREATE OR REPLACE FUNCTION public.order_belongs_to_restaurant(p_order UUID, p_store UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders o WHERE o.id = p_order AND o.restaurant_id = p_store
  );
$$;
GRANT EXECUTE ON FUNCTION public.order_belongs_to_restaurant(UUID, UUID) TO anon, authenticated;

DO $$ BEGIN
  CREATE POLICY "public_insert_reviews" ON reviews FOR INSERT TO anon, authenticated
    WITH CHECK (
      rating BETWEEN 1 AND 5
      AND (order_id IS NULL OR public.order_belongs_to_restaurant(order_id, restaurant_id))
    );
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