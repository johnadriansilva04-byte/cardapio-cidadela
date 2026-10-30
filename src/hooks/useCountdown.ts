import { useEffect, useState } from "react";

/** Formata uma diferença em ms como HH:MM:SS (zero à esquerda, nunca negativo). */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Cronômetro regressivo até `until` (ISO), atualizado a cada segundo.
 *
 * Devolve `null` quando não há data, a data é inválida ou já venceu — assim o
 * chamador simplesmente não renderiza o contador. O intervalo é limpo no
 * unmount para não atualizar estado de componente desmontado.
 */
export function useCountdown(until: string | null | undefined, enabled = true): string | null {
  const target = until ? Date.parse(until) : NaN;
  const valid = enabled && Number.isFinite(target);

  const [text, setText] = useState<string | null>(() =>
    valid ? formatCountdown(target - Date.now()) : null,
  );

  useEffect(() => {
    if (!valid) {
      setText(null);
      return;
    }
    const tick = () => {
      const left = target - Date.now();
      setText(left > 0 ? formatCountdown(left) : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, valid]);

  return text;
}
