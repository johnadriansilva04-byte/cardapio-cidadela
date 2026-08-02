import { useIsMobile } from "@/hooks/use-mobile";
import { useTouchControls } from "@/lib/battle/useTouchControls";
import type { Inputs } from "@/lib/battle/engine";

export function TouchControls({ enabled }: { enabled: boolean }) {
  const isMobile = useIsMobile();
  const { inputs, setAction, joystickPosition, handleJoystickStart, handleJoystickMove, handleJoystickEnd } = useTouchControls(enabled);

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
    <div className="fixed inset-x-0 bottom-0 z-[999] flex h-48 bg-black/90 backdrop-blur-sm pb-4" style={{ touchAction: 'none' }}>
      {/* Lado Esquerdo - Joystick Virtual */}
      <div className="flex-1 flex items-end justify-center p-2 pb-4">
        <div 
          className="relative h-32 w-32 touch-none"
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
          style={{ touchAction: 'none' }}
          onPointerUp={handleJoystickEnd}
          onPointerLeave={handleJoystickEnd}
        >
          {/* Base do joystick */}
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/40 bg-blue-500/10 backdrop-blur-sm shadow-lg shadow-blue-500/20" />
          
          {/* Knob do joystick (bolinha que se move) */}
          <div
            className="absolute top-1/2 left-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-3 border-blue-400/60 bg-blue-400/30 shadow-lg shadow-blue-400/30 transition-transform"
            style={{
              transform: `translate(calc(-50% + ${joystickPosition.x}px), calc(-50% + ${joystickPosition.y}px))`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-blue-300" />
            </div>
          </div>
          
          {/* Indicador visual de direção */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-blue-400/60 font-bold">↑</div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-blue-400/60 font-bold">↓</div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-400/60 font-bold">←</div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-400/60 font-bold">→</div>
        </div>
      </div>

      {/* Lado Direito - Ações */}
      <div className="flex-1 flex items-end justify-center gap-3 p-2 pb-4">
        <button
          type="button"
          onTouchStart={handleStart("melee")}
          onTouchEnd={handleEnd("melee")}
          onTouchCancel={handleEnd("melee")}
          onMouseDown={handleStart("melee")}
          onMouseUp={handleEnd("melee")}
          onMouseLeave={handleEnd("melee")}
          className="h-16 w-16 rounded-full border-3 border-yellow-500/60 bg-yellow-500/30 text-yellow-400 backdrop-blur-sm active:scale-90 active:bg-yellow-500/50 transition-all shadow-lg shadow-yellow-500/20"
          aria-label="Soco"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
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
          className="h-16 w-16 rounded-full border-3 border-red-500/60 bg-red-500/30 text-red-400 backdrop-blur-sm active:scale-90 active:bg-red-500/50 transition-all shadow-lg shadow-red-500/20"
          aria-label="Atirar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
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
