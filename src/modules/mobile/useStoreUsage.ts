import { useEffect, useRef } from "react";
import { isOpenNow } from "@/lib/operatingHours";
import { bumpUsage } from "@/modules/supabase/rewards";
import type { OperatingHours } from "@/lib/operatingHours";

/**
 * Conta o tempo online da loja para as recompensas por engajamento.
 *
 * Só conta enquanto o painel está VISÍVEL e a loja está ABERTA (dentro do
 * horário de funcionamento) — é o "tempo online da loja", não o tempo do dono
 * com a aba aberta fora de hora. O batimento vai a cada minuto; o servidor
 * aplica o teto (120s por chamada), então não dá para inflar pelo cliente.
 *
 * É best-effort: qualquer falha é ignorada e a operação segue.
 */
export function useStoreUsage(
  restaurantId: string | undefined,
  hours: OperatingHours | null | undefined,
): void {
  const hoursRef = useRef(hours);
  hoursRef.current = hours;
  const lastTick = useRef<number>(Date.now());

  useEffect(() => {
    if (!restaurantId || typeof document === "undefined") return;

    const flush = () => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTick.current) / 1000);
      lastTick.current = now;
      if (elapsed <= 0) return;
      if (document.visibilityState !== "visible") return;
      if (!isOpenNow(hoursRef.current)) return;
      void bumpUsage(restaurantId, elapsed);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastTick.current = Date.now();
      } else {
        flush();
      }
    };

    const interval = window.setInterval(flush, 60_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [restaurantId]);
}
