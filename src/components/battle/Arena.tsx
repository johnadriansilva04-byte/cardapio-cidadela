import { useEffect, useRef, useState } from "react";
import {
  ARENA_WIDTH,
  MAX_HP,
  type BattleState,
  type Fighter,
} from "@/lib/battle/engine";
import { RobotSprite } from "./RobotSprite";
import { TouchControls } from "./TouchControls";

function HealthBar({ fighter, side }: { fighter: Fighter; side: "left" | "right" }) {
  const pct = (fighter.hp / MAX_HP) * 100;
  const color = side === "left" ? "#166534" : "#dc2626"; // Verde mais escuro FEB para P1, vermelho para inimigo
  const weaponNames: Record<string, string> = {
    club: "Bastão",
    pistol: "Pistola",
    rifle: "Rifle",
    shotgun: "Shotgun",
  };
  
  return (
    <div className={side === "right" ? "flex flex-col items-end" : "flex flex-col"}>
      <span className="font-display text-xs tracking-widest text-green-900 uppercase">
        {side === "left" ? "PRACINHA" : "INIMIGO"} · {fighter.name}
      </span>
      <div className="mt-1 h-5 w-full max-w-[320px] min-w-[180px] border border-green-800 bg-green-100/30 p-[3px]">
        <div
          className="h-full transition-[width] duration-150"
          style={{
            width: `${pct}%`,
            marginLeft: side === "right" ? "auto" : undefined,
            background: color,
            boxShadow: side === "left" ? "0 0 6px #166534" : "0 0 6px #dc2626",
          }}
        />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-display text-[10px] text-green-900">
          {Math.round(fighter.hp)} HP · DANO {Math.round(fighter.damageDealt)}
        </span>
        {/* Weapon/Melee indicator */}
        <span className="font-display text-[10px] text-green-800 font-medium">
          {fighter.useMelee ? "👊 SOCOS" : `🔫 ${weaponNames[fighter.weapon.type]}`}
        </span>
        {/* Toggle indicator for non-melee weapons */}
        {!fighter.weapon.melee && side === "left" && (
          <span className="text-[8px] text-green-700">[L/E]</span>
        )}
      </div>
    </div>
  );
}

export function Arena({ state, running }: { state: BattleState; running?: boolean }) {

  const toPct = (x: number) => (x / ARENA_WIDTH) * 100;

  return (
    <div className="mx-auto w-full max-w-7xl relative">
      <div className="mb-3 flex items-end justify-between gap-4">
        <HealthBar fighter={state.robot1} side="left" />
        <div className="flex flex-col items-center">
          <span className="font-display text-3xl text-green-800 tabular-nums">
            {Math.ceil(state.timeLeft)}
          </span>
          <span className="font-display text-[10px] tracking-widest text-green-900">
            RODADA {state.round}
          </span>
        </div>
        <HealthBar fighter={state.robot2} side="right" />
      </div>

      <div
        className="neon-panel arena-grid relative aspect-[16/9] w-[90%] mx-auto overflow-hidden rounded-sm border-2 border-green-800"
        style={{ background: "linear-gradient(180deg, #1a2f1a 0%, #0d1f0d 100%)" }}
      >
        {/* FEB Banner background */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
          <div className="text-xs font-bold text-green-700/50 tracking-widest">FORÇA EXPEDICIONÁRIA BRASILEIRA</div>
          <div className="text-[10px] text-green-800/30">ITÁLIA 1944-1945</div>
        </div>

        {/* Weapon toggle hint for player 1 */}
        {!state.robot1.weapon.melee && (
          <div className="absolute top-4 left-4 text-[10px] text-green-800/50 bg-green-200/30 px-2 py-1 rounded border border-green-700/30">
            Pressione L ou E para trocar arma/soco
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4"
          style={{ background: "linear-gradient(180deg, transparent, #2d4a2d)" }}
        />
        <div className="absolute inset-x-0 bottom-[18%] h-px" style={{ background: "rgba(34, 139, 34, 0.3)" }} />

        {state.lastEvent && (
          <div
            key={state.lastEvent.at}
            className="hit-pop pointer-events-none absolute left-1/2 top-[14%] -translate-x-1/2 font-display text-xl text-green-800"
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
              className="mx-auto mt-1 h-0.5 w-10 rounded-full opacity-40"
              style={{ background: "black", filter: "blur(2px)" }}
            />
          </div>
        ))}

        {/* Projectiles - SOMENTE se for tiro de arma real (bulletSpeed > 0) */}
        {state.projectiles.filter(p => {
          const owner = p.ownerId === 1 ? state.robot1 : state.robot2;
          return owner.weapon.bulletSpeed > 0;
        }).map(p => (
          <div
            key={p.id}
            className="absolute bottom-[18%]"
            style={{
              left: `${toPct(p.x)}%`,
              transform: `translate(-50%, ${-p.y * 0.28}px)`,
            }}
          >
            <div
              className="h-1 w-16 rounded-full"
              style={{
                background: p.ownerId === 1 ? "#166534" : "#dc2626",
                boxShadow: p.ownerId === 1 ? "0 0 6px #166534" : "0 0 6px #dc2626",
              }}
            />
          </div>
        ))}

        {state.finished && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 backdrop-blur-sm">
            <span className="font-display text-4xl text-green-800">
              {state.winner ? "VITÓRIA!" : "EMPATE"}
            </span>
            {state.winner && (
              <span className="font-display text-lg text-green-900">{state.winner} VENCEU</span>
            )}
          </div>
        )}
      </div>
      
      <TouchControls enabled={running ?? false} />
    </div>
  );
}
