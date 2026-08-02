import { useCallback, useEffect, useRef, useState } from "react";
import { NODE_LABELS } from "@/lib/trilha/board";
import { AI_PROFILES, chooseMove, type Difficulty } from "@/lib/trilha/ai";
import {
  applyMove,
  createInitialState,
  resign as resignState,
  validateMove,
  type GameState,
  type Move,
  type Player,
} from "@/lib/trilha/engine";
import { playSfx } from "@/lib/trilha/sfx";

export function describeMove(move: Move, actor: Player, ply: number): string {
  const who = actor === 1 ? "FEB" : "EIXO";
  const action =
    move.from === null
      ? `desdobra em ${NODE_LABELS[move.to]}`
      : `avança ${NODE_LABELS[move.from]} → ${NODE_LABELS[move.to]}`;
  const capture = move.remove !== null ? ` · TRILHA! neutraliza ${NODE_LABELS[move.remove]}` : "";
  return `#${String(ply + 1).padStart(2, "0")} ${who} ${action}${capture}`;
}

export interface LocalGame {
  state: GameState;
  log: string[];
  lastMove: Move | null;
  thinking: boolean;
  commit: (move: Move) => void;
  restart: () => void;
  resign: () => void;
  aiInfo: { depth: number; nodes: number; elapsedMs: number } | null;
}

/** Partida local contra a máquina; o humano é sempre o slot 1 (FEB). */
export function useLocalGame(difficulty: Difficulty, human: Player = 1): LocalGame {
  const [state, setState] = useState<GameState>(createInitialState);
  const [log, setLog] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [thinking, setThinking] = useState(false);
  const [aiInfo, setAiInfo] = useState<LocalGame["aiInfo"]>(null);
  const timer = useRef<number | null>(null);

  const push = useCallback((s: GameState, move: Move) => {
    const actor = s.turn;
    const next = applyMove(s, move);
    setLog((l) => [describeMove(move, actor, s.ply), ...l].slice(0, 60));
    setLastMove(move);
    setState(next);
    return next;
  }, []);

  const commit = useCallback(
    (move: Move) => {
      setState((cur) => {
        if (!validateMove(cur, move, cur.turn).ok) {
          playSfx("invalid");
          return cur;
        }
        const actor = cur.turn;
        const next = applyMove(cur, move);
        setLog((l) => [describeMove(move, actor, cur.ply), ...l].slice(0, 60));
        setLastMove(move);
        return next;
      });
    },
    [],
  );

  // Turno da máquina
  useEffect(() => {
    if (state.phase === "over" || state.turn === human) return;
    setThinking(true);
    const profile = AI_PROFILES[difficulty];
    timer.current = window.setTimeout(() => {
      const decision = chooseMove(state, difficulty);
      setThinking(false);
      setAiInfo({ depth: decision.depth, nodes: decision.nodes, elapsedMs: decision.elapsedMs });
      if (!decision.move) return;
      playSfx(decision.move.remove !== null ? "capture" : decision.move.from === null ? "place" : "move");
      push(state, decision.move);
    }, Math.max(320, profile.timeBudgetMs * 0.35));

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      setThinking(false);
    };
  }, [difficulty, human, push, state]);

  // Fanfarra de fim de jogo
  const endedRef = useRef(false);
  useEffect(() => {
    if (state.phase === "over" && !endedRef.current) {
      endedRef.current = true;
      playSfx(state.winner === human ? "victory" : "defeat");
    }
    if (state.phase !== "over") endedRef.current = false;
  }, [human, state.phase, state.winner]);

  const restart = useCallback(() => {
    setState(createInitialState());
    setLog([]);
    setLastMove(null);
    setAiInfo(null);
    playSfx("radio");
  }, []);

  const resign = useCallback(() => {
    setState((cur) => resignState(cur, human));
    setLog((l) => ["Comando brasileiro solicitou cessar-fogo.", ...l]);
  }, [human]);

  return { state, log, lastMove, thinking, commit, restart, resign, aiInfo };
}
