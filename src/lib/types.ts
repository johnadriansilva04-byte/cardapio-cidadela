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
  expiration: string;
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
  email?: string;
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
  store: { name: string; slogan: string; marquee: string; coverPhoto?: string };
  payment: { pixKey: string };
  promo: { meta: number; cidadelaDate: string };
  admin: { accessKey: string; phone?: string; email?: string; storeId?: string; discountTiers?: DiscountTier[] };
  whatsapp: string;
  integrations: {
    geminiApiKey: string;
    n8nWebhookUrl: string;
    cidadelaAuthUrl: string;
    adminTrialUrl: string;
    gamesSessionUrl: string;
    gamesMoveUrl: string;
  };
  categories: Category[];
  cidadela: {
    codes: PromoCode[];
    accessHistory: string[];
    robots: RobotConfig[];
    customTopics: CustomTopic[];
    isPremium: boolean;
  };
  orders: Order[];
  conversation: ChatMessage[];
  soberania: {
    points: number;
    history: SoberaniaTransaction[];
  };
  _version?: number; // State version for migration
}

export interface RobotConfig {
  name: string;
  ideology: string;
  personality: string;
  strategy: string;
  aggressiveness: number;
  eloquence: number;
  logic: number;
}

export interface CustomTopic {
  id: string;
  name: string;
  createdAt: string;
}

export interface SoberaniaTransaction {
  id: string;
  type: "earned" | "lost" | "spent" | "rewarded";
  amount: number;
  reason: string;
  timestamp: string;
  source: "game" | "order" | "ad" | "admin";
}

export interface DiscountTier {
  points: number;
  percentage: number;
}

export const DEFAULT_STATE: AppState = {
  store: {
    name: "Cantina do Pracinha",
    slogan: "Sabor de trincheira, brio de veterano",
    marquee:
      "ENTREGA EM ATÃ‰ 35 MIN â€¢ PIX APROVADO NA HORA â€¢ PEDIDOS ACIMA DE R$100 GANHAM CÃ“DIGO FEB-VIP â€¢ HONRA, DIGNIDADE E SABOR",
  },
  payment: { pixKey: "cantina@pracinha.com.br" },
  promo: { meta: 100, cidadelaDate: new Date().toISOString().slice(0, 10) },
  admin: { accessKey: import.meta.env.VITE_ADMIN_ACCESS_KEY || "FEB-1944", discountTiers: [] },
  whatsapp: import.meta.env.VITE_WHATSAPP_NUMBER || "5511999999999",
  integrations: {
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
    n8nWebhookUrl:
      import.meta.env.VITE_N8N_WEBHOOK_URL || "https://webhook.pracinha.online/webhook/pracinha",
    cidadelaAuthUrl:
      import.meta.env.VITE_N8N_CIDADELA_AUTH_URL ||
      "https://webhook.pracinha.online/webhook/cidadela",
    adminTrialUrl:
      import.meta.env.VITE_N8N_ADMIN_TRIAL_URL ||
      "https://webhook.pracinha.online/webhook/admin-trial",
    gamesSessionUrl:
      import.meta.env.VITE_N8N_GAMES_SESSION_URL ||
      "https://webhook.pracinha.online/webhook/games/session",
    gamesMoveUrl:
      import.meta.env.VITE_N8N_GAMES_MOVE_URL ||
      "https://webhook.pracinha.online/webhook/games/move",
  },
  cidadela: { codes: [], accessHistory: [], robots: [], customTopics: [], isPremium: false },
  orders: [],
  conversation: [],
  soberania: { points: 0, history: [] },
  _version: 8, // State version for migration
  categories: [
    {
      name: "Lanches",
      items: [
        {
          id: "x-proteic",
          name: "X-Proteic",
          desc: "Blend 180g, cheddar maturado, bacon crocante e pÃ£o brioche tostado na chapa.",
          price: 39.9,
          img: "ðŸ”",
        },
        {
          id: "x-monte-castelo",
          name: "X-Monte Castelo",
          desc: "Duplo smash, queijo prato, cebola caramelizada e molho da casa.",
          price: 44.9,
          img: "ðŸ”",
        },
        {
          id: "cobra-fumando",
          name: "Cobra Fumando",
          desc: "Costela desfiada defumada 12h, queijo coalho e geleia de pimenta.",
          price: 49.9,
          img: "ðŸ”¥",
        },
        {
          id: "veg-brio",
          name: "Veg Brio",
          desc: "Burger de grÃ£o-de-bico, rÃºcula, tomate confit e maionese de ervas.",
          price: 34.9,
          img: "ðŸ¥¬",
        },
      ],
    },
    {
      name: "Adicionais",
      items: [
        {
          id: "add-bacon",
          name: "Bacon Extra",
          desc: "PorÃ§Ã£o generosa de bacon artesanal.",
          price: 7.5,
          img: "ðŸ¥“",
        },
        {
          id: "add-cheddar",
          name: "Cheddar Cremoso",
          desc: "Concha extra de cheddar inglÃªs.",
          price: 6.0,
          img: "ðŸ§€",
        },
        {
          id: "add-fritas",
          name: "Fritas RÃºsticas",
          desc: "Batata rÃºstica com alecrim e sal defumado.",
          price: 18.9,
          img: "ðŸŸ",
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
          img: "ðŸ¥¤",
        },
        {
          id: "bev-suco",
          name: "Suco Natural",
          desc: "Laranja, limÃ£o ou maracujÃ¡ â€” 500ml.",
          price: 12.0,
          img: "ðŸŠ",
        },
        {
          id: "bev-agua",
          name: "Ãgua Mineral",
          desc: "500ml com ou sem gÃ¡s.",
          price: 5.0,
          img: "ðŸ’§",
        },
      ],
    },
  ],
};
