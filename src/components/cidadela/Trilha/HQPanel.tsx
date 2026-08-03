import { Shield, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countOnBoard, type GameState, type Player } from "@/lib/trilha/engine";
import { cn } from "@/lib/utils";

export interface SideInfo {
  name: string;
  slot: Player;
  subtitle?: string;
}

export interface HQPanelProps {
  state: GameState;
  p1: SideInfo;
  p2: SideInfo;
  myPlayer: Player | null;
  status: string;
  log: string[];
  timeLeft?: number | null | undefined;
  onResign?: (() => void) | undefined;
  onRestart?: (() => void) | undefined;
  awaitingCapture?: boolean | undefined;
}

export function HQPanel({
  state,
  p1,
  p2,
  myPlayer,
  status,
  log,
  timeLeft,
  onResign,
  onRestart,
  awaitingCapture,
}: HQPanelProps) {
  return (
    <aside className="flex w-full flex-col gap-3 lg:w-72">
      <div
        className={cn("panel-field rounded-md p-3", awaitingCapture && "ring-2 ring-destructive")}
      >
        <p className="text-typewriter text-sm text-white">{status}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={cn("panel-field rounded-md p-3", state.turn === 1 && "ring-2 ring-lantern")}
        >
          <p className="text-stencil text-sm font-medium text-white">{p1.name}</p>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-white/90">Campo: {countOnBoard(state.board, 1)}</span>
            <span className="text-white/90">Reserva: {state.hand[1]}</span>
          </div>
        </div>
        <div
          className={cn("panel-field rounded-md p-3", state.turn === 2 && "ring-2 ring-lantern")}
        >
          <p className="text-stencil text-sm font-medium text-white">{p2.name}</p>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-white/90">Campo: {countOnBoard(state.board, 2)}</span>
            <span className="text-white/90">Reserva: {state.hand[2]}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {onRestart && (
          <Button variant="secondary" className="flex-1 text-sm" onClick={onRestart}>
            <Shield className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        )}
        {onResign && state.phase !== "over" && (
          <Button variant="destructive" className="flex-1 text-sm" onClick={onResign}>
            <Skull className="mr-2 h-4 w-4" /> Render-se
          </Button>
        )}
      </div>
    </aside>
  );
}
