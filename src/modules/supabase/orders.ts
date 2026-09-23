import { supabase } from "./client";
import type { Order, OrderStatus } from "@/lib/types";

function idempotencyKey(
  restaurantId: string,
  customerPhone: string,
  comanda: string,
  items: { product_id: string; quantity: number; unit_price: number }[],
): string {
  // A comanda entra na chave porque identifica a *tentativa* de pedido, não o
  // conteúdo: sem ela, o mesmo cliente repetindo os mesmos itens ("o de sempre")
  // caía no dedupe e a segunda compra nunca virava linha nova no banco.
  const raw = [
    restaurantId,
    customerPhone,
    comanda,
    ...items.map((i) => `${i.product_id}:${i.quantity}:${i.unit_price}`).sort(),
  ].join("|");
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i);
  return "idem-" + (h >>> 0).toString(16);
}

export async function createOrder(
  restaurantId: string,
  orderData: {
    comanda: string;
    customer_id?: string | null;
    guest_id?: string | null;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    delivery_address: string;
    customer_complement?: string;
    customer_neighborhood?: string;
    customer_city?: string;
    delivery_type: string;
    observations: string;
    subtotal: number;
    delivery_fee: number;
    total: number;
    payment_method: string;
  },
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    notes?: string;
  }[],
): Promise<{ order: Order | null; error?: { message: string; code?: string } }> {
  const key = idempotencyKey(restaurantId, orderData.customer_phone, orderData.comanda, items);

  const { data: existing, error: lookupError } = await supabase
    .from("orders")
    .select("*")
    .eq("idempotency_key", key)
    .maybeSingle();

  if (lookupError && lookupError.code !== "PGRST116") {
    console.error("Error checking idempotency:", lookupError);
  }
  // Só reaproveita um pedido ainda vivo. Se o anterior foi cancelado, a nova
  // tentativa é uma compra nova — devolver o cancelado fazia o cliente ver
  // "pedido enviado" sem nada chegar ao restaurante.
  if (existing && (existing as Order).status !== "cancelled") {
    return {
      order: {
        ...(existing as Order),
        order_items: items.map((i, idx) => ({ id: `${idx}`, ...i, notes: i.notes ?? "" })),
      },
    };
  }

  const orderId = crypto.randomUUID();

  // Base payload — only columns that are guaranteed to exist in every DB
  const base: Record<string, unknown> = {
    id: orderId,
    restaurant_id: restaurantId,
    idempotency_key: key,
    comanda: orderData.comanda,
    customer_name: orderData.customer_name,
    customer_phone: orderData.customer_phone,
    customer_email: orderData.customer_email,
    delivery_address: orderData.delivery_address,
    delivery_type: orderData.delivery_type,
    observations: orderData.observations,
    subtotal: orderData.subtotal,
    delivery_fee: orderData.delivery_fee,
    total: orderData.total,
    payment_method: orderData.payment_method,
    payment_status: orderData.payment_method === "pix" ? "awaiting_confirmation" : "pending",
    status: "received",
  };

  // Optional columns — only sent if the DB actually has them (retry strips missing ones)
  const optional: Record<string, unknown> = {};
  if (orderData.customer_id) optional.customer_id = orderData.customer_id;
  if (orderData.guest_id) optional.guest_id = orderData.guest_id;
  if (orderData.customer_complement) optional.customer_complement = orderData.customer_complement;
  if (orderData.customer_neighborhood)
    optional.customer_neighborhood = orderData.customer_neighborhood;
  if (orderData.customer_city) optional.customer_city = orderData.customer_city;

  // Try insert, stripping any column the schema cache complains about
  let payload: Record<string, unknown> = { ...base, ...optional };
  let lastError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase.from("orders").insert(payload as never);
    if (!error) {
      lastError = null;
      break;
    }
    lastError = error as { message: string; code?: string };
    // 23505 = idempotency duplicate — fetch and return it
    if (lastError.code === "23505") {
      const { data: dup } = await supabase
        .from("orders")
        .select("*")
        .eq("idempotency_key", payload.idempotency_key as string)
        .maybeSingle();
      if (dup && (dup as Order).status !== "cancelled") {
        return {
          order: {
            ...(dup as Order),
            order_items: items.map((i, idx) => ({ id: `${idx}`, ...i, notes: i.notes ?? "" })),
          },
        };
      }
      // A chave pertence a um pedido cancelado: gera uma nova e insere de fato.
      const next = { ...payload, idempotency_key: `${key}-${Date.now().toString(36)}` };
      payload = next;
      continue;
    }
    // Schema cache miss — remove the offending column and retry
    const m = /Could not find the '([^']+)' column/i.exec(lastError.message);
    if (m && m[1] in payload) {
      console.warn(
        `[orders] column '${m[1]}' not in schema cache — retrying without it. Rode supabase/schema.sql no Supabase.`,
      );
      const next = { ...payload };
      delete next[m[1]];
      // also drop from optional so we don't re-add it
      delete optional[m[1]];
      payload = next;
      continue;
    }
    // Not a missing-column error — stop retrying
    break;
  }

  if (lastError) {
    console.error("Error creating order:", lastError);
    let hint = lastError.message;
    if (lastError.code === "42501")
      hint = "Permissão negada (RLS). Execute o schema.sql no Supabase.";
    else if (/Could not find the .*column.*schema cache/i.test(lastError.message)) {
      hint = `${lastError.message} — Rode supabase/schema.sql no Supabase SQL Editor para adicionar as colunas faltantes.`;
    }
    return { order: null, error: { message: hint, code: lastError.code } };
  }

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        notes: item.notes ?? "",
      })),
    );
    if (itemsError) console.error("Error creating order items:", itemsError);
  }

  await supabase.from("order_status_history").insert({
    order_id: orderId,
    status: "received",
    note: "Pedido criado",
  });

  // Fire-and-forget: acorda o celular do dono mesmo com o app fechado.
  // A Edge Function gera/chama as chaves VAPID dela mesma — nada para configurar.
  void supabase.functions
    .invoke("notify-new-order", {
      body: {
        id: orderId,
        restaurant_id: restaurantId,
        customer_name: orderData.customer_name,
        comanda: orderData.comanda,
        total: orderData.total,
        delivery_type: orderData.delivery_type,
        items: items.map((i) => ({ product_name: i.product_name, quantity: i.quantity })),
      },
    })
    .catch(() => {
      /* push é best-effort: falha não afeta o pedido */
    });

  return {
    order: {
      id: orderId,
      restaurant_id: restaurantId,
      comanda: orderData.comanda,
      customer_id: (payload.customer_id as string | null) ?? orderData.customer_id ?? null,
      guest_id: (payload.guest_id as string | null) ?? orderData.guest_id ?? null,
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      customer_email: orderData.customer_email,
      delivery_address: orderData.delivery_address,
      customer_complement:
        (payload.customer_complement as string) ?? orderData.customer_complement ?? "",
      customer_neighborhood:
        (payload.customer_neighborhood as string) ?? orderData.customer_neighborhood ?? "",
      customer_city: (payload.customer_city as string) ?? orderData.customer_city ?? "",
      delivery_type: orderData.delivery_type,
      observations: orderData.observations,
      subtotal: orderData.subtotal,
      delivery_fee: orderData.delivery_fee,
      total: orderData.total,
      payment_method: orderData.payment_method,
      payment_status: orderData.payment_method === "pix" ? "awaiting_confirmation" : "pending",
      status: "received" as OrderStatus,
      idempotency_key: key,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cidadela_unlocked: false,
      order_items: items.map((i, idx) => ({ id: `${idx}`, ...i, notes: i.notes ?? "" })),
    },
  };
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Order;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * A view pública `order_tracking` (e a RPC `get_order_tracking`) só devolvem
 * id, restaurant_id, comanda, status, total, observations, created_at e
 * order_items. A tela de acompanhamento, porém, formata `subtotal` e lê
 * `delivery_fee`/`delivery_type`/`payment_method` — sem esta normalização o
 * `brl(undefined)` estourava um TypeError e a página caía no erro genérico.
 */
