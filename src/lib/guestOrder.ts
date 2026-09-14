import { supabase } from "@/modules/supabase/client";
import type { Order, GuestOrderSummary } from "@/lib/types";

const GUEST_ID_KEY = "cardapio_cidadela_guest_id";
const ACTIVE_ORDERS_KEY = "cardapio_cidadela_my_orders";

/** Gera um token aleatório seguro o suficiente para identificar o dispositivo. */
function generateGuestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `guest_${hex}`;
}

/**
 * Retorna o guest id persistido neste dispositivo. O id identifica o
 * "convidado" ao qual os pedidos deste navegador pertencem, permitindo
 * que o cliente reencontre os pedidos sem precisar de login.
 */
export function getOrCreateGuestId(): string {
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = generateGuestId();
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage indisponível — id efêmero (só vale nesta sessão da página)
    return generateGuestId();
  }
}

export function getGuestId(): string | null {
  try {
    return localStorage.getItem(GUEST_ID_KEY);
  } catch {
    return null;
  }
}

/** Registra o id do pedido como ativo no dispositivo (fallback offline). */
export function rememberOrderId(orderId: string): void {
  try {
    const list = getRememberedOrderIds();
    if (!list.includes(orderId)) {
      list.push(orderId);
      localStorage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(list.slice(-20)));
    }
  } catch {
    /* storage indisponível */
  }
}

export function getRememberedOrderIds(): string[] {
  try {
    const raw = localStorage.getItem(ACTIVE_ORDERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function forgetOrderId(orderId: string): void {
  try {
    const list = getRememberedOrderIds().filter((id) => id !== orderId);
    localStorage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(list));
  } catch {
    /* storage indisponível */
  }
}

type OrderWithRestaurant = Order & { restaurant_name?: string };

/**
 * Lista os pedidos do convidado atual: primeiro tenta a RPC segura por
 * guest_id; se a coluna/RPC ainda não existir no banco, cai no fallback
 * dos ids lembrados localmente + last_order.
 */
export async function getMyOrders(): Promise<GuestOrderSummary[]> {
  const guestId = getGuestId();
  const remembered = getRememberedOrderIds();
  const results: GuestOrderSummary[] = [];

  if (guestId) {
    try {
      // Tenta limpar pedidos antigos encerrados (melhor esforço; schema antigo ignora)
      await supabase.rpc("cleanup_expired_guest_orders");
    } catch {
      /* RPC indisponível */
    }
    try {
      const { data, error } = await supabase.rpc("get_orders_by_guest", { p_guest: guestId });
      // RPC disponível: confia nela mesmo com lista vazia (pedidos encerrados já anonimizados)
      if (!error && Array.isArray(data)) {
        return data as unknown as GuestOrderSummary[];
      }
    } catch {
      /* RPC indisponível — cai no fallback */
    }
  }

  const uniqueIds = [...new Set(remembered)];
  for (const id of uniqueIds) {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, restaurants(name)")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) continue;
      const row = data as unknown as OrderWithRestaurant;
      results.push({
        id: row.id,
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name ?? "",
        comanda: row.comanda,
        status: row.status,
        total: Number(row.total ?? 0),
        delivery_type: row.delivery_type ?? "retirada",
        payment_method: row.payment_method ?? "pix",
        created_at: row.created_at,
      });
    } catch {
      /* ignora individual */
    }
  }

  // Garante que o último pedido criado localmente apareça mesmo sem RPC
  try {
    const raw = localStorage.getItem("last_order");
    if (raw) {
      const local = JSON.parse(raw) as Record<string, unknown>;
      if (local.id && !results.some((r) => r.id === local.id)) {
        results.push({
          id: local.id as string,
          restaurant_id: (local.restaurant_id as string) ?? "",
          restaurant_name: "",
          comanda: (local.comanda as string) ?? "",
          status: (local.status as "received") ?? "received",
          total: Number(local.total ?? 0),
          delivery_type: (local.delivery_type as string) ?? "retirada",
          payment_method: (local.payment_method as string) ?? "pix",
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch {
    /* storage indisponível */
  }

  return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** True se o pedido está "fechado" (entregue/cancelado) e não precisa mais aparecer. */
export function isOrderClosed(status: string): boolean {
  return status === "delivered" || status === "cancelled";
}

/**
 * Remove pedidos encerrados da lista local após alguns dias, mantendo a
 * página "Meus pedidos" enxuta. O banco continua com o histórico do dono.
 */
export function pruneClosedOrderIds(orders: GuestOrderSummary[], retentionDays = 2): void {
  try {
    const now = Date.now();
    const closedIds = new Set(orders.filter((o) => isOrderClosed(o.status)).map((o) => o.id));
    const kept = getRememberedOrderIds().filter((id) => {
      if (!closedIds.has(id)) return true;
      const order = orders.find((o) => o.id === id);
      if (!order) return false;
      const ageMs = now - new Date(order.created_at).getTime();
      return ageMs < retentionDays * 24 * 60 * 60 * 1000;
    });
    localStorage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(kept));
  } catch {
    /* storage indisponível */
  }
}
