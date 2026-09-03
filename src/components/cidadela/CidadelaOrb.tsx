import { useState } from "react";

interface CidadelaOrbProps {
  unlocked: boolean;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}

export function CidadelaOrb({ unlocked, onClick, size = "md" }: CidadelaOrbProps) {
  const [showUnlock, setShowUnlock] = useState(false);

  const sizeClasses = {
    sm: "size-14",
    md: "size-20",
    lg: "size-28",
  };

  const textSizes = {
    sm: "text-[7px]",
    md: "text-[9px]",
    lg: "text-[11px]",
  };

  const iconSizes = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8",
  };

  return (
    <button
      onClick={onClick}
      className={`relative ${sizeClasses[size]} transition-all hover:scale-105 active:scale-95`}
      aria-label="Conheça a Cidadela"
    >
      {/* Neon glow pulse */}
      <span
        className={`absolute inset-0 rounded-full ${
          unlocked
            ? "bg-cyan-400/50 shadow-[0_0_30px_rgba(34,211,238,0.8)]"
            : "animate-[lock-pulse_2.6s_ease-out_infinite] bg-cyan-400/60"
        }`}
      />

      {/* Orb body */}
      <span
        className={`relative flex ${sizeClasses[size]} flex-col items-center justify-center rounded-full border-2 ${
          unlocked
            ? "border-cyan-300 bg-black/80 shadow-[0_0_40px_rgba(34,211,238,0.6)]"
            : "border-cyan-400 bg-black/70 shadow-[0_0_30px_rgba(34,211,238,0.5)]"
        }`}
      >
        <span
          className={`${textSizes[size]} px-1 text-center font-bold leading-tight tracking-tight text-cyan-300`}
        >
          CONHEÇA A
          <br />
          CIDADELA
        </span>

        {/* Lock or unlock icon */}
        {unlocked ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`mt-1 ${iconSizes[size]} text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]`}
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            <path d="M10 11l2 2 4-4" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`mt-1 ${iconSizes[size]} text-yellow-400`}
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        )}
      </span>

      {/* Show unlock animation */}
      {showUnlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowUnlock(false)}
        >
          <div className="text-center">
            <div className="mx-auto size-24 rounded-full border-2 border-cyan-300 bg-black/90 shadow-[0_0_60px_rgba(34,211,238,0.8)]">
              <div className="flex size-full flex-col items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="size-10 text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.8)]"
                >
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  <path d="M10 11l2 2 4-4" />
                </svg>
              </div>
            </div>
            <p className="mt-4 text-lg font-bold text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
              CIDADELA DESBLOQUEADA
            </p>
            <p className="mt-2 text-sm text-cyan-200/70">
              Obrigado por realizar seu pedido!
            </p>
          </div>
        </div>
      )}
    </button>
  );
}

/**
 * Trigger the Cidadela unlock animation externally
 */
export function showCidadelaUnlock() {
  // Dispatch a custom event that CidadelaOrb instances can listen to
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cidadela-unlock"));
  }
}
