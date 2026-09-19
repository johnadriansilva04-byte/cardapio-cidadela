import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getCustomerOrders, getSovereigntyBalances } from "@/modules/supabase/customer";
import type { SovereigntyBalance } from "@/lib/loyalty";
import type { GuestOrderSummary } from "@/lib/types";

const SOV_PER_REAL = 30;

/**
 * Dados da aba Perfil: histórico real (conta ou convidado) e saldo de SOV.
 *
 * O total de SOV é somado entre restaurantes porque o cliente pensa no
 * programa como um todo; o detalhe por restaurante fica disponível para
 * quando houver mais de um.
 */
export function useCustomerProfile() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<GuestOrderSummary[]>([]);
  const [balances, setBalances] = useState<SovereigntyBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [orderList, balanceList] = await Promise.all([
      getCustomerOrders(user?.id),
      user ? getSovereigntyBalances() : Promise.resolve([]),
    ]);
    setOrders(orderList);
    setBalances(balanceList);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalPoints = balances.reduce((sum, b) => sum + b.balance, 0);
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
  const lastOrder = orders[0] ?? null;
  // Estimativa do próximo ponto, útil como incentivo no perfil.
  const pointsToNext = SOV_PER_REAL - (totalSpent % SOV_PER_REAL);

  return {
    user,
    profile,
    orders,
    balances,
    loading,
    reload,
    totalPoints,
    totalOrders,
    totalSpent,
    lastOrder,
    pointsToNext,
  };
}
