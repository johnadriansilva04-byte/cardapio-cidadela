import { useMemo } from "react";
import {
  BOARD_EDGES,
  MILLS,
  NODE_COORDS,
  NODE_LABELS,
} from "@/lib/trilha/board";
import type { Cell, GameState, Player } from "@/lib/trilha/engine";
import { cn } from "@/lib/utils";

const PAD = 10;
const SPAN = 80; // 0..6 mapeado em 80 unidades

function px(v: number) {
  return PAD + (v / 6) * SPAN;
}

export interface BoardProps {
  state: GameState;
  /** Slot do jogador local (define a paleta "aliada"). */
  perspective?: Player | undefined;
  selected: number | null;
  /** Nós clicáveis como destino/colocação. */
  targets: ReadonlySet<number>;
  /** Nós clicáveis para captura. */
  captureTargets: ReadonlySet<number>;
  lastMove?: { from: number | null; to: number; remove: number | null } | null | undefined;
  interactive?: boolean | undefined;
  onNodeClick: (node: number) => void;
}

function activeMills(board: Cell[]) {
  return MILLS.filter((m) => {
    const a = board[m[0]!];
    return a !== 0 && a === board[m[1]!] && a === board[m[2]!];
  });
}

function Piece({
  node,
  owner,
  isSelected,
  isCaptureTarget,
  inMill,
  isLast,
  onClick,
  clickable,
}: {
  node: number;
  owner: Player;
  isSelected: boolean;
  isCaptureTarget: boolean;
  inMill: boolean;
  isLast: boolean;
  clickable: boolean;
  onClick: () => void;
}) {
  const [gx, gy] = NODE_COORDS[node]!;
  const x = px(gx);
  const y = px(gy);
  const feb = owner === 1;

  return (
    <g
      transform={`translate(${x} ${y})`}
      onClick={clickable ? onClick : undefined}
      className={cn(
        "origin-center transition-transform duration-200",
        clickable && "cursor-pointer hover:scale-110",
      )}
      style={{ animation: "drop-in 0.35s cubic-bezier(0.2,0.9,0.25,1.4)" }}
      role={clickable ? "button" : undefined}
      aria-label={`${feb ? "Pracinha da FEB" : "Tropa inimiga"} em ${NODE_LABELS[node]}`}
    >
      {isCaptureTarget && (
        <circle
          r="6.4"
          fill="none"
          stroke="var(--destructive)"
          strokeWidth="1"
          strokeDasharray="2 1.5"
          style={{ animation: "mill-pulse 1s ease-in-out infinite" }}
        />
      )}
      {isSelected && (
        <circle r="5.8" fill="none" stroke="var(--lantern)" strokeWidth="0.9" />
      )}
      <ellipse cx="0.5" cy="1.3" rx="4.2" ry="3.6" fill="var(--ink)" fillOpacity="0.45" />
      <circle
        r="4.1"
        fill={feb ? "var(--feb)" : "var(--axis)"}
        stroke={inMill ? "var(--mill)" : "var(--ink)"}
        strokeWidth="0.7"
      />
      <circle r="4.1" fill="url(#pieceSheen)" />
      {feb ? (
        // Cobra fumando estilizada
        <g fill="none" stroke="var(--feb-foreground)" strokeWidth="0.55" strokeLinecap="round">
          <path d="M -1.9 1.5 C 0.4 1.9, 2 0.9, 1.6 -0.5 C 1.3 -1.6, -0.3 -1.7, -0.6 -0.6" />
          <path d="M -0.6 -0.6 L -2.2 -1.7" />
          <path d="M -2.4 -2.2 c 0.5 -0.5, -0.5 -0.9, 0 -1.4" />
        </g>
      ) : (
        // Capacete de aço estilizado
        <g fill="var(--axis-foreground)" fillOpacity="0.85">
          <path d="M -2.5 0.6 a 2.5 2.6 0 0 1 5 0 z" />
          <rect x="-3.1" y="0.7" width="6.2" height="0.9" rx="0.45" />
        </g>
      )}
      {isLast && (
        <circle r="5.2" fill="none" stroke="var(--lantern)" strokeOpacity="0.7" strokeWidth="0.5" strokeDasharray="1 1" />
      )}
    </g>
  );
}

