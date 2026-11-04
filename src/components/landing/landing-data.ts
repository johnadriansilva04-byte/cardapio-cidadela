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

export interface MenuTemplate {
  key: string;
  name: string;
  tagline: string;
  emoji: string;
  /** Cor de destaque (vira `primary_color` no restaurante). */
  primary: string;
  /** Cor secundária (vira `secondary_color`). */
  secondary: string;
  items: { emoji: string; name: string; price: number }[];
}

/**
 * Templates prontos: um ponto de partida visual para quem não quer escolher
 * cor no olho. As cores são as MESMAS do `COLOR_PRESETS` do
 * `RestaurantChatWizard` (`src/lib/restaurantChat.ts`), então o que o dono vê
 * aqui é o que ele aplica de verdade ao criar a loja.
 */
export const MENU_TEMPLATES: MenuTemplate[] = [
  {
    key: "hamburgueria",
    name: "Hamburgueria",
    tagline: "Rústico e quente, pra dar fome na hora",
    emoji: "🍔",
    primary: "#f97316",
    secondary: "#ef4444",
    items: [
      { emoji: "🍔", name: "X-Burger", price: 29.99 },
      { emoji: "🍟", name: "Porção de fritas", price: 18 },
      { emoji: "🥤", name: "Refri lata", price: 5.9 },
    ],
  },
  {
    key: "pizzaria",
    name: "Pizzaria",
    tagline: "Vermelho de forno a lenha, clássico",
    emoji: "🍕",
    primary: "#ef4444",
    secondary: "#f97316",
    items: [
      { emoji: "🍕", name: "Margherita", price: 46 },
      { emoji: "🧀", name: "Quatro queijos", price: 52 },
      { emoji: "🥗", name: "Salada da casa", price: 24 },
    ],
  },
  {
    key: "acai",
    name: "Açaí & Doces",
    tagline: "Rosa e roxo, cara de sobremesa",
    emoji: "🍨",
    primary: "#ec4899",
    secondary: "#8b5cf6",
    items: [
      { emoji: "🍨", name: "Açaí 300ml", price: 18 },
      { emoji: "🍫", name: "Brownie", price: 12 },
      { emoji: "🥤", name: "Milkshake", price: 16 },
    ],
  },
  {
    key: "natural",
    name: "Natural & Saudável",
    tagline: "Verde e leve, pra vender saúde",
    emoji: "🥗",
    primary: "#22c55e",
    secondary: "#10b981",
    items: [
      { emoji: "🥗", name: "Salada caesar", price: 26 },
      { emoji: "🥤", name: "Suco verde", price: 12 },
      { emoji: "🍗", name: "Frango grelhado", price: 22.9 },
    ],
  },
  {
    key: "cafeteria",
    name: "Cafeteria",
    tagline: "Azul tranquilo, pra café e lanche",
    emoji: "☕",
    primary: "#3b82f6",
    secondary: "#06b6d4",
    items: [
      { emoji: "☕", name: "Cappuccino", price: 12 },
      { emoji: "🥐", name: "Croissant", price: 9.5 },
      { emoji: "🍰", name: "Fatia de bolo", price: 14 },
    ],
  },
  {
    key: "japonesa",
    name: "Japonesa",
    tagline: "Ciano e violeta, moderno e limpo",
    emoji: "🍣",
    primary: "#06b6d4",
    secondary: "#8b5cf6",
    items: [
      { emoji: "🍣", name: "Combinado 20", price: 58 },
      { emoji: "🍜", name: "Lámen", price: 34 },
      { emoji: "🥟", name: "Guioza (6)", price: 22 },
    ],
  },
];
