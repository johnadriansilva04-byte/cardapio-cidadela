import type { DemoStoreMenu } from "@/modules/supabase/landing-demo";

/**
 * Snapshot da vitrine da landing.
 *
 * É só a PRIMEIRA PINTURA (evita tela vazia e flash enquanto o banco responde).
 * Em seguida `LiveStoreDemo` busca o cardápio REAL da loja da Variant e troca
 * tudo — mudar a foto, o preço ou um item no painel muda a home sozinho. Se o
 * banco falhar, este snapshot segura a página.
 */
export const DEMO_SNAPSHOT: DemoStoreMenu = {
  name: "Variant Proteic",
  logoUrl:
    "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/logo_1789410322493_v0yxrp.jpg",
  categories: [
    { id: "lanches", name: "Lanches" },
    { id: "bebidas", name: "Bebidas" },
    { id: "combos", name: "Combos" },
  ],
  items: [
    {
      id: "s-xburger",
      categoryId: "lanches",
      name: "X-Burger",
      description: "Pão, hambúrguer, queijo, alface e tomate",
      price: 29.99,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1789411917034_401lra.jpg",
      tag: "Mais pedido",
    },
    {
      id: "s-xbacon",
      categoryId: "lanches",
      name: "X-Bacon",
      description: "Pão, hambúrguer, queijo, bacon crocante",
      price: 21.9,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1790975930471_3o9b3b.webp",
    },
    {
      id: "s-xtudo",
      categoryId: "lanches",
      name: "X-Tudo",
      description: "Hambúrguer duplo, queijo, bacon, ovo, presunto",
      price: 28.9,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1790976043341_1g2r69.webp",
    },
    {
      id: "s-frango",
      categoryId: "lanches",
      name: "Frango Grelhado",
      description: "Peito de frango grelhado com salada",
      price: 22.9,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1790976105381_3uc1ei.webp",
    },
    {
      id: "s-hotdog",
      categoryId: "lanches",
      name: "Hot Dog Especial",
      description: "Salsicha, purê, milho, batata palha",
      price: 16.9,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1790976129745_cf78jp.webp",
    },
    {
      id: "s-coca",
      categoryId: "bebidas",
      name: "Coca-Cola Lata",
      description: "350ml gelada",
      price: 5.9,
      emoji: "🥤",
    },
    {
      id: "s-guarana",
      categoryId: "bebidas",
      name: "Guaraná Lata",
      description: "350ml gelada",
      price: 5.9,
      emoji: "🥤",
    },
    {
      id: "s-suco",
      categoryId: "bebidas",
      name: "Suco Natural",
      description: "Laranja ou limão 400ml",
      price: 7.9,
      emoji: "🥤",
    },
    {
      id: "s-cerveja",
      categoryId: "bebidas",
      name: "Cerveja Lata",
      description: "Brahma ou Skol 350ml",
      price: 7.9,
      emoji: "🍺",
    },
    {
      id: "s-comboburger",
      categoryId: "combos",
      name: "Combo Burger + Refri",
      description: "X-Burger + Coca-Cola Lata",
      price: 22.9,
      emoji: "🍔",
    },
    {
      id: "s-combofamilia",
      categoryId: "combos",
      name: "Combo Família",
      description: "2 X-Tudo + 2 Refris + Batata",
      price: 69.9,
      emoji: "🍔",
    },
  ],
};

/**
 * Roteiro da criação por conversa (vitrine da landing).
 *
 * Espelha os primeiros passos do `RestaurantChatWizard` real — mesma ideia de
 * uma pergunta por vez, sem formulário. Aqui é só demonstração animada.
 */
export const WIZARD_SCRIPT: { q: string; a: string }[] = [
  {
    q: "Vamos colocar seu cardápio no ar! Qual é o nome do seu restaurante?",
    a: "Cantina da Pracinha",
  },
  { q: "Quer um slogan ou uma descrição curta?", a: "Massas artesanais desde 2018" },
  { q: "Qual WhatsApp vai receber os pedidos?", a: "(48) 99999-9999" },
  { q: "Onde você fica? Rua, número e bairro.", a: "Rua das Flores, 123 — Centro" },
  { q: "Quando você atende?", a: "Ter a dom · 18h às 23h" },
];

/** Cardápio de exemplo que "nasce" do chat de criação, ao final do roteiro. */
export const WIZARD_MENU = [
  { emoji: "🍝", name: "Nhoque da casa", price: 38 },
  { emoji: "🍕", name: "Pizza margherita", price: 46 },
  { emoji: "🥗", name: "Salada caesar", price: 26 },
];