export function TrilhaBoard({
  state,
  perspective: _perspective = 1,
  selected,
  targets,
  captureTargets,
  lastMove,
  interactive = true,
  onNodeClick,
}: BoardProps) {
  const mills = useMemo(() => activeMills(state.board), [state.board]);
  const millNodes = useMemo(() => new Set(mills.flat()), [mills]);

  return (
    <div className="relative aspect-square w-full max-w-[min(78vh,640px)]">
      <div className="surface-map absolute inset-0 rounded-md shadow-trench" />
      <div className="grain-overlay pointer-events-none absolute inset-0 rounded-md" />
      <svg
        viewBox="0 0 100 100"
        className="relative h-full w-full"
        role="grid"
        aria-label="Tabuleiro tático da Trilha"
        data-perspective={_perspective}
      >
        <defs>
          <radialGradient id="pieceSheen" cx="35%" cy="28%" r="75%">
            <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="0.42" />
            <stop offset="55%" stopColor="oklch(1 0 0)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="oklch(0 0 0)" stopOpacity="0.35" />
          </radialGradient>
          <filter id="millGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* grade de coordenadas do mapa */}
        <g stroke="var(--ink)" strokeOpacity="0.1" strokeWidth="0.3">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} x1="4" y1={4 + i * 11.5} x2="96" y2={4 + i * 11.5} />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={4 + i * 11.5} y1="4" x2={4 + i * 11.5} y2="96" />
          ))}
        </g>

        {/* linhas do tabuleiro */}
        <g stroke="var(--ink)" strokeWidth="1.1" strokeLinecap="round">
          {BOARD_EDGES.map(([a, b]) => {
            const [ax, ay] = NODE_COORDS[a]!;
            const [bx, by] = NODE_COORDS[b]!;
            return (
              <line key={`${a}-${b}`} x1={px(ax)} y1={px(ay)} x2={px(bx)} y2={px(by)} />
            );
          })}
        </g>

        {/* moinhos ativos em destaque */}
        <g stroke="var(--mill)" strokeLinecap="round" filter="url(#millGlow)">
          {mills.map((m) => {
            const [ax, ay] = NODE_COORDS[m[0]]!;
            const [bx, by] = NODE_COORDS[m[2]]!;
            return (
              <line
                key={m.join("-")}
                x1={px(ax)}
                y1={px(ay)}
                x2={px(bx)}
                y2={px(by)}
                strokeWidth="2.4"
                style={{ animation: "mill-pulse 1.4s ease-in-out infinite" }}
              />
            );
          })}
        </g>

        {/* interseções vazias */}
        {NODE_COORDS.map(([gx, gy], node) => {
          const empty = state.board[node] === 0;
          const isTarget = targets.has(node);
          if (!empty) return null;
          return (
            <g key={`n${node}`} transform={`translate(${px(gx)} ${px(gy)})`}>
              <circle r="1.6" fill="var(--ink)" fillOpacity="0.7" />
              {isTarget && (
                <circle
                  r="3.4"
                  fill="var(--lantern)"
                  fillOpacity="0.25"
                  stroke="var(--lantern)"
                  strokeWidth="0.7"
                  style={{ animation: "mill-pulse 1.6s ease-in-out infinite" }}
                />
              )}
              <circle
                r="6"
                fill="transparent"
                className={cn(interactive && isTarget ? "cursor-pointer" : "cursor-default")}
                onClick={interactive && isTarget ? () => onNodeClick(node) : undefined}
                role={isTarget ? "button" : undefined}
                aria-label={`Interseção ${NODE_LABELS[node]}`}
              />
            </g>
          );
        })}

        {/* peças */}
        {state.board.map((cell, node) =>
          cell === 0 ? null : (
            <Piece
              key={`p${node}`}
              node={node}
              owner={cell}
              isSelected={selected === node}
              isCaptureTarget={captureTargets.has(node)}
              inMill={millNodes.has(node)}
              isLast={lastMove?.to === node}
              clickable={
                interactive && (captureTargets.has(node) || (cell === state.turn && targets.size >= 0))
              }
              onClick={() => onNodeClick(node)}
            />
          ),
        )}
      </svg>
    </div>
  );
}
