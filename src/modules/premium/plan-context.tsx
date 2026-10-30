import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { checkSubscriptionStatus } from "@/modules/supabase/subscription";
import type { SubscriptionStatus } from "@/lib/types";

interface PlanContextValue {
  /** Status do plano da loja ativa (null enquanto carrega ou sem loja). */
  status: SubscriptionStatus | null;
  loading: boolean;
  /** Recarrega agora (ignora a janela de dedupe). */
  refresh: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

/** Janela mínima entre recargas — o status não muda a cada troca de aba. */
const REFRESH_MS = 30_000;

/**
 * Status do plano compartilhado por todas as telas de um layout.
 *
 * O selo de plano aparece no cabeçalho de toda tela, então a consulta fica
 * aqui, uma vez por layout, em vez de cada tela buscar o próprio status.
 */
export function PlanProvider({ storeId, children }: { storeId?: string; children: ReactNode }) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(storeId));
  const lastFetch = useRef(0);

  const load = useCallback(
    async (force = false) => {
      if (!storeId) {
        setStatus(null);
        setLoading(false);
        return;
      }
      const now = Date.now();
      if (!force && now - lastFetch.current < REFRESH_MS) return;
      lastFetch.current = now;
      try {
        setStatus(await checkSubscriptionStatus(storeId));
      } catch {
        /* best-effort: sem status o selo simplesmente não aparece */
      } finally {
        setLoading(false);
      }
    },
    [storeId],
  );

  useEffect(() => {
    lastFetch.current = 0;
    setLoading(Boolean(storeId));
    void load(true);
  }, [load, storeId]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void load(true), 5 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [load]);

  const value = useMemo<PlanContextValue>(
    () => ({ status, loading, refresh: () => void load(true) }),
    [status, loading, load],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error("usePlan precisa estar dentro de PlanProvider.");
  }
  return ctx;
}
