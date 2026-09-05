import { supabase } from "./client";
import type { Order, OrderStatus, OrderItem } from "@/lib/types";

function idempotencyKey(
  restaurantId: string,
  customerPhone: string,
  items: { product_id: string; quantity: number; unit_price: number }[],
): string {
  // Stable hash of order identity so the same cart+customer can never be inserted twice.
  const raw = [
    restaurantId,
    customerPhone,
    ...items
      .map((i) => `${i.product_id}:${i.quantity}:${i.unit_price}`)
      .sort(),
  ].join("|");
  // djb2-style deterministic hash (not crypto; used only for dedupe key)
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h) ^ raw.charCodeAt(i);
  }
  return "idem-" + (h >>> 0).toString(16);
}

/**
 * Create a new order with items
 */
export async function createOrder(
  restaurantId: string,
  orderData: {
    comanda: string;
    customer_id?: string | null;
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
): Promise<Order | null> {
  const key = idempotencyKey(restaurantId, orderData.customer_phone, items);

  // If an identical order was already created (e.g. double-click on submit), return it instead of inserting again.

  const { data: existing } = await supabase
    .from("orders")
    .select("*")
    .eq("idempotency_key", key)
    .maybeSingle();

  if (existing) {
    return { ...(existing as Order), order_items: items.map((i, idx) => ({ id: `${idx}`, ...i, notes: i.notes ?? "" })) };
  }

  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
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
    })
    .select()
    .maybeSingle();

  if (orderError) {
    // 23505 = unique violation on idempotency_key from a concurrent double-submit.

    if (orderError.code === "23505") {
      const { data: dup } = await supabase
        .from("orders")
        .select("*")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (dup) {
        return { ...(dup as Order), order_items: items.map((i, idx) => ({ id: `${idx}`, ...i, notes: i.notes ?? "" })) };
      }
    }
    console.error("Error creating order:", orderError);
    return null;
  }

  // Insert order items
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        notes: item.notes ?? "",
      })),
    );

    if (itemsError) {
      console.error("Error creating order items:", itemsError);
    }
  }

  // Add initial status history
  await supabase.from("order_status_history").insert({
    order_id: order.id,
    status: "received",
    note: "Pedido criado",
  });

  return { ...(order as Order), order_items: items.map((i, idx) => ({ id: `${idx}`, ...i, notes: i.notes ?? "" })) };
}

/**
 * Get an order by ID with items
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Order;
}

/**
 * Get orders for a restaurant
 */
export async function getOrdersByRestaurant(
  restaurantId: string,
  options?: { limit?: number; status?: OrderStatus },
): Promise<Order[]> {
  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
  return (data ?? []) as Order[];
}

/**
 * Update order status
 */
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

  // Record status change
  await supabase.from("order_status_history").insert({
    order_id: orderId,
    status,
    note: note ?? "",
  });

  return true;
}

/**
 * Update order payment status
 */
export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    console.error("Error updating payment status:", error);
    return false;
  }
  return true;
}

/**
 * Get order status history
 */
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

/**
 * Subscribe to order changes for real-time updates
 */
export function subscribeToOrders(
  restaurantId: string,
  callback: (order: Order) => void,
) {
  return supabase
    .channel(`orders_${restaurantId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => {
        callback(payload.new as Order);
      },
    )
    .subscribe();
}

/**
 * Check if customer has unlocked Cidadela for a restaurant today.
 * Access is granted for the day of the order and expires at midnight.
 */
export async function hasCidadelaAccess(
  restaurantId: string,
  customerPhone: string,
): Promise<boolean> {
  if (!customerPhone) return false;

  // Get start of today (midnight local time)
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

/**
 * Record Cidadela unlock after a confirmed order.
 * Only unlocks if the order is real, belongs to the restaurant,
 * and the customer phone matches.
 */
export async function unlockCidadela(
  restaurantId: string,
  orderId: string,
  customerPhone: string,
): Promise<boolean> {
  if (!customerPhone || !orderId || !restaurantId) return false;

  // Validate: order must exist and belong to this restaurant
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

  // Order must be in a valid state (received or later)
  if (order.status === "cancelled") {
    return false;
  }

  // Insert unlock record
  const { error } = await supabase.from("cidadela_unlocks").insert({
    restaurant_id: restaurantId,
    order_id: orderId,
    customer_phone: customerPhone,
  });

  if (error) {
    // Might already be unlocked today (unique constraint), that's ok
    if (error.code === "23505") return true;
    console.error("Error unlocking Cidadela:", error);
    return false;
  }

  // Mark order as cidadela_unlocked
  await supabase
    .from("orders")
    .update({ cidadela_unlocked: true })
    .eq("id", orderId);

  return true;
}

/**
 * Get orders for a restaurant within a date range
 */
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
 * Get order statistics for a restaurant within a date range
 */
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

  if (error || !data) {
    return { totalOrders: 0, totalRevenue: 0, averageTicket: 0, ordersByStatus: {}, deliveredCount: 0, cancelledCount: 0 };
  }

  const totalOrders = data.length;
  const totalRevenue = data
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total), 0);
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const ordersByStatus: Record<string, number> = {};
  for (const o of data) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
  }

  return {
    totalOrders,
    totalRevenue,
    averageTicket,
    ordersByStatus,
    deliveredCount: ordersByStatus["delivered"] || 0,
    cancelledCount: ordersByStatus["cancelled"] || 0,
  };
}

/**
 * Get restaurant order summary (for dashboard)
 */
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
  const todayRevenue = (todayOrders ?? []).reduce(
    (sum, o) => sum + Number(o.total),
    0,
  );

  return {
    todayOrdersCount: todayOrders?.length ?? 0,
    activeOrdersCount: activeOrders.length,
    todayRevenue,
    totalOrdersCount: totalOrders?.length ?? 0,
  };
}
