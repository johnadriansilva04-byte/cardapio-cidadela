import { cn } from "@/lib/utils";

export type PracinhaMood = "idle" | "thinking" | "cheer" | "worried" | "sleep";

/**
 * Pracinha com prancheta — versão menor para o teste de QI
 */
export function PracinhaWithClipboard({
  mood = "idle",
  className,
}: {
  mood?: PracinhaMood;
  className?: string;
}) {
  const eyeShape = () => {
    switch (mood) {
      case "cheer":
        return (
          <>
            <path
              d="M62 78 q8 -10 16 0"
              stroke="var(--pracinha-eye)"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M102 78 q8 -10 16 0"
              stroke="var(--pracinha-eye)"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
          </>
        );
      case "sleep":
        return (
          <>
            <path
              d="M62 80 h16"
              stroke="var(--pracinha-eye)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M102 80 h16"
              stroke="var(--pracinha-eye)"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </>
        );
      case "worried":
        return (
          <>
            <circle cx="70" cy="80" r="7" fill="var(--pracinha-eye)" />
            <circle cx="110" cy="80" r="7" fill="var(--pracinha-eye)" />
            <path
              d="M58 66 l16 6"
              stroke="var(--pracinha-eye)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M122 66 l-16 6"
              stroke="var(--pracinha-eye)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        );
      case "thinking":
        return (
          <>
            <circle cx="74" cy="78" r="8" fill="var(--pracinha-eye)" />
            <circle cx="114" cy="78" r="8" fill="var(--pracinha-eye)" />
            <circle cx="77" cy="75" r="2.6" fill="var(--pracinha-visor)" />
            <circle cx="117" cy="75" r="2.6" fill="var(--pracinha-visor)" />
          </>
        );
      default:
        return (
          <>
            <circle cx="70" cy="79" r="9" fill="var(--pracinha-eye)" />
            <circle cx="110" cy="79" r="9" fill="var(--pracinha-eye)" />
            <circle cx="73" cy="75.5" r="3" fill="var(--pracinha-visor)" />
            <circle cx="113" cy="75.5" r="3" fill="var(--pracinha-visor)" />
          </>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 180 260"
      className={cn("pracinha", mood === "sleep" && "pracinha--sleep", className)}
      role="img"
      aria-label="Pracinha com prancheta"
    >
      <defs>
        <linearGradient id="pracinha-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pracinha-shell-light)" />
          <stop offset="100%" stopColor="var(--pracinha-shell-dark)" />
        </linearGradient>
        <linearGradient id="pracinha-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--pracinha-visor)" />
          <stop offset="100%" stopColor="var(--pracinha-visor-deep)" />
        </linearGradient>
        <radialGradient id="pracinha-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--pracinha-accent)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--pracinha-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="90" cy="246" rx="46" ry="8" fill="var(--pracinha-shadow)" />
      <circle cx="90" cy="90" r="80" fill="url(#pracinha-glow)" />

      <g className="pracinha__float">
        {/* pernas */}
        <g>
          <rect x="62" y="196" width="16" height="30" rx="8" fill="var(--pracinha-joint)" />
          <rect x="102" y="196" width="16" height="30" rx="8" fill="var(--pracinha-joint)" />
          <rect x="52" y="222" width="34" height="16" rx="8" fill="url(#pracinha-body)" />
          <rect x="94" y="222" width="34" height="16" rx="8" fill="url(#pracinha-body)" />
        </g>

        {/* braço esquerdo normal */}
        <g className="pracinha__arm-left">
          <rect x="18" y="140" width="14" height="46" rx="7" fill="var(--pracinha-joint)" />
          <circle cx="25" cy="192" r="11" fill="url(#pracinha-body)" />
        </g>

        {/* braço direito segurando prancheta */}
        <g className="pracinha__arm-right">
          <rect x="148" y="140" width="14" height="46" rx="7" fill="var(--pracinha-joint)" />
          <circle cx="155" cy="192" r="11" fill="url(#pracinha-body)" />
          {/* prancheta */}
          <rect
            x="145"
            y="160"
            width="28"
            height="40"
            rx="3"
            fill="var(--pracinha-clipboard)"
            stroke="var(--pracinha-joint)"
            strokeWidth="2"
          />
          {/* linhas na prancheta */}
          <line
            x1="150"
            y1="170"
            x2="168"
            y2="170"
            stroke="var(--pracinha-clipboard-line)"
            strokeWidth="2"
          />
          <line
            x1="150"
            y1="178"
            x2="168"
            y2="178"
            stroke="var(--pracinha-clipboard-line)"
            strokeWidth="2"
          />
          <line
            x1="150"
            y1="186"
            x2="162"
            y2="186"
            stroke="var(--pracinha-clipboard-line)"
            strokeWidth="2"
          />
        </g>

        {/* tronco + camiseta */}
        <rect x="36" y="122" width="108" height="82" rx="26" fill="url(#pracinha-body)" />
        <path
          d="M52 132 q38 22 76 0 v46 a20 20 0 0 1 -20 20 h-36 a20 20 0 0 1 -20 -20 z"
          fill="var(--pracinha-shirt)"
        />
        <text
          x="90"
          y="180"
          textAnchor="middle"
          fontSize="42"
          fontWeight="800"
          fontFamily="var(--font-display)"
          fill="var(--pracinha-shirt-ink)"
        >
          P
        </text>

        {/* pescoço */}
        <rect x="80" y="110" width="20" height="16" rx="6" fill="var(--pracinha-joint)" />

        {/* cabeça */}
        <rect x="34" y="40" width="112" height="76" rx="30" fill="url(#pracinha-body)" />
        <rect x="46" y="54" width="88" height="48" rx="22" fill="url(#pracinha-visor)" />
        {eyeShape()}
        <path
          d="M78 96 q12 9 24 0"
          stroke="var(--pracinha-eye)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          opacity={mood === "worried" ? 0 : 0.85}
        />
        {mood === "worried" && (
          <path
            d="M78 100 q12 -9 24 0"
            stroke="var(--pracinha-eye)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* orelhas */}
        <rect x="24" y="66" width="12" height="26" rx="6" fill="var(--pracinha-joint)" />
        <rect x="144" y="66" width="12" height="26" rx="6" fill="var(--pracinha-joint)" />

        {/* antena */}
        <rect x="86" y="18" width="8" height="24" rx="4" fill="var(--pracinha-joint)" />
        <circle cx="90" cy="14" r="9" fill="var(--pracinha-accent)" className="pracinha__bulb" />
      </g>
    </svg>
  );
}