export function normalizeTrackingOrder(raw: Order): Order {
  const total = toNumber(raw.total);
  const deliveryFee = toNumber(raw.delivery_fee);
  const subtotal = toNumber(raw.subtotal, Math.max(total - deliveryFee, 0));
  return {
    ...raw,
    total,
    delivery_fee: deliveryFee,
    subtotal,
    delivery_type: raw.delivery_type || "retirada",
    payment_method: raw.payment_method || "",
    observations: raw.observations ?? "",
    order_items: raw.order_items ?? [],
  };
}

export async function getOrderTrackingPublic(orderId: string): Promise<Order | null> {
  const { data: viaRpc } = await supabase.rpc("get_order_tracking", { p_oid: orderId });
  if (Array.isArray(viaRpc) && viaRpc.length === 1)
    return normalizeTrackingOrder(viaRpc[0] as Order);
  const { data, error } = await supabase
    .from("order_tracking")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeTrackingOrder(data as Order);
}

export async function getOrdersByRestaurant(
  restaurantId: string,
  options?: { limit?: number; status?: OrderStatus },
): Promise<Order[]> {
  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (options?.status) query = query.eq("status", options.status);
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
  return (data ?? []) as Order[];
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    console.error("Error updating order status:", error);
    return false;
  }
  await supabase
    .from("order_status_history")
    .insert({ order_id: orderId, status, note: note ?? "" });
  return true;
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    console.error("Error updating payment status:", error);
    return false;
  }
  return true;
}

