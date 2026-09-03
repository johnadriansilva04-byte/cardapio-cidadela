-- ============================================================
-- RODA ISSO NO SQL EDITOR DO SUPABASE
-- Substitua 'SEU_AUTH_USER_ID' pelo ID do usuário logado
-- pra saber o ID, rode: SELECT auth.uid();
-- ============================================================

-- 1. Criar restaurante vinculado ao seu usuário
INSERT INTO restaurants (owner_id, name, slug, description, status, primary_color, secondary_color)
SELECT
  auth.uid()::text,
  'Meu Restaurante',
  'meu-restaurante',
  'Cardápio digital',
  'published',
  '#06b6d4',
  '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM restaurants WHERE slug = 'meu-restaurante');

-- 2. Buscar o ID do restaurante
DO $$
DECLARE
  rest_id UUID;
  cat_lanches UUID;
  cat_bebidas UUID;
  cat_combos UUID;
BEGIN
  SELECT id INTO rest_id FROM restaurants WHERE slug = 'meu-restaurante';
  IF rest_id IS NULL THEN
    RAISE NOTICE 'Restaurante não encontrado';
    RETURN;
  END IF;

  -- Se já tem categorias, não duplica
  IF EXISTS (SELECT 1 FROM categories WHERE restaurant_id = rest_id LIMIT 1) THEN
    RAISE NOTICE 'Restaurante já tem cardápio';
    RETURN;
  END IF;

  -- Criar categorias
  INSERT INTO categories (restaurant_id, name, sort_order) VALUES
    (rest_id, 'Lanches', 0),
    (rest_id, 'Bebidas', 1),
    (rest_id, 'Combos', 2);

  SELECT id INTO cat_lanches FROM categories WHERE restaurant_id = rest_id AND name = 'Lanches';
  SELECT id INTO cat_bebidas FROM categories WHERE restaurant_id = rest_id AND name = 'Bebidas';
  SELECT id INTO cat_combos FROM categories WHERE restaurant_id = rest_id AND name = 'Combos';

  -- LANCHES
  INSERT INTO products (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (rest_id, cat_lanches, 'X-Burger', 'Pão, hambúrguer, queijo, alface e tomate', 18.90, 0),
    (rest_id, cat_lanches, 'X-Bacon', 'Pão, hambúrguer, queijo, bacon crocante', 21.90, 1),
    (rest_id, cat_lanches, 'X-Tudo', 'Hambúrguer duplo, queijo, bacon, ovo, presunto', 28.90, 2),
    (rest_id, cat_lanches, 'Frango Grelhado', 'Peito de frango grelhado com salada', 22.90, 3),
    (rest_id, cat_lanches, 'Hot Dog Especial', 'Salsicha, purê, milho, batata palha', 16.90, 4);

  -- BEBIDAS
  INSERT INTO products (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (rest_id, cat_bebidas, 'Coca-Cola Lata', '350ml gelada', 5.90, 0),
    (rest_id, cat_bebidas, 'Guaraná Lata', '350ml gelada', 5.90, 1),
    (rest_id, cat_bebidas, 'Água Mineral', '500ml sem gás', 3.90, 2),
    (rest_id, cat_bebidas, 'Suco Natural', 'Laranja ou limão 400ml', 7.90, 3),
    (rest_id, cat_bebidas, 'Cerveja Lata', 'Brahma ou Skol 350ml', 7.90, 4);

  -- COMBOS
  INSERT INTO products (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (rest_id, cat_combos, 'Combo Burger + Refri', 'X-Burger + Coca-Cola Lata por apenas', 22.90, 0),
    (rest_id, cat_combos, 'Combo Família', '2 X-Tudo + 2 Refris + Batata', 69.90, 1),
    (rest_id, cat_combos, 'Combo Fome Zero', 'X-Bacon + Batata + Refri', 32.90, 2);

  RAISE NOTICE 'Cardápio criado! Acesse: /restaurant/meu-restaurante';
END
$$;
