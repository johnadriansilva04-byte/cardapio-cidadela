import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { STATE_STORAGE_KEY, loadFromIndexedDB, mergeState, saveToIndexedDB } from "@/lib/storage";
import { DEFAULT_STATE, type AppState, type SoberaniaTransaction } from "@/lib/types";

interface StoreContextValue {
  state: AppState;
  ready: boolean;
  online: boolean;
  update: (patch: (prev: AppState) => AppState) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Only load from IndexedDB on client side
    if (typeof window === 'undefined') {
      setReady(true);
      return;
    }
    let alive = true;
    loadFromIndexedDB<Partial<AppState>>(STATE_STORAGE_KEY).then((persisted) => {
      if (!alive) return;
      setState(mergeState(persisted));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void saveToIndexedDB(STATE_STORAGE_KEY, state);
  }, [state, ready]);

  useEffect(() => {
    // Only add event listeners on client side
    if (typeof window === 'undefined') return;
    const sync = () => {
      setOnline(navigator.onLine);
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const update = useCallback((patch: (prev: AppState) => AppState) => {
    setState((prev) => patch(prev));
  }, []);

  // Funções para gerenciar pontos de soberania
  const addSoberaniaPoints = useCallback((amount: number, reason: string, source: SoberaniaTransaction["source"]) => {
    update((prev) => ({
      ...prev,
      soberania: {
        ...prev.soberania,
        points: prev.soberania.points + amount,
        history: [
          {
            id: crypto.randomUUID(),
            type: "earned",
            amount,
            reason,
            timestamp: new Date().toISOString(),
            source,
          },
          ...prev.soberania.history,
        ],
      },
    }));
  }, [update]);

  const removeSoberaniaPoints = useCallback((amount: number, reason: string, source: SoberaniaTransaction["source"]) => {
    update((prev) => ({
      ...prev,
      soberania: {
        ...prev.soberania,
        points: Math.max(0, prev.soberania.points - amount),
        history: [
          {
            id: crypto.randomUUID(),
            type: "lost",
            amount,
            reason,
            timestamp: new Date().toISOString(),
            source,
          },
          ...prev.soberania.history,
        ],
      },
    }));
  }, [update]);

  const value = useMemo(() => ({ 
    state, 
    ready, 
    online, 
    update,
    addSoberaniaPoints,
    removeSoberaniaPoints,
  }), [state, ready, online, update, addSoberaniaPoints, removeSoberaniaPoints]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de <StoreProvider>");
  return ctx;
}
