import { supabase } from "./client";
import type { Order, OrderStatus, OrderItem } from "@/lib/types";

/**
 * Create a new order with items
 */
export async function createOrder(
  restaurantId: string,
  orderData: {
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
  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
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
    .single();

  if (orderError || !order) {
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
 * Check if customer has unlocked Cidadela for a restaurant
 */
export async function hasCidadelaAccess(
  restaurantId: string,
  customerPhone: string,
): Promise<boolean> {
  if (!customerPhone) return false;
  const { data } = await supabase
    .from("cidadela_unlocks")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("customer_phone", customerPhone)
    .maybeSingle();

  return !!data;
}

/**
 * Record Cidadela unlock after confirmed order
 */
export async function unlockCidadela(
  restaurantId: string,
  orderId: string,
  customerPhone: string,
): Promise<boolean> {
  const { error } = await supabase.from("cidadela_unlocks").insert({
    restaurant_id: restaurantId,
    order_id: orderId,
    customer_phone: customerPhone,
  });

  if (error) {
    // Might already be unlocked (unique constraint), that's ok
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
