import { hexToRgba } from "@/lib/utils";

/** Luminância relativa (0 = preto, 1 = branco) — decide claro/escuro pelo accent. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(h.slice(0, 2), 16));
  const g = channel(parseInt(h.slice(2, 4), 16));
  const b = channel(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Selo circular "Conheça a Cidadela" — discreto, translúcido, sem competir
 * com a capa do restaurante.
 *
 * Mantém a identidade (borda neon azul fixa + cadeado) mas com cara de selo:
 * pequeno, fundo escuro semitransparente com blur, glow suave. O tema das
 * letras continua deduzido da luminância do accent (claro → letras escuras,
 * escuro → cor do accent), e a borda nunca usa o accent (pode ser vivo).
 */
export function CidadelaBadge({
  accent,
  href = "https://pracinha.online",
  theme,
  className = "",
}: {
  accent: string;
  href?: string;
  /** Tema do cardápio; se omitido, é deduzido do accent. */
  theme?: "light" | "dark";
  className?: string;
}) {
  const isLight = theme ? theme === "light" : luminance(accent) > 0.6;
  // Neon discreto e fixo: o accent pode ser amarelo/vivo, então a borda usa o
  // azul da identidade Cidadela para não ficar chamativa.
  const neon = "#22d3ee";
  const face = isLight ? "rgba(229, 231, 235, 0.92)" : "rgba(28, 28, 36, 0.85)";
  const label = isLight ? "#0b0b12" : accent;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conheça a Cidadela"
      className={`group relative flex size-11 shrink-0 items-center justify-center rounded-full backdrop-blur-sm transition-transform hover:scale-105 active:scale-95 sm:size-12 ${className}`}
      style={{
        background: face,
        border: `1.5px solid ${neon}`,
        boxShadow: `0 0 8px ${hexToRgba(neon, 0.22)}, 0 2px 10px rgba(0,0,0,0.4)`,
      }}
    >
      <span className="relative flex flex-col items-center justify-center px-1 text-center">
        <span
          className="text-[6.5px] font-black leading-none tracking-[0.12em]"
          style={{ color: label, opacity: 0.65 }}
        >
          CONHEÇA
        </span>
        <span
          className="mt-0.5 text-[8.5px] font-black leading-none tracking-[0.08em]"
          style={{ color: label }}
        >
          CIDADELA
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={neon}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 size-2.5"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
    </a>
  );
}
