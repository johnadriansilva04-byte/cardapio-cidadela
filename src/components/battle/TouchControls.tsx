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

  const handleShootStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("shoot", true);
  };

  const handleShootEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("shoot", false);
  };

  const handleMeleeStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("melee", true);
  };

  const handleMeleeEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("melee", false);
  };

  const handleLeftStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("left", true);
  };

  const handleLeftEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("left", false);
  };

  const handleRightStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("right", true);
  };

  const handleRightEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setAction("right", false);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex h-32 bg-black/80 backdrop-blur-sm">
      {/* Lado Esquerdo - Movimento */}
      <div className="flex-1 flex items-center justify-center gap-2 p-4">
        <button
          type="button"
          onTouchStart={handleLeftStart}
          onTouchEnd={handleLeftEnd}
          onTouchCancel={handleLeftEnd}
          className="h-14 w-14 rounded-full border-2 border-blue-500/50 bg-blue-500/20 text-blue-400 backdrop-blur-sm active:scale-95 active:bg-blue-500/40 transition-all"
          aria-label="Esquerda"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onTouchStart={handleRightStart}
          onTouchEnd={handleRightEnd}
          onTouchCancel={handleRightEnd}
          className="h-14 w-14 rounded-full border-2 border-blue-500/50 bg-blue-500/20 text-blue-400 backdrop-blur-sm active:scale-95 active:bg-blue-500/40 transition-all"
          aria-label="Direita"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Centro - Pular */}
      <div className="flex items-center justify-center p-4">
        <button
          type="button"
          onTouchStart={handleJumpStart}
          onTouchEnd={handleJumpEnd}
          onTouchCancel={handleJumpEnd}
          className="h-16 w-16 rounded-full border-2 border-green-500/50 bg-green-500/20 text-green-400 backdrop-blur-sm active:scale-95 active:bg-green-500/40 transition-all"
          aria-label="Pular"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Lado Direito - Ações */}
      <div className="flex-1 flex items-center justify-center gap-2 p-4">
        <button
          type="button"
          onTouchStart={handleMeleeStart}
          onTouchEnd={handleMeleeEnd}
          onTouchCancel={handleMeleeEnd}
          className="h-14 w-14 rounded-full border-2 border-yellow-500/50 bg-yellow-500/20 text-yellow-400 backdrop-blur-sm active:scale-95 active:bg-yellow-500/40 transition-all"
          aria-label="Soco/Trocar Arma"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
        </button>
        <button
          type="button"
          onTouchStart={handleShootStart}
          onTouchEnd={handleShootEnd}
          onTouchCancel={handleShootEnd}
          className="h-14 w-14 rounded-full border-2 border-red-500/50 bg-red-500/20 text-red-400 backdrop-blur-sm active:scale-95 active:bg-red-500/40 transition-all"
          aria-label="Atirar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
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
