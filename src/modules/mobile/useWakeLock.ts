import { useEffect, useState } from "react";

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
}

export type WakeLockSupport = "unsupported" | "idle" | "active" | "blocked";

/** true quando a API de wake lock existe neste navegador. */
export function isWakeLockSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean((navigator as NavigatorWithWakeLock).wakeLock);
}

/**
 * Mantém a tela ligada enquanto o painel está aberto.
 *
 * O navegador solta o lock sozinho quando a aba vai para segundo plano, então
 * reativamos na volta do `visibilitychange`. Sem suporte (Safari antigo, iOS),
 * devolvemos "unsupported" para a UI explicar em vez de prometer o que não tem.
 */
export function useWakeLock(enabled: boolean): WakeLockSupport {
  const [status, setStatus] = useState<WakeLockSupport>("idle");

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) {
      setStatus("unsupported");
      return;
    }

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        sentinel = await nav.wakeLock!.request("screen");
        if (cancelled) {
          void sentinel.release();
          sentinel = null;
          return;
        }
        setStatus("active");
        sentinel.addEventListener("release", () => {
          if (!cancelled) sentinel = null;
        });
      } catch {
        if (!cancelled) setStatus("blocked");
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible" && !sentinel) void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [enabled]);

  return status;
}
