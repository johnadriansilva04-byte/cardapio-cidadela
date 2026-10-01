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
 * Selo circular "Conheça a Cidadela" — presença viva, porém discreta.
 *
 * Identidade Cidadela (neon azul + cadeado) com cara de selo premium: halo
 * neon, anel em expansão duplo, arco de luz girando na borda e varredura
 * contínua. Movimento de baixa intensidade para chamar atenção sem virar
 * propaganda. Respeita `prefers-reduced-motion`.
 *
 * O tema das letras é deduzido da luminância do accent (claro → letras
 * escuras, escuro → cor do accent), e a borda nunca usa o accent (pode ser
 * vivo).
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
  const face = isLight
    ? "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(226,232,240,0.9))"
    : "linear-gradient(160deg, rgba(38,38,50,0.92), rgba(14,14,22,0.88))";
  const label = isLight ? "#0b0b12" : accent;

  // O selo nasce `relative` (para conter aura/aneis), mas quem chama pode querer
  // posicioná-lo. Como `.relative` vence `.absolute` na ordem do CSS, deixamos a
  // classe de posicionamento por conta do chamador quando ela existir.
  const positioned = /\b(absolute|fixed|sticky|relative)\b/.test(className);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conheça a Cidadela"
      className={`cidadela-seal group flex size-16 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition-transform duration-300 hover:scale-[1.06] active:scale-95 sm:size-[4.5rem] ${positioned ? "" : "relative"} ${className}`}
      style={{
        background: face,
        border: `1.5px solid ${neon}`,
      }}
    >
      <span aria-hidden className="cidadela-aura" />
      <span aria-hidden className="cidadela-ring" />
      <span aria-hidden className="cidadela-ring cidadela-ring--late" />
      <span aria-hidden className="cidadela-orbit" />
      <span aria-hidden className="cidadela-core" />
      <span aria-hidden className="cidadela-sheen" />
      <span className="relative flex flex-col items-center justify-center text-center">
        <span
          className="text-[7px] font-black leading-none tracking-[0.18em]"
          style={{ color: label, opacity: 0.72 }}
        >
          CONHEÇA
        </span>
        <span
          className="mt-1 text-[10.5px] font-black leading-none tracking-[0.02em]"
          style={{ color: label }}
        >
          CIDADELA
        </span>
        <span
          aria-hidden
          className="mt-1 h-px w-6 rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${neon}88, transparent)` }}
        />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={neon}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-1 size-3.5 drop-shadow-[0_0_4px_rgba(34,211,238,0.7)]"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
    </a>
  );
}
