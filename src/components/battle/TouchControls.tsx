import { useIsMobile } from "@/hooks/use-mobile";
import { useTouchControls } from "@/lib/battle/useTouchControls";
import type { Inputs } from "@/lib/battle/engine";

export function TouchControls({ enabled }: { enabled: boolean }) {
  const isMobile = useIsMobile();
  const { inputs, setAction } = useTouchControls(enabled);

  if (!enabled || !isMobile) return null;

  const handleStart = (action: keyof Inputs) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAction(action, true);
  };

  const handleEnd = (action: keyof Inputs) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAction(action, false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex h-40 bg-black/90 backdrop-blur-sm pb-4">
      {/* Lado Esquerdo - Movimento */}
      <div className="flex-1 flex items-end justify-center gap-2 p-2 pb-4">
        <button
          type="button"
          onTouchStart={handleStart("left")}
          onTouchEnd={handleEnd("left")}
          onTouchCancel={handleEnd("left")}
          onMouseDown={handleStart("left")}
          onMouseUp={handleEnd("left")}
          onMouseLeave={handleEnd("left")}
          className="h-14 w-14 rounded-full border-2 border-blue-500/60 bg-blue-500/30 text-blue-400 backdrop-blur-sm active:scale-90 active:bg-blue-500/50 transition-all shadow-lg shadow-blue-500/20"
          aria-label="Esquerda"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onTouchStart={handleStart("right")}
          onTouchEnd={handleEnd("right")}
          onTouchCancel={handleEnd("right")}
          onMouseDown={handleStart("right")}
          onMouseUp={handleEnd("right")}
          onMouseLeave={handleEnd("right")}
          className="h-14 w-14 rounded-full border-2 border-blue-500/60 bg-blue-500/30 text-blue-400 backdrop-blur-sm active:scale-90 active:bg-blue-500/50 transition-all shadow-lg shadow-blue-500/20"
          aria-label="Direita"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
        <button
          type="button"
          onTouchStart={handleStart("jump")}
          onTouchEnd={handleEnd("jump")}
          onTouchCancel={handleEnd("jump")}
          onMouseDown={handleStart("jump")}
          onMouseUp={handleEnd("jump")}
          onMouseLeave={handleEnd("jump")}
          className="h-14 w-14 rounded-full border-2 border-green-500/60 bg-green-500/30 text-green-400 backdrop-blur-sm active:scale-90 active:bg-green-500/50 transition-all shadow-lg shadow-green-500/20"
          aria-label="Pular"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
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

      {/* Lado Direito - Ações */}
      <div className="flex-1 flex items-end justify-center gap-2 p-2 pb-4">
        <button
          type="button"
          onTouchStart={handleStart("melee")}
          onTouchEnd={handleEnd("melee")}
          onTouchCancel={handleEnd("melee")}
          onMouseDown={handleStart("melee")}
          onMouseUp={handleEnd("melee")}
          onMouseLeave={handleEnd("melee")}
          className="h-14 w-14 rounded-full border-2 border-yellow-500/60 bg-yellow-500/30 text-yellow-400 backdrop-blur-sm active:scale-90 active:bg-yellow-500/50 transition-all shadow-lg shadow-yellow-500/20"
          aria-label="Soco"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 0 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
        </button>
        <button
          type="button"
          onTouchStart={handleStart("shoot")}
          onTouchEnd={handleEnd("shoot")}
          onTouchCancel={handleEnd("shoot")}
          onMouseDown={handleStart("shoot")}
          onMouseUp={handleEnd("shoot")}
          onMouseLeave={handleEnd("shoot")}
          className="h-14 w-14 rounded-full border-2 border-red-500/60 bg-red-500/30 text-red-400 backdrop-blur-sm active:scale-90 active:bg-red-500/50 transition-all shadow-lg shadow-red-500/20"
          aria-label="Atirar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
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
