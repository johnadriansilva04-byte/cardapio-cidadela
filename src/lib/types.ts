export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  img: string;
}

export interface Category {
  name: string;
  items: MenuItem[];
}

export interface PromoCode {
  code: string;
  label: string;
  discount: number;
  createdAt: string;
  used: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export type OrderStatus = "pendente" | "andamento" | "entregue";

export interface Order {
  comanda: string;
  cliente: string;
  telefone: string;
  endereco: string;
  observacoes: string;
  itens: OrderItem[];
  total: number;
  tipo_entrega: "entrega" | "retirada";
  taxa_entrega: number;
  pagamento: "pix" | "dinheiro" | "cartao";
  troco?: string;
  status: OrderStatus;
  createdAt: string;
  synced: boolean;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  at: string;
}

export interface AppState {
  store: { name: string; slogan: string; marquee: string };
  payment: { pixKey: string };
  promo: { meta: number; cidadelaDate: string };
  admin: { accessKey: string };
  whatsapp: string;
  integrations: { geminiApiKey: string; n8nWebhookUrl: string; cidadelaAuthUrl: string };
  categories: Category[];
  cidadela: { codes: PromoCode[]; accessHistory: string[] };
  orders: Order[];
  conversation: ChatMessage[];
}

export const DEFAULT_STATE: AppState = {
  store: {
    name: "Cantina do Pracinha",
    slogan: "Sabor de trincheira, brio de veterano",
    marquee:
      "ENTREGA EM ATÉ 35 MIN • PIX APROVADO NA HORA • PEDIDOS ACIMA DE R$100 GANHAM CÓDIGO FEB-VIP • HONRA, DIGNIDADE E SABOR",
  },
  payment: { pixKey: "cantina@pracinha.com.br" },
  promo: { meta: 100, cidadelaDate: new Date().toISOString().slice(0, 10) },
  admin: { accessKey: "FEB-1944" },
  whatsapp: "5511999999999",
  integrations: { geminiApiKey: "", n8nWebhookUrl: "http://localhost:5678/webhook/pracinha", cidadelaAuthUrl: "http://localhost:5678/webhook/cidadela" },
  cidadela: { codes: [], accessHistory: [] },
  orders: [],
  conversation: [],
  categories: [
    {
      name: "Lanches",
      items: [
        {
          id: "x-proteic",
          name: "X-Proteic",
          desc: "Blend 180g, cheddar maturado, bacon crocante e pão brioche tostado na chapa.",
          price: 39.9,
          img: "🍔",
        },
        {
          id: "x-monte-castelo",
          name: "X-Monte Castelo",
          desc: "Duplo smash, queijo prato, cebola caramelizada e molho da casa.",
          price: 44.9,
          img: "🍔",
        },
        {
          id: "cobra-fumando",
          name: "Cobra Fumando",
          desc: "Costela desfiada defumada 12h, queijo coalho e geleia de pimenta.",
          price: 49.9,
          img: "🔥",
        },
        {
          id: "veg-brio",
          name: "Veg Brio",
          desc: "Burger de grão-de-bico, rúcula, tomate confit e maionese de ervas.",
          price: 34.9,
          img: "🥬",
        },
      ],
    },
    {
      name: "Adicionais",
      items: [
        {
          id: "add-bacon",
          name: "Bacon Extra",
          desc: "Porção generosa de bacon artesanal.",
          price: 7.5,
          img: "🥓",
        },
        {
          id: "add-cheddar",
          name: "Cheddar Cremoso",
          desc: "Concha extra de cheddar inglês.",
          price: 6.0,
          img: "🧀",
        },
        {
          id: "add-fritas",
          name: "Fritas Rústicas",
          desc: "Batata rústica com alecrim e sal defumado.",
          price: 18.9,
          img: "🍟",
        },
      ],
    },
    {
      name: "Bebidas",
      items: [
        {
          id: "bev-cola",
          name: "Refrigerante Lata",
          desc: "350ml gelado.",
          price: 7.0,
          img: "🥤",
        },
        {
          id: "bev-suco",
          name: "Suco Natural",
          desc: "Laranja, limão ou maracujá — 500ml.",
          price: 12.0,
          img: "🍊",
        },
        {
          id: "bev-agua",
          name: "Água Mineral",
          desc: "500ml com ou sem gás.",
          price: 5.0,
          img: "💧",
        },
      ],
    },
  ],
};
