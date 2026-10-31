import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ensureRestaurantsForUser, getRestaurantsByOwner } from "@/modules/supabase/restaurants";
import { persistStoreId, readStoredStoreId } from "@/modules/store/active-store-storage";
import type { Restaurant } from "@/lib/types";

interface ActiveStoreValue {
  /** Todas as lojas do dono. */
  restaurants: Restaurant[];
  /** Loja ativa (a lembrada, se ainda existir; senão a primeira). */
  active: Restaurant | null;
  activeId: string | undefined;
  /** Troca a loja ativa e lembra a escolha no dispositivo. */
  setActiveId: (id: string) => void;
  /** Recarrega a lista (após criar/excluir uma loja). */
  reload: () => void;
  loading: boolean;
}

const ActiveStoreContext = createContext<ActiveStoreValue | null>(null);

/**
 * Loja ativa única para todo o painel.
 *
 * Antes cada tela escolhia a própria loja (`data[0]`, um estado local ou um
 * filtro "todas"), então trocar de loja no dashboard não mudava Pedidos nem
 * Financeiro — o dono via números de lojas diferentes na mesma sessão. Aqui a
 * escolha é uma só, vive acima das rotas e sobrevive ao recarregar.
 */
export function ActiveStoreProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: ReactNode;
}) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeId, setActiveIdState] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!userId) {
      setRestaurants([]);
      setActiveIdState(undefined);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await ensureRestaurantsForUser({ id: userId });
        if (cancelled) return;
        const data = await getRestaurantsByOwner(userId);
        if (cancelled) return;
        setRestaurants(data);
        // Mantém a loja lembrada só enquanto ela existir; senão cai na primeira.
        const stored = readStoredStoreId();
        const next = data.some((r) => r.id === stored) ? (stored as string) : data[0]?.id;
        setActiveIdState(next);
      } catch {
        if (!cancelled) setRestaurants([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
    persistStoreId(id);
  }, []);

  const active = useMemo(
    () => restaurants.find((r) => r.id === activeId) ?? restaurants[0] ?? null,
    [restaurants, activeId],
  );

  const value = useMemo<ActiveStoreValue>(
    () => ({ restaurants, active, activeId: active?.id, setActiveId, reload, loading }),
    [restaurants, active, setActiveId, reload, loading],
  );

  return <ActiveStoreContext.Provider value={value}>{children}</ActiveStoreContext.Provider>;
}

export function useActiveStore(): ActiveStoreValue {
  const ctx = useContext(ActiveStoreContext);
  if (!ctx) throw new Error("useActiveStore precisa estar dentro de ActiveStoreProvider.");
  return ctx;
}
