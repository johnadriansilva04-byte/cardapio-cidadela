import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useOwnerOrders, type UseOwnerOrdersResult } from "@/modules/mobile/useOwnerOrders";
import { useStoreUsage } from "@/modules/mobile/useStoreUsage";
import { isOpenNow } from "@/lib/operatingHours";
import { readStoredStoreId } from "@/modules/store/active-store-storage";

export interface MobileStoreValue extends UseOwnerOrdersResult {
  /** Loja ativa da conta — a escolhida no painel, senão a primeira. */
  primary: UseOwnerOrdersResult["restaurants"][number] | undefined;
  /** Aberto/fechado conforme o horário de funcionamento da loja ativa. */
  openNow: boolean;
}

const MobileStoreContext = createContext<MobileStoreValue | null>(null);

/**
 * Uma única carga de restaurantes + pedidos para todas as abas do mobile.
 *
 * Antes cada aba chamava `useOwnerOrders` por conta própria, então trocar de
 * aba repetia as consultas e o cabeçalho não tinha como mostrar o estado da
 * loja sem uma segunda carga.
 */
export function MobileStoreProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: ReactNode;
}) {
  const data = useOwnerOrders(userId);
  // Mesma loja ativa do painel: o mobile não tem seletor próprio, então segue
  // a escolha lembrada no dispositivo para as duas telas não divergirem.
  const storedId = readStoredStoreId();
  const primary = data.restaurants.find((r) => r.id === storedId) ?? data.restaurants[0];
  const openNow = Boolean(primary && isOpenNow(primary.operating_hours));

  // Tempo online da loja (para as recompensas): só conta com o painel visível
  // e a loja aberta. Uma única carga serve todas as abas do mobile.
  useStoreUsage(primary?.id, primary?.operating_hours ?? null);

  const value = useMemo<MobileStoreValue>(
    () => ({ ...data, primary, openNow }),
    [data, primary, openNow],
  );

  return <MobileStoreContext.Provider value={value}>{children}</MobileStoreContext.Provider>;
}

export function useMobileStore(): MobileStoreValue {
  const context = useContext(MobileStoreContext);
  if (!context) {
    throw new Error("useMobileStore precisa estar dentro de MobileStoreProvider.");
  }
  return context;
}
