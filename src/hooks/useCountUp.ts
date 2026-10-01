import { useEffect, useMemo, useRef, useState } from "react";

/** Extrai a parte numérica de um texto formatado (ex.: "R$ 1.234,56" → 1234.56). */
export function parseNumericValue(
  value: string,
): { prefix: string; num: number; suffix: string } | null {
  const match = value.match(/^(.*?)([\d.,]+)(.*)$/);
  if (!match) return null;
  const num = Number(match[2].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(num)) return null;
  return { prefix: match[1], num, suffix: match[3] };
}

/** Formata em pt-BR mantendo as casas decimais só quando existem. */
export function formatNumeric(n: number): string {
  const int = Math.floor(n);
  const dec = n - int;
  const intStr = int.toLocaleString("pt-BR");
  return dec > 0.004
    ? `${intStr},${Math.round(dec * 100)
        .toString()
        .padStart(2, "0")}`
    : intStr;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Anima um número de 0 até o alvo na montagem — e de volta ao alvo quando ele
 * muda, para o valor nunca "pular" sem contexto. Textos sem número (contagens
 * escritas, rótulos) passam intactos.
 */
export function useCountUp(value: string | number, duration = 700): string | number {
  const target = useMemo(() => {
    if (typeof value === "number") return { prefix: "", num: value, suffix: "" };
    return parseNumericValue(value);
  }, [value]);

  const [display, setDisplay] = useState(0);
  const lastTarget = useRef<number | null>(null);

  useEffect(() => {
    if (!target) return;
    if (lastTarget.current === target.num) return;
    const from = lastTarget.current ?? 0;
    lastTarget.current = target.num;

    if (prefersReducedMotion()) {
      setDisplay(target.num);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(from + (target.num - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  if (!target) return value;
  if (typeof value === "number") {
    return Number.isInteger(value) ? Math.round(display) : formatNumeric(display);
  }
  return `${target.prefix}${formatNumeric(display)}${target.suffix}`;
}
