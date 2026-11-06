import { useEffect } from "react";
import { touchLastSeen } from "@/modules/supabase/auth";

/** Um batimento por sessão de aba é suficiente para marcar a conta como ativa. */
const PING_KEY = "cidadela:last-presence-ping";
const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

/**
 * Marca a conta como ativa quando o dono abre o painel.
 *
 * É o sinal que protege contra a limpeza de contas inativas: sem ele, um dono
 * que só abre o painel (sem receber pedido) seria tratado como inativo. O
 * batimento é espaçado por `localStorage` para não escrever a cada navegação —
 * a granularidade que importa é o dia, não o clique.
 */
export function usePresencePing(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    try {
      const last = Number(window.localStorage.getItem(PING_KEY) || 0);
      if (Date.now() - last < MIN_INTERVAL_MS) return;
      window.localStorage.setItem(PING_KEY, String(Date.now()));
    } catch {
      /* localStorage indisponível — cai no ping direto */
    }
    void touchLastSeen();
  }, [enabled]);
}
