import { useCallback, useMemo, useState } from "react";
import {
  canFly,
  legalDestinations,
  legalPlacements,
  millsFormedAt,
  opponent,
  removableTargets,
  type GameState,
  type Move,
  type Player,
} from "@/lib/trilha/engine";
import { playSfx } from "@/lib/trilha/sfx";

export interface Interaction {
  selected: number | null;
  targets: ReadonlySet<number>;
  captureTargets: ReadonlySet<number>;
  /** true quando o jogador precisa escolher a peça inimiga a capturar. */
  awaitingCapture: boolean;
  handleNode: (node: number) => void;
  reset: () => void;
  flying: boolean;
}

/**
 * Máquina de estados da interação de tabuleiro:
 * selecionar → destino → (moinho) → escolher captura → commit.
 */
export function useBoardInteraction(
  state: GameState,
  myPlayer: Player | null,
  commit: (move: Move) => void,
  enabled: boolean,
): Interaction {
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<{ from: number | null; to: number } | null>(null);

  const myTurn = enabled && myPlayer !== null && state.turn === myPlayer && state.phase !== "over";

  const reset = useCallback(() => {
    setSelected(null);
    setPending(null);
  }, []);

  const projectedBoard = useMemo(() => {
    if (!pending) return null;
    const b = state.board.slice();
    if (pending.from !== null) b[pending.from] = 0;
    b[pending.to] = state.turn;
    return b;
  }, [pending, state.board, state.turn]);

  const captureTargets = useMemo(() => {
    if (!myTurn || !pending || !projectedBoard) return new Set<number>();
    return new Set(removableTargets(projectedBoard, opponent(state.turn)));
  }, [myTurn, pending, projectedBoard, state.turn]);

  const targets = useMemo(() => {
    if (!myTurn || pending) return new Set<number>();
    if (state.phase === "placing") return new Set(legalPlacements(state));
    if (selected !== null) return new Set(legalDestinations(state, selected));
    return new Set<number>();
  }, [myTurn, pending, selected, state]);

  const attempt = useCallback(
    (from: number | null, to: number) => {
      const b = state.board.slice();
      if (from !== null) b[from] = 0;
      b[to] = state.turn;
      const formed = millsFormedAt(b, to, state.turn).length > 0;
      if (formed) {
        playSfx("mill");
        setPending({ from, to });
        setSelected(null);
        return;
      }
      playSfx(from === null ? "place" : "move");
      commit({ from, to, remove: null });
      reset();
    },
    [commit, reset, state.board, state.turn],
  );

  const handleNode = useCallback(
    (node: number) => {
      if (!myTurn) return;

      if (pending) {
        if (!captureTargets.has(node)) {
          playSfx("invalid");
          return;
        }
        playSfx("capture");
        commit({ from: pending.from, to: pending.to, remove: node });
        reset();
        return;
      }

      if (state.phase === "placing") {
        if (state.board[node] !== 0) {
          playSfx("invalid");
          return;
        }
        attempt(null, node);
        return;
      }

      // fase de movimentação / voo
      if (state.board[node] === state.turn) {
        playSfx("select");
        setSelected((cur) => (cur === node ? null : node));
        return;
      }
      if (selected !== null && targets.has(node)) {
        attempt(selected, node);
        return;
      }
      playSfx("invalid");
    },
    [attempt, captureTargets, commit, myTurn, pending, reset, selected, state, targets],
  );

  return {
    selected,
    targets,
    captureTargets,
    awaitingCapture: pending !== null,
    handleNode,
    reset,
    flying: myPlayer !== null && canFly(state, myPlayer),
  };
}
