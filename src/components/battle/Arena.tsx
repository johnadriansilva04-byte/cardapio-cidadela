import { useEffect, useRef, useState } from "react";
import {
  ARENA_WIDTH,
  MAX_HP,
  type BattleState,
  type Fighter,
} from "@/lib/battle/engine";
import { RobotSprite } from "./RobotSprite";

function HealthBar({ fighter, side }: { fighter: Fighter; side: "left" | "right" }) {
  const pct = (fighter.hp / MAX_HP) * 100;
  const color = side === "left" ? "var(--p1)" : "var(--p2)";
  return (
    <div className={side === "right" ? "flex flex-col items-end" : "flex flex-col"}>
      <span className="font-display text-xs tracking-widest text-muted-foreground uppercase">
        {side === "left" ? "P1" : "P2"} · {fighter.name}
      </span>
      <div className="mt-1 h-5 w-full max-w-[320px] min-w-[180px] border border-border bg-secondary p-[3px]">
        <div
          className="h-full transition-[width] duration-150"
          style={{
            width: `${pct}%`,
            marginLeft: side === "right" ? "auto" : undefined,
            background: color,
            boxShadow: side === "left" ? "var(--glow-p1)" : "var(--glow-p2)",
          }}
        />
      </div>
      <span className="mt-1 font-display text-[10px] text-muted-foreground">
        {Math.round(fighter.hp)} HP · DANO {Math.round(fighter.damageDealt)}
      </span>
    </div>
  );
}

export function Arena({ state }: { state: BattleState }) {
  const [shake, setShake] = useState(0);
  const lastEventAt = useRef<number | null>(null);

  useEffect(() => {
    if (state.lastEvent && state.lastEvent.at !== lastEventAt.current) {
      lastEventAt.current = state.lastEvent.at;
      setShake((s) => s + 1);
    }
  }, [state.lastEvent]);

  const toPct = (x: number) => (x / ARENA_WIDTH) * 100;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-3 flex items-end justify-between gap-4">
        <HealthBar fighter={state.robot1} side="left" />
        <div className="flex flex-col items-center">
          <span className="font-display text-3xl text-arcade-amber tabular-nums">
            {Math.ceil(state.timeLeft)}
          </span>
          <span className="font-display text-[10px] tracking-widest text-muted-foreground">
            ROUND {state.round}
          </span>
        </div>
        <HealthBar fighter={state.robot2} side="right" />
      </div>

      <div
        key={shake}
        className={`neon-panel arena-grid relative aspect-[16/9] w-full overflow-hidden rounded-sm ${shake ? "screen-shake" : ""}`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4"
          style={{ background: "linear-gradient(180deg, transparent, var(--arena-floor))" }}
        />
        <div className="absolute inset-x-0 bottom-[18%] h-px" style={{ background: "var(--border)" }} />

        {state.lastEvent && (
          <div
            key={state.lastEvent.at}
            className="hit-pop pointer-events-none absolute left-1/2 top-[14%] -translate-x-1/2 font-display text-xl text-arcade-amber"
          >
            {state.lastEvent.text}
          </div>
        )}

        {[state.robot1, state.robot2].map((f, idx) => (
          <div
            key={f.id}
            className="absolute bottom-[18%]"
            style={{
              left: `${toPct(f.x)}%`,
              transform: `translate(-50%, ${-f.y * 0.28}px)`,
            }}
          >
            <RobotSprite fighter={f} palette={idx === 0 ? "p1" : "p2"} />
            <div
              className="mx-auto mt-1 h-1.5 w-16 rounded-full opacity-40"
              style={{ background: "black", filter: "blur(3px)" }}
            />
          </div>
        ))}

        {state.finished && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
            <span className="font-display text-4xl text-arcade-amber">
              {state.winner ? "K.O." : "EMPATE"}
            </span>
            {state.winner && (
              <span className="font-display text-lg text-foreground">{state.winner} VENCEU</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
