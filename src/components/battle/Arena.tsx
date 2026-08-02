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
  const color = side === "left" ? "#22c55e" : "#ef4444"; // Verde FEB para P1, vermelho para inimigo
  const weaponNames: Record<string, string> = {
    none: "Recruta",
    pistol: "Pistola",
    rifle: "Rifle",
    shotgun: "Shotgun",
  };
  
  return (
    <div className={side === "right" ? "flex flex-col items-end" : "flex flex-col"}>
      <span className="font-display text-xs tracking-widest text-green-300/70 uppercase">
        {side === "left" ? "PRACINHA" : "INIMIGO"} · {fighter.name}
      </span>
      <div className="mt-1 h-5 w-full max-w-[320px] min-w-[180px] border border-green-800 bg-green-950/30 p-[3px]">
        <div
          className="h-full transition-[width] duration-150"
          style={{
            width: `${pct}%`,
            marginLeft: side === "right" ? "auto" : undefined,
            background: color,
            boxShadow: side === "left" ? "0 0 8px #22c55e" : "0 0 8px #ef4444",
          }}
        />
      </div>
      <span className="mt-1 font-display text-[10px] text-green-300/70">
        {Math.round(fighter.hp)} HP · DANO {Math.round(fighter.damageDealt)} · {weaponNames[fighter.weapon.type]}
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
          <span className="font-display text-3xl text-green-400 tabular-nums">
            {Math.ceil(state.timeLeft)}
          </span>
          <span className="font-display text-[10px] tracking-widest text-green-300/70">
            RODADA {state.round}
          </span>
        </div>
        <HealthBar fighter={state.robot2} side="right" />
      </div>

      <div
        key={shake}
        className={`neon-panel arena-grid relative aspect-[16/9] w-full overflow-hidden rounded-sm border-2 border-green-700 ${shake ? "screen-shake" : ""}`}
        style={{ background: "linear-gradient(180deg, #1a2f1a 0%, #0d1f0d 100%)" }}
      >
        {/* FEB Banner background */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
          <div className="text-xs font-bold text-green-400/50 tracking-widest">FORÇA EXPEDICIONÁRIA BRASILEIRA</div>
          <div className="text-[10px] text-green-300/30">ITÁLIA 1944-1945</div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4"
          style={{ background: "linear-gradient(180deg, transparent, #2d4a2d)" }}
        />
        <div className="absolute inset-x-0 bottom-[18%] h-px" style={{ background: "rgba(34, 139, 34, 0.3)" }} />

        {state.lastEvent && (
          <div
            key={state.lastEvent.at}
            className="hit-pop pointer-events-none absolute left-1/2 top-[14%] -translate-x-1/2 font-display text-xl text-green-400"
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

        {/* Projectiles */}
        {state.projectiles.map(p => (
          <div
            key={p.id}
            className="absolute bottom-[18%] h-2 w-2 rounded-full"
            style={{
              left: `${toPct(p.x)}%`,
              transform: `translate(-50%, ${-p.y * 0.28}px)`,
              background: p.ownerId === 1 ? "#22c55e" : "#ef4444",
              boxShadow: p.ownerId === 1 ? "0 0 8px #22c55e" : "0 0 8px #ef4444",
            }}
          />
        ))}

        {state.finished && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 backdrop-blur-sm">
            <span className="font-display text-4xl text-green-400">
              {state.winner ? "VITÓRIA!" : "EMPATE"}
            </span>
            {state.winner && (
              <span className="font-display text-lg text-green-300">{state.winner} VENCEU</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
