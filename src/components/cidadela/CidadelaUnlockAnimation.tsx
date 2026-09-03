import { useEffect, useState } from "react";

interface CidadelaUnlockAnimationProps {
  show: boolean;
  onClose: () => void;
}

export function CidadelaUnlockAnimation({ show, onClose }: CidadelaUnlockAnimationProps) {
  const [phase, setPhase] = useState<"locked" | "glow" | "unlock" | "done">("locked");

  useEffect(() => {
    if (!show) {
      setPhase("locked");
      return;
    }

    // Sequence: glow → unlock → done
    const t1 = setTimeout(() => setPhase("glow"), 300);
    const t2 = setTimeout(() => setPhase("unlock"), 1200);
    const t3 = setTimeout(() => setPhase("done"), 2200);
    const t4 = setTimeout(onClose, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="text-center">
        {/* Orb */}
        <div
          className={`mx-auto size-32 rounded-full border-2 transition-all duration-700 ${
            phase === "locked"
              ? "border-yellow-400 bg-black/80 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
              : phase === "glow"
                ? "border-cyan-200 bg-cyan-900/40 shadow-[0_0_80px_rgba(34,211,238,0.9)]"
                : "border-green-300 bg-green-900/30 shadow-[0_0_100px_rgba(74,222,128,0.8)]"
          }`}
        >
          <div className="flex size-full flex-col items-center justify-center">
            {phase === "locked" && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-10 text-yellow-400 transition-all duration-500"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            )}

            {phase === "glow" && (
              <div className="size-10 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
            )}

            {phase === "unlock" && (
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
            )}

            {phase === "done" && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-10 text-green-300 drop-shadow-[0_0_16px_rgba(74,222,128,1)]"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
        </div>

        {/* Text */}
        {phase === "done" && (
          <div className="mt-6 animate-[fade-in_0.5s_ease-out]">
            <p className="text-xl font-bold text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
              CIDADELA DESBLOQUEADA
            </p>
            <p className="mt-2 text-sm text-cyan-200/60">
              Toque para continuar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
