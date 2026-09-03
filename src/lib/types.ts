// ============================================================
// Types for the multi-restaurant digital menu platform
// + backward-compatible types for Cidadela game components
// ============================================================

// --- Restaurant ---
export type RestaurantStatus = 'draft' | 'published' | 'paused';

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  phone: string;
  whatsapp: string;
  address: string;
  logo_url: string;
  banner_url: string;
  primary_color: string;
  secondary_color: string;
  status: RestaurantStatus;
  pix_key: string;
  created_at: string;
  updated_at: string;
}

// --- Category ---
export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

// --- Product ---
export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  available: boolean;
  sort_order: number;
  created_at: string;
}

// --- Add-ons ---
export interface AddonGroup {
  id: string;
  restaurant_id: string;
  name: string;
  min_select: number;
  max_select: number;
}

export interface Addon {
  id: string;
  restaurant_id: string;
  group_id: string;
  product_id: string | null;
  name: string;
  price: number;
  available: boolean;
  sort_order: number;
}

// --- Orders ---
export type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  comanda: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string;
  delivery_type: string;
  observations: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  status: OrderStatus;
  cidadela_unlocked: boolean;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string;
  created_at: string;
}

// --- Cidadela ---
export interface CidadelaUnlock {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  customer_phone: string;
  unlocked_at: string;
}

// --- Cart (client-side) ---
export interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
}

// --- Checkout form ---
export interface CheckoutForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string;
  delivery_type: 'entrega' | 'retirada';
  observations: string;
  payment_method: 'pix' | 'dinheiro' | 'cartao';
  change_for: string;
}

// --- Order Status labels ---
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'RECEBIDO',
  preparing: 'EM PREPARAÇÃO',
  ready: 'PRONTO',
  delivered: 'ENTREGUE',
  cancelled: 'CANCELADO',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  received: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  preparing: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  ready: 'bg-green-500/20 text-green-300 border-green-500/30',
  delivered: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
};

// ============================================================
// Backward-compatible types for Cidadela game components
// ============================================================

export interface RobotConfig {
  [key: string]: unknown;
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

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  at: string;
}

export interface PromoCode {
  code: string;
  label: string;
  discount: number;
  createdAt: string;
  expiration: string;
  used: boolean;
}

export interface SoberaniaTransaction {
  id: string;
  type: 'earned' | 'lost' | 'spent' | 'rewarded';
  amount: number;
  reason: string;
  timestamp: string;
  source: 'game' | 'order' | 'ad' | 'admin';
}

export interface DiscountTier {
  points: number;
  percentage: number;
}

// Legacy AppState for Cidadela components
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
  categories: LegacyCategory[];
  cidadela: {
    codes: PromoCode[];
    accessHistory: string[];
    robots: RobotConfig[];
    customTopics: CustomTopic[];
    isPremium: boolean;
  };
  orders: LegacyOrder[];
  conversation: ChatMessage[];
  soberania: {
    points: number;
    history: SoberaniaTransaction[];
  };
  _version?: number;
}

export interface LegacyCategory {
  id: string;
  name: string;
  items: LegacyMenuItem[];
}

export interface LegacyMenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  img: string;
}

export interface LegacyOrder {
  comanda: string;
  cliente: string;
  email?: string;
  telefone: string;
  endereco: string;
  observacoes: string;
  itens: { id: string; name: string; quantity: number; price: number; total: number }[];
  total: number;
  tipo_entrega: 'entrega' | 'retirada';
  taxa_entrega: number;
  pagamento: 'pix' | 'dinheiro' | 'cartao';
  troco?: string;
  status: 'pendente' | 'andamento' | 'entregue';
  createdAt: string;
  synced: boolean;
}

export const DEFAULT_STATE: AppState = {
  store: { name: '', slogan: '', marquee: '' },
  payment: { pixKey: '' },
  promo: { meta: 100, cidadelaDate: new Date().toISOString().slice(0, 10) },
  admin: { accessKey: 'FEB-1944', discountTiers: [] },
  whatsapp: '',
  integrations: {
    geminiApiKey: '',
    n8nWebhookUrl: '',
    cidadelaAuthUrl: '',
    adminTrialUrl: '',
    gamesSessionUrl: '',
    gamesMoveUrl: '',
  },
  cidadela: { codes: [], accessHistory: [], robots: [], customTopics: [], isPremium: false },
  orders: [],
  conversation: [],
  soberania: { points: 0, history: [] },
  _version: 9,
  categories: [],
};
