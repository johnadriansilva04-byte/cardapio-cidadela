import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/modules/supabase/client";
import { getRestaurantsByOwner } from "@/modules/supabase/restaurants";
import { getOrdersByRestaurant, subscribeToOrders } from "@/modules/supabase/orders";
import type { Order, Restaurant } from "@/lib/types";

export interface UseOwnerOrdersResult {
  restaurants: Restaurant[];
  orders: Order[];
  loading: boolean;
  error: string | null;
  /** Busca de novo restaurantes + pedidos. */
  refresh: () => Promise<void>;
  /** Revalida só os pedidos (usado após mudança de status). */
  reloadOrders: () => Promise<void>;
  /** id do restaurante → nome, para exibir de qual loja veio o pedido. */
  restaurantNames: Map<string, string>;
}

/**
 * Carrega restaurantes do dono e todos os pedidos deles.
 *
 * Hoje isso faz uma consulta por restaurante; o `orders` do Supabase já aceita
 * `.in(restaurant_id, ids)`, então a troca é local a este hook quando o volume
 * de restaurantes por conta crescer.
 */
export function useOwnerOrders(userId: string | undefined): UseOwnerOrdersResult {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setRestaurants([]);
      setOrders([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const owned = await getRestaurantsByOwner(userId);
      if (!aliveRef.current) return;
      setRestaurants(owned);

      if (owned.length === 0) {
        setOrders([]);
        return;
      }

      const batches = await Promise.all(owned.map((r) => getOrdersByRestaurant(r.id)));
      if (!aliveRef.current) return;
      setOrders(
        batches
          .flat()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      );
    } catch (err) {
      console.error("[useOwnerOrders]", err);
      if (aliveRef.current) setError("Não foi possível carregar seus pedidos.");
    }
  }, [userId]);

  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      setLoading(true);
      await fetchAll();
      if (aliveRef.current) setLoading(false);
    })();
    return () => {
      aliveRef.current = false;
    };
  }, [fetchAll]);

  const refresh = useCallback(async () => {
    // Não mexe em `loading`: quem já está vendo a lista não deve perder o
    // conteúdo por causa de um refresh manual.
    await fetchAll();
  }, [fetchAll]);

  const reloadOrders = useCallback(async () => {
    if (restaurants.length === 0) return;
    const batches = await Promise.all(restaurants.map((r) => getOrdersByRestaurant(r.id)));
    if (!aliveRef.current) return;
    setOrders(
      batches
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    );
  }, [restaurants]);

  const restaurantNames = useMemo(
    () => new Map(restaurants.map((r) => [r.id, r.name])),
    [restaurants],
  );

  return { restaurants, orders, loading, error, refresh, reloadOrders, restaurantNames };
}

/**
 * Conta pedidos ativos em tempo real e avisa em INSERT.
 *
 * O `INSERT` incrementa o contador na hora (resposta instantânea) e o
 * `UPDATE`/`DELETE` dispara uma recontagem com debounce, para eventos em rajada
 * não gerarem uma consulta por evento. O intervalo de 15s é rede de segurança
 * para quando o canal realtime cai sem avisar.
 */
export function useOwnerPendingOrders(
  userId: string | undefined,
  onNewOrder?: (order: Order) => void,
) {
  const [pendingCount, setPendingCount] = useState(0);
  const callbackRef = useRef(onNewOrder);
  callbackRef.current = onNewOrder;

  useEffect(() => {
    if (!userId) {
      setPendingCount(0);
      return;
    }

    const channels: RealtimeChannel[] = [];
    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let polling: ReturnType<typeof setInterval> | null = null;

    const countActive = async () => {
      try {
        const rests = await getRestaurantsByOwner(userId);
        if (cancelled) return;
        if (rests.length === 0) {
          setPendingCount(0);
          return;
        }
        const { data, error } = await supabase
          .from("orders")
          .select("id")
          .in(
            "restaurant_id",
            rests.map((r) => r.id),
          )
          .in("status", ["received", "preparing", "ready", "out_for_delivery"]);
        if (cancelled || error) return;
        setPendingCount(data?.length ?? 0);
      } catch {
        /* realtime/count é best-effort */
      }
    };

    const scheduleCount = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(countActive, 380);
    };

    (async () => {
      try {
        await countActive();
        if (cancelled) return;
        const rests = await getRestaurantsByOwner(userId);
        if (cancelled) return;

        for (const restaurant of rests) {
          const channel = subscribeToOrders(restaurant.id, (eventType, order) => {
            if (eventType === "INSERT") {
              if (["received", "preparing", "ready", "out_for_delivery"].includes(order.status)) {
                setPendingCount((count) => count + 1);
              }
              callbackRef.current?.(order);
              return;
            }
            scheduleCount();
          });
          if (!cancelled) channels.push(channel);
        }
      } catch {
        /* canal realtime indisponível */
      }
    })();

    polling = setInterval(countActive, 15000);

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      if (polling) clearInterval(polling);
      for (const channel of channels) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [userId]);

  return pendingCount;
}
