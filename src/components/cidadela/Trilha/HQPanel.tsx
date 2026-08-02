import { Flame, Shield, Skull, Target, Timer } from "lucide-react";
import brasao from "/cobra-fumando.png";
import { Button } from "@/components/ui/button";
import {
  canFly,
  countOnBoard,
  PIECES_PER_PLAYER,
  type GameState,
  type Player,
} from "@/lib/trilha/engine";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export interface SideInfo {
  name: string;
  slot: Player;
  subtitle?: string;
}

function ReserveRow({ count, slot }: { count: number; slot: Player }) {
  return (
    <div className="flex flex-wrap gap-1" aria-label={`${count} peças na reserva`}>
      {Array.from({ length: PIECES_PER_PLAYER }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full border border-ink/50 transition-opacity",
            slot === 1 ? "bg-feb" : "bg-axis",
            i >= count && "opacity-20",
          )}
        />
      ))}
    </div>
  );
}

function SideCard({
  side,
  state,
  active,
  timeLeft,
}: {
  side: SideInfo;
  state: GameState;
  active: boolean;
  timeLeft?: number | null | undefined;
}) {
  const onBoard = countOnBoard(state.board, side.slot);
  const flying = canFly(state, side.slot);
  return (
    <div
      className={cn(
        "panel-field rounded-md p-3 transition-all",
        active && "ring-1 ring-lantern shadow-lantern",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-3 w-3 rounded-full border border-ink/60",
              side.slot === 1 ? "bg-feb" : "bg-axis",
            )}
          />
          <div>
            <p className="text-stencil text-sm leading-tight">{side.name}</p>
            <p className="text-typewriter text-[11px] text-muted-foreground">
              {side.subtitle ?? (side.slot === 1 ? "Força Expedicionária Brasileira" : "Forças do Eixo")}
            </p>
          </div>
        </div>
        {typeof timeLeft === "number" && active && (
          <span
            className={cn(
              "text-stencil flex items-center gap-1 rounded-sm border border-border px-2 py-0.5 text-xs",
              timeLeft <= 10 ? "text-destructive" : "text-lantern",
            )}
          >
            <Timer className="h-3 w-3" />
            {timeLeft}s
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Em campo</dt>
          <dd className="text-stencil text-lg text-foreground">{onBoard}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Reserva</dt>
          <dd className="text-stencil text-lg text-foreground">{state.hand[side.slot]}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Baixas</dt>
          <dd className="text-stencil text-lg text-foreground">{state.captured[side.slot]}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <ReserveRow count={state.hand[side.slot]} slot={side.slot} />
      </div>

      {flying && (
        <p className="text-typewriter mt-2 flex items-center gap-1 text-[11px] text-lantern">
          <Flame className="h-3 w-3" /> Esquadrão aerotransportado: pode voar
        </p>
      )}
    </div>
  );
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
  const isMobile = useIsMobile();
  const phaseLabel =
    state.phase === "placing"
      ? "Fase I — Desdobramento"
      : state.phase === "moving"
        ? "Fase II — Manobra"
        : "Operação encerrada";

  return (
    <aside className={cn("flex w-full flex-col gap-3", !isMobile && "lg:w-80")}>
      <header className="panel-field flex items-center gap-2 rounded-md p-2 sm:gap-3 sm:p-3">
        <img src={brasao} alt="Brasão da cobra fumando da FEB" width={48} height={48} className="h-10 w-10 sm:h-12 sm:w-12 animate-flicker" />
        <div>
          <h2 className="text-sm leading-none sm:text-base">Quartel-General</h2>
          <p className="text-typewriter text-[10px] text-muted-foreground sm:text-[11px]">{phaseLabel}</p>
        </div>
      </header>

      <div
        className={cn(
          "panel-field rounded-md p-2 sm:p-3",
          awaitingCapture && "ring-1 ring-destructive",
        )}
      >
        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground sm:text-[10px]">Comunicado</p>
        <p className="text-typewriter mt-1 text-xs text-foreground sm:text-sm">{status}</p>
      </div>

      <div className={cn("grid gap-3", !isMobile && "grid-cols-1")}>
        <SideCard side={p1} state={state} active={state.turn === 1 && state.phase !== "over"} timeLeft={timeLeft} />
        <SideCard side={p2} state={state} active={state.turn === 2 && state.phase !== "over"} timeLeft={timeLeft} />
      </div>

      <div className="panel-field flex-1 rounded-md p-2 sm:p-3">
        <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground sm:text-[10px]">
          <Target className="h-3 w-3" /> Diário de operações
        </p>
        <ol className="text-typewriter mt-2 flex max-h-32 flex-col-reverse gap-1 overflow-y-auto text-[10px] text-muted-foreground sm:max-h-44 sm:text-[11px]">
          {log.length === 0 && <li>Nenhum movimento registrado.</li>}
          {log.map((entry, i) => (
            <li key={`${i}-${entry}`} className="border-l border-border pl-2">
              {entry}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex gap-2">
        {onRestart && (
          <Button variant="secondary" className="flex-1 text-xs sm:text-sm" onClick={onRestart}>
            <Shield className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Nova operação
          </Button>
        )}
        {onResign && state.phase !== "over" && (
          <Button variant="destructive" className="flex-1 text-xs sm:text-sm" onClick={onResign}>
            <Skull className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Render-se
          </Button>
        )}
      </div>

      <p className="sr-only">Você comanda o lado {myPlayer === 2 ? "do Eixo" : "da FEB"}.</p>
    </aside>
  );
}
