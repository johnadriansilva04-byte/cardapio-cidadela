import { hexToRgba } from "@/lib/utils";

/**
 * Selo circular "Conheça a Cidadela" — grafite/piche com neon.
 *
 * Todas as cores derivam de `accent` (a cor escolhida pelo restaurante), então
 * o selo acompanha a identidade de cada cardápio sem ajustes manuais.
 */
export function CidadelaBadge({
  accent,
  href = "https://pracinha.online",
  className = "",
}: {
  accent: string;
  href?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conheça a Cidadela"
      className={`group relative flex size-20 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 sm:size-24 ${className}`}
      style={{
        background: `radial-gradient(ellipse at 30% 30%, ${hexToRgba(accent, 0.8)} 0%, #07070b 75%)`,
        border: `2.5px solid ${accent}`,
        boxShadow: `0 0 18px ${hexToRgba(accent, 0.6)}, 0 0 40px ${hexToRgba(accent, 0.25)}, 0 4px 20px rgba(0,0,0,0.6)`,
      }}
    >
      {/* anel externo pulsante */}
      <span
        className="pointer-events-none absolute size-full animate-pulse rounded-full opacity-60"
        style={{ border: `2px solid ${hexToRgba(accent, 0.4)}`, filter: "blur(1px)" }}
      />
      {/* preenchimento interno */}
      <span
        className="absolute size-full rounded-full"
        style={{
          background: `radial-gradient(ellipse at 30% 30%, ${hexToRgba(accent, 0.25)} 0%, transparent 60%)`,
        }}
      />
      {/* textura de spray */}
      <span
        className="pointer-events-none absolute inset-1 rounded-full opacity-[0.08]"
        style={{
          background: `radial-gradient(circle at 25% 65%, ${accent} 1px, transparent 1px), radial-gradient(circle at 75% 45%, ${accent} 1px, transparent 1px), radial-gradient(circle at 50% 85%, ${accent} 0.8px, transparent 0.8px)`,
        }}
      />

      <span className="relative flex flex-col items-center justify-center px-2 text-center">
        <span
          className="font-black leading-none tracking-[0.08em]"
          style={{
            fontFamily: "'Permanent Marker','Rock Salt',cursive",
            fontSize: "11px",
            color: accent,
            textShadow: `0 0 6px ${hexToRgba(accent, 0.9)}, 0 0 18px ${hexToRgba(accent, 0.5)}`,
            transform: "rotate(-3deg)",
          }}
        >
          CONHEÇA
        </span>
        <span
          className="font-black leading-none tracking-[0.12em]"
          style={{
            fontFamily: "'Permanent Marker','Rock Salt',cursive",
            fontSize: "13px",
            color: accent,
            textShadow: `0 0 8px ${hexToRgba(accent, 0.9)}, 0 0 18px ${hexToRgba(accent, 0.45)}, 1px 1px 0 rgba(0,0,0,0.8)`,
            transform: "rotate(-3deg)",
          }}
        >
          A CIDADELA
        </span>
        <span className="mt-0.5 flex items-center gap-1 opacity-90">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
            style={{ filter: `drop-shadow(0 0 4px ${hexToRgba(accent, 0.8)})` }}
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span
            className="text-[7px] font-bold tracking-[0.2em] opacity-70"
            style={{ color: accent }}
          >
            PRACINHA
          </span>
        </span>
      </span>
    </a>
  );
}
