import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getCustomerOrders } from "@/modules/supabase/customer";
import { isOrderClosed } from "@/lib/guestOrder";

/** Quantos pedidos do cliente ainda estão em andamento (para o badge da barra). */
export function useActiveOrderCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const orders = await getCustomerOrders(user?.id);
      if (!alive) return;
      setCount(orders.filter((o) => !isOrderClosed(o.status)).length);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  return count;
}
