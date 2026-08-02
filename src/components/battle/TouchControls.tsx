import { useIsMobile } from "@/hooks/use-mobile";
import { useTouchControls } from "@/lib/battle/useTouchControls";

export function TouchControls({ enabled }: { enabled: boolean }) {
  const isMobile = useIsMobile();
  const { inputs, setAction } = useTouchControls(enabled);

  if (!isMobile) return null;

  const handleJumpStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("jump", true);
  };

  const handleJumpEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("jump", false);
  };

  const handleAttackStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("shoot", true);
  };

  const handleAttackEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("shoot", false);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex h-24 bg-black/90 backdrop-blur-sm">
      {/* Lado Esquerdo - Pular */}
      <div className="flex-1 flex items-center justify-center p-4">
        <button
          type="button"
          onTouchStart={handleJumpStart}
          onTouchEnd={handleJumpEnd}
          onTouchCancel={handleJumpEnd}
          className="h-20 w-20 rounded-full border-3 border-green-500/60 bg-green-500/30 text-green-400 backdrop-blur-sm active:scale-90 active:bg-green-500/50 transition-all shadow-lg shadow-green-500/20"
          aria-label="Pular"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Lado Direito - Bater/Atacar */}
      <div className="flex-1 flex items-center justify-center p-4">
        <button
          type="button"
          onTouchStart={handleAttackStart}
          onTouchEnd={handleAttackEnd}
          onTouchCancel={handleAttackEnd}
          className="h-20 w-20 rounded-full border-3 border-red-500/60 bg-red-500/30 text-red-400 backdrop-blur-sm active:scale-90 active:bg-red-500/50 transition-all shadow-lg shadow-red-500/20"
          aria-label="Bater"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
