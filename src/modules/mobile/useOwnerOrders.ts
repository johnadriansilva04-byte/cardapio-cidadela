import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/modules/supabase/client";
import { getRestaurantsByOwner } from "@/modules/supabase/restaurants";
import {
  getOrdersByRestaurants,
  getOrderById,
  subscribeToOrders,
  getOwnerLockedStores,
} from "@/modules/supabase/orders";
import { maybeAutoPrintOrder } from "@/modules/mobile/autoPrint";
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
  /** Restaurantes com a cota do plano gratuito estourada (detalhes bloqueados). */
  lockedStores: Set<string>;
  /** Pedidos que acabaram de chegar (realce temporário na lista). */
  freshIds: Set<string>;
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
  const [lockedStores, setLockedStores] = useState<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
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
      const [owned, locked] = await Promise.all([
        getRestaurantsByOwner(userId),
        getOwnerLockedStores(),
      ]);
      if (!aliveRef.current) return;
      setRestaurants(owned);
      setLockedStores(locked);

      if (owned.length === 0) {
        setOrders([]);
        return;
      }

      const all = await getOrdersByRestaurants(owned.map((r) => r.id));
      if (!aliveRef.current) return;
      setOrders(all);
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
    const [all, locked] = await Promise.all([
      getOrdersByRestaurants(restaurants.map((r) => r.id)),
      getOwnerLockedStores(),
    ]);
    if (!aliveRef.current) return;
    setLockedStores(locked);
    setOrders(all);
  }, [restaurants]);

  // O payload do realtime traz só a linha de `orders`, sem `order_items`. Sem
  // isto o card do pedido novo aparece sem os itens (só ao abrir o detalhe).
  const hydrateOrder = useCallback(async (id: string) => {
    try {
      const full = await getOrderById(id);
      if (!full || !aliveRef.current) return;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === id);
        if (idx === -1) {
          return [full, ...prev].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
        }
        const next = [...prev];
        next[idx] = { ...next[idx], ...full };
        return next;
      });
    } catch {
      /* best-effort */
    }
  }, []);

  const restaurantNames = useMemo(
    () => new Map(restaurants.map((r) => [r.id, r.name])),
    [restaurants],
  );
  // Guardado num ref porque o efeito de realtime não depende de `restaurants`:
  // referenciar o memo direto deixaria o callback com o nome preso no primeiro
  // render. O realtime só precisa do valor atual no momento do INSERT.
  const restaurantNamesRef = useRef(restaurantNames);
  restaurantNamesRef.current = restaurantNames;

  // Assina por lista de ids (string) para um refresh que recria o array de
  // restaurantes não derrubar e recriar os canais à toa.
  const restaurantIds = useMemo(() => restaurants.map((r) => r.id).join(","), [restaurants]);

  // Tempo real: sem isto a lista só mudava no mount, então o alerta tocava mas
  // o pedido novo só aparecia depois de recarregar a página.
  useEffect(() => {
    const channels: RealtimeChannel[] = [];
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const freshTimers = new Set<ReturnType<typeof setTimeout>>();

    for (const id of restaurantIds.split(",").filter(Boolean)) {
      const channel = subscribeToOrders(
        id,
        (eventType, order) => {
          if (eventType === "INSERT") {
            setOrders((prev) => {
              if (prev.some((o) => o.id === order.id)) return prev;
              return [order, ...prev].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              );
            });
            // O realtime não traz os itens: hidrata para o card já nascer completo.
            void hydrateOrder(order.id);
            // Realça o recém-chegado por 20s — no celular o alerta toca, mas
            // sem isso o operador não localiza o card na lista.
            setFreshIds((prev) => new Set(prev).add(order.id));
            const timer = setTimeout(() => {
              freshTimers.delete(timer);
              setFreshIds((prev) => {
                const next = new Set(prev);
                next.delete(order.id);
                return next;
              });
            }, 20000);
            freshTimers.add(timer);
            // Imprime a comanda sozinho quando o dispositivo pedir (a função
            // está desligada por padrão e deduplica por id).
            maybeAutoPrintOrder(order, restaurantNamesRef.current.get(order.restaurant_id) ?? "");
            return;
          }
          // UPDATE/DELETE em rajada: uma revalidação por lote basta.
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => void reloadOrders(), 400);
        },
        "mobile_orders",
      );
      if (channel) channels.push(channel);
    }

    return () => {
      if (debounce) clearTimeout(debounce);
      // Sem limpar os timers de realce, o callback dispara após o unmount e
      // mexe no estado de um componente que já saiu da árvore.
      for (const t of freshTimers) clearTimeout(t);
      for (const channel of channels) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [restaurantIds, reloadOrders, hydrateOrder]);

  return {
    restaurants,
    orders,
    loading,
    error,
    refresh,
    reloadOrders,
    restaurantNames,
    lockedStores,
    freshIds,
  };
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
    // Ids já conhecidos. Serve de rede de segurança: se o WebSocket cair, o
    // poll periódico encontra o pedido que o realtime não entregou e ainda
    // dispara o alerta. Sem isto o contador ficava certo mas o som/normal
    // notificação não tocava — o pior caso para quem está no balcão.
    const knownIds = new Set<string>();
    let seeded = false;
    // Os ids das lojas não mudam durante a sessão: buscá-los uma vez evita uma
    // consulta extra a cada poll de 15s (eram 2 idas ao banco por tick).
    let restaurantIds: string[] | null = null;

    const countActive = async () => {
      try {
        if (restaurantIds === null) {
          const rests = await getRestaurantsByOwner(userId);
          if (cancelled) return;
          restaurantIds = rests.map((r) => r.id);
        }
        if (restaurantIds.length === 0) {
          setPendingCount(0);
          return;
        }
        const { data, error } = await supabase
          .from("orders")
          .select("id, restaurant_id, customer_name, comanda, total, status, created_at")
          .in("restaurant_id", restaurantIds)
          .in("status", ["received", "preparing", "ready", "out_for_delivery"]);
        if (cancelled || error) return;
        const rows = data ?? [];
        if (!seeded) {
          // Primeira carga: os pedidos que já existiam não são "novos".
          for (const row of rows) knownIds.add(row.id);
          seeded = true;
        } else {
          for (const row of rows) {
            if (!knownIds.has(row.id)) {
              knownIds.add(row.id);
              callbackRef.current?.(row as unknown as Order);
            }
          }
        }
        setPendingCount(rows.length);
      } catch {
        /* realtime/count é best-effort */
      }
    };

    const scheduleCount = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(countActive, 380);
    };

    const pollTick = () => {
      // Aba escondida não gasta consulta; o visibilitychange revalida na volta.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void countActive();
    };

    (async () => {
      try {
        await countActive();
        if (cancelled) return;
        const rests = await getRestaurantsByOwner(userId);
        if (cancelled) return;

        for (const restaurant of rests) {
          const channel = subscribeToOrders(
            restaurant.id,
            (eventType, order) => {
              if (eventType === "INSERT") {
                // Marca como conhecido para o poll não disparar o alerta de novo.
                knownIds.add(order.id);
                if (["received", "preparing", "ready", "out_for_delivery"].includes(order.status)) {
                  setPendingCount((count) => count + 1);
                }
                callbackRef.current?.(order);
                return;
              }
              scheduleCount();
            },
            "mobile_badge",
          );
          if (!cancelled) channels.push(channel);
        }
      } catch {
        /* canal realtime indisponível */
      }
    })();

    polling = setInterval(pollTick, 15000);

    // Voltar para a aba revalida na hora: o navegador congela o WebSocket em
    // segundo plano, então o pedido que chegou nesse intervalo só apareceria
    // no próximo poll (até 15s de silêncio).
    const onVisible = () => {
      if (document.visibilityState === "visible") void countActive();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      if (polling) clearInterval(polling);
      document.removeEventListener("visibilitychange", onVisible);
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
