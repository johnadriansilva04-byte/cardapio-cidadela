import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useOwnerOrders, type UseOwnerOrdersResult } from "@/modules/mobile/useOwnerOrders";
import { isOpenNow } from "@/lib/operatingHours";

export interface MobileStoreValue extends UseOwnerOrdersResult {
  /** Loja principal da conta (a primeira) — usada no cabeçalho e nos atalhos. */
  primary: UseOwnerOrdersResult["restaurants"][number] | undefined;
  /** Aberto/fechado conforme o horário de funcionamento da loja principal. */
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
  const primary = data.restaurants[0];
  const openNow = Boolean(primary && isOpenNow(primary.operating_hours));

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
