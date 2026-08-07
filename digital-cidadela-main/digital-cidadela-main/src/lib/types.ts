export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  img: string;
}

export interface Category {
  id: string;
  name: string;
  items: MenuItem[];
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

export interface DiscountTier {
  points: number;
  percentage: number;
}

export interface SoberaniaTransaction {
  id: string;
  type: "earned" | "lost" | "spent" | "rewarded";
  amount: number;
  reason: string;
  source: "game" | "order" | "ad" | "admin";
  timestamp: string;
}

export interface CidadelaCode {
  code: string;
  access_type: "15_min" | "15_dias";
  expires_at: string;
}

export interface AppState {
  store: { name: string; slogan: string; marquee: string; coverPhoto?: string };
  payment: { pixKey: string };
  admin: {
    accessKey: string;
    phone?: string;
    email?: string;
    storeId?: string;
    discountTiers?: DiscountTier[];
  };
  whatsapp: string;
  categories: Category[];
  orders: Order[];
  soberania: { points: number; history: SoberaniaTransaction[] };
  cidadela: { codes: CidadelaCode[] };
  integrations: { n8nWebhookUrl: string };
}
