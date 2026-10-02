// ============================================================
// Types for the multi-restaurant digital menu platform
// + backward-compatible types for Cidadela game components
// ============================================================

// --- Restaurant ---
export type RestaurantStatus = "draft" | "published" | "paused";

export interface OperatingHours {
  seg: { closed: boolean; open: string; close: string };
  ter: { closed: boolean; open: string; close: string };
  qua: { closed: boolean; open: string; close: string };
  qui: { closed: boolean; open: string; close: string };
  sex: { closed: boolean; open: string; close: string };
  sab: { closed: boolean; open: string; close: string };
  dom: { closed: boolean; open: string; close: string };
}

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  slogan?: string;
  phone: string;
  whatsapp: string;
  address: string;
  logo_url: string;
  banner_url: string;
  primary_color: string;
  secondary_color: string;
  status: RestaurantStatus;
  pix_key: string;
  delivery_fee?: number;
  operating_hours?: OperatingHours | null;
  created_at: string;
  updated_at: string;
}

// --- Delivery neighborhood (taxa por bairro) ---
export interface DeliveryNeighborhood {
  id: string;
  restaurant_id: string;
  name: string;
  fee: number;
  created_at: string;
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

// --- Restaurant Add-ons (ex: Ovo, Queijo, Bacon - globais para todos os lanches) ---
// Adicionais configurados pelo restaurante que podem ser aplicados a qualquer produto.
// O cliente marca os que quer no modal e paga o valor de cada um a mais.
export interface RestaurantAddon {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  available: boolean;
  sort_order: number;
  created_at: string;
}

// --- Product Add-ons (legado - mantido para compatibilidade) ---
// Cada produto pode ter vários adicionais configurados pelo restaurante.
// O cliente marca os que quer no modal e paga o valor de cada um a mais.
export interface ProductAddon {
  id: string;
  restaurant_id: string;
  product_id: string;
  name: string;
  price: number;
  available: boolean;
  sort_order: number;
  created_at: string;
}

export interface SelectedAddon {
  addon_id: string;
  name: string;
  price: number;
}

// Legacy aliased types (mantidos para compat se algum código referenciar)
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
export type OrderStatus =
  "received" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";

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
  customer_id: string | null;
  guest_id?: string | null;
  idempotency_key: string | null;
  comanda: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string;
  customer_complement: string;
  customer_neighborhood: string;
  customer_city: string;
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

/** Pedido na perspectiva do cliente (sem dados pessoais) */
export interface GuestOrderSummary {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  comanda: string;
  status: OrderStatus;
  total: number;
  delivery_type: string;
  payment_method: string;
  created_at: string;
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
  addons?: SelectedAddon[];
}

// --- Checkout form ---
export interface CheckoutForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string;
  delivery_type: "entrega" | "retirada";
  observations: string;
  payment_method: "pix" | "dinheiro" | "cartao";
  change_for: string;
}

// --- Order Status labels ---
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "RECEBIDO",
  preparing: "EM PREPARAÇÃO",
  ready: "PRONTO",
  out_for_delivery: "A CAMINHO",
  delivered: "ENTREGUE",
  cancelled: "CANCELADO",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  received: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  preparing: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  ready: "bg-green-500/20 text-green-300 border-green-500/30",
  out_for_delivery: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  delivered: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};