export async function getOrderHistory(
  orderId: string,
): Promise<{ status: OrderStatus; note: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from("order_status_history")
    .select("status, note, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Error fetching order history:", error);
    return [];
  }
  return data ?? [];
}

export function subscribeToOrders(
  restaurantId: string,
  callback: (eventType: "INSERT" | "UPDATE" | "DELETE", order: Order) => void,
  channelPrefix = "orders",
) {
  // O prefixo evita colisão de nome quando duas telas escutam a mesma loja ao
  // mesmo tempo (layout + página): o Supabase reaproveita o tópico e o
  // `removeChannel` de uma derrubaria a outra.
  return supabase
    .channel(`${channelPrefix}_${restaurantId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
      (payload) => {
        callback(payload.eventType as "INSERT" | "UPDATE" | "DELETE", payload.new as Order);
      },
    )
    .subscribe();
}

export async function hasCidadelaAccess(
  restaurantId: string,
  customerPhone: string,
): Promise<boolean> {
  if (!customerPhone) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { data } = await supabase
    .from("cidadela_unlocks")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("customer_phone", customerPhone)
    .gte("unlocked_at", today.toISOString())
    .lt("unlocked_at", tomorrow.toISOString())
    .maybeSingle();
  return !!data;
}

export async function unlockCidadela(
  restaurantId: string,
  orderId: string,
  customerPhone: string,
): Promise<boolean> {
  if (!customerPhone || !orderId || !restaurantId) return false;
  const { data: order, error: orderCheckError } = await supabase
    .from("orders")
    .select("id, restaurant_id, status")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (orderCheckError || !order) {
    console.error("Order validation failed for Cidadela unlock:", orderCheckError);
    return false;
  }
  if (order.status === "cancelled") return false;
  const { error } = await supabase
    .from("cidadela_unlocks")
    .insert({ restaurant_id: restaurantId, order_id: orderId, customer_phone: customerPhone });
  if (error) {
    if (error.code === "23505") return true;
    console.error("Error unlocking Cidadela:", error);
    return false;
  }
  await supabase.from("orders").update({ cidadela_unlocked: true }).eq("id", orderId);
  return true;
}

export async function getOrdersByDateRange(
  restaurantId: string,
  startDate: string,
  endDate: string,
): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching orders by date range:", error);
    return [];
  }
  return (data ?? []) as Order[];
}

/**
 * Busca os pedidos de um convidado via RPC segura (dados limitados, sem PII).
 * Retorna null quando a RPC não existe no banco (schema antigo).
 */
export async function getOrdersForGuest(
  guestId: string,
): Promise<import("@/lib/types").GuestOrderSummary[] | null> {
  const { data, error } = await supabase.rpc("get_orders_by_guest", { p_guest: guestId });
  if (error) {
    console.error("[orders] getOrdersForGuest error:", error);
    return null;
  }
  return (data ?? []) as unknown as import("@/lib/types").GuestOrderSummary[];
}

export async function getOrderStats(
  restaurantId: string,
  startDate: string,
  endDate: string,
): Promise<{
  totalOrders: number;
  totalRevenue: number;
  averageTicket: number;
  ordersByStatus: Record<string, number>;
  deliveredCount: number;
  cancelledCount: number;
}> {
  const { data, error } = await supabase
    .from("orders")
    .select("total, status")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);
  if (error || !data)
    return {
      totalOrders: 0,
      totalRevenue: 0,
      averageTicket: 0,
      ordersByStatus: {},
      deliveredCount: 0,
      cancelledCount: 0,
    };
  const totalOrders = data.length;
  const totalRevenue = data
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total), 0);
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const ordersByStatus: Record<string, number> = {};
  for (const o of data) ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
  return {
    totalOrders,
    totalRevenue,
    averageTicket,
    ordersByStatus,
    deliveredCount: ordersByStatus["delivered"] || 0,
    cancelledCount: ordersByStatus["cancelled"] || 0,
  };
}

export async function getRestaurantOrderSummary(restaurantId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: todayOrders } = await supabase
    .from("orders")
    .select("total, status")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", today.toISOString());
  const { data: totalOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact" })
    .eq("restaurant_id", restaurantId);
  const activeOrders = (todayOrders ?? []).filter(
    (o) => o.status === "received" || o.status === "preparing",
  );
  const todayRevenue = (todayOrders ?? []).reduce((sum, o) => sum + Number(o.total), 0);
  return {
    todayOrdersCount: todayOrders?.length ?? 0,
    activeOrdersCount: activeOrders.length,
    todayRevenue,
    totalOrdersCount: totalOrders?.length ?? 0,
  };
}
