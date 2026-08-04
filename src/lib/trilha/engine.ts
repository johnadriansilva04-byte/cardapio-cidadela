/**
 * Motor de regras da Trilha — puro, determinístico e serializável.
 * Nenhuma dependência de React/Supabase: usado no cliente, na IA e no servidor.
 */
import { ADJACENCY, MILLS, MILLS_BY_NODE, NODE_COUNT } from "./board";

export type Player = 1 | 2;
export type Cell = 0 | Player;
export type Phase = "placing" | "moving" | "over";

export interface GameState {
  /** 24 posições: 0 = vazia, 1 = jogador 1, 2 = jogador 2. */
  board: Cell[];
  turn: Player;
  /** Peças ainda na reserva (mão) de cada jogador. */
  hand: Record<Player, number>;
  /** Peças capturadas pelo jogador (para o painel do QG). */
  captured: Record<Player, number>;
  phase: Phase;
  winner: Player | null;
  /** Motivo do fim de partida. */
  reason: "annihilation" | "blockade" | "resign" | "timeout" | null;
  /** Nº de jogadas completas realizadas. */
  ply: number;
}

export interface Move {
  /** null = colocação (fase 1); número = origem do deslocamento. */
  from: number | null;
  to: number;
  /** Peça inimiga capturada nesta jogada, se um moinho foi fechado. */
  remove: number | null;
}

export type GameEndCallback = (winner: Player, reason: string) => void;

let gameEndCallback: GameEndCallback | null = null;

export function setGameEndCallback(callback: GameEndCallback | null) {
  gameEndCallback = callback;
}

export const PIECES_PER_PLAYER = 9;

export function opponent(p: Player): Player {
  return p === 1 ? 2 : 1;
}

export function createInitialState(): GameState {
  return {
    board: Array<Cell>(NODE_COUNT).fill(0),
    turn: 1,
    hand: { 1: PIECES_PER_PLAYER, 2: PIECES_PER_PLAYER },
    captured: { 1: 0, 2: 0 },
    phase: "placing",
    winner: null,
    reason: null,
    ply: 0,
  };
}

export function cloneState(s: GameState): GameState {
  return {
    board: s.board.slice(),
    turn: s.turn,
    hand: { 1: s.hand[1], 2: s.hand[2] },
    captured: { 1: s.captured[1], 2: s.captured[2] },
    phase: s.phase,
    winner: s.winner,
    reason: s.reason,
    ply: s.ply,
  };
}

export function countOnBoard(board: Cell[], player: Player): number {
  let n = 0;
  for (let i = 0; i < board.length; i++) if (board[i] === player) n++;
  return n;
}

/** Total de peças do jogador (tabuleiro + reserva). */
export function totalPieces(s: GameState, player: Player): number {
  return countOnBoard(s.board, player) + s.hand[player];
}

/** O nó faz parte de um moinho fechado do dono dele? */
export function isInMill(board: Cell[], node: number): boolean {
  const owner = board[node];
  if (owner === 0) return false;
  for (const mill of MILLS_BY_NODE[node] ?? []) {
    if (board[mill[0]!] === owner && board[mill[1]!] === owner && board[mill[2]!] === owner) {
      return true;
    }
  }
  return false;
}

/** Moinhos fechados do jogador que contêm `node` (após a peça já estar posta). */
export function millsFormedAt(board: Cell[], node: number, player: Player) {
  return (MILLS_BY_NODE[node] ?? []).filter(
    (m) => board[m[0]!] === player && board[m[1]!] === player && board[m[2]!] === player,
  );
}

export function countMills(board: Cell[], player: Player): number {
  let n = 0;
  for (const m of MILLS) {
    if (board[m[0]!] === player && board[m[1]!] === player && board[m[2]!] === player) n++;
  }
  return n;
}

/** O jogador está em "voo"? (exatamente 3 peças, já sem reserva) */
export function canFly(s: GameState, player: Player): boolean {
  return s.hand[player] === 0 && countOnBoard(s.board, player) === 3;
}

/** Alvos capturáveis: peças fora de moinho; se todas estiverem em moinho, libera todas. */
export function removableTargets(board: Cell[], victim: Player): number[] {
  const owned: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === victim) owned.push(i);
  const free = owned.filter((i) => !isInMill(board, i));
  return free.length > 0 ? free : owned;
}

/** Destinos legais para uma peça (adjacentes vazios, ou qualquer vazio se estiver voando). */
export function legalDestinations(s: GameState, from: number): number[] {
  const player = s.board[from];
  if (player === 0 || player !== s.turn || s.phase !== "moving") return [];
  if (canFly(s, player)) {
    const out: number[] = [];
    for (let i = 0; i < s.board.length; i++) if (s.board[i] === 0) out.push(i);
    return out;
  }
  return (ADJACENCY[from] ?? []).filter((n) => s.board[n] === 0);
}

export function legalPlacements(s: GameState): number[] {
  if (s.phase !== "placing") return [];
  const out: number[] = [];
  for (let i = 0; i < s.board.length; i++) if (s.board[i] === 0) out.push(i);
  return out;
}

/** Todas as jogadas legais (já expandidas com cada captura possível). */
export function generateMoves(s: GameState): Move[] {
  if (s.phase === "over" || s.winner) return [];
  const player = s.turn;
  const foe = opponent(player);
  const moves: Move[] = [];

  const push = (from: number | null, to: number) => {
    const next = s.board.slice();
    if (from !== null) next[from] = 0;
    next[to] = player;
    if (millsFormedAt(next, to, player).length > 0) {
      for (const target of removableTargets(next, foe)) {
        moves.push({ from, to, remove: target });
      }
    } else {
      moves.push({ from, to, remove: null });
    }
  };

  if (s.phase === "placing") {
    for (let i = 0; i < s.board.length; i++) if (s.board[i] === 0) push(null, i);
    return moves;
  }

  const flying = canFly(s, player);
  for (let from = 0; from < s.board.length; from++) {
    if (s.board[from] !== player) continue;
    if (flying) {
      for (let to = 0; to < s.board.length; to++) if (s.board[to] === 0) push(from, to);
    } else {
      for (const to of ADJACENCY[from] ?? []) if (s.board[to] === 0) push(from, to);
    }
  }
  return moves;
}

export function hasAnyMove(s: GameState): boolean {
  if (s.phase === "placing") return s.board.some((c) => c === 0);
  const player = s.turn;
  if (canFly(s, player)) return s.board.some((c) => c === 0);
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] === player && (ADJACENCY[i] ?? []).some((n) => s.board[n] === 0)) return true;
  }
  return false;
}

export interface ValidationError {
  ok: false;
  error: string;
}
export type ValidationResult = { ok: true } | ValidationError;

/** Validação autoritativa de uma jogada contra o estado atual. */
export function validateMove(s: GameState, move: Move, actor: Player): ValidationResult {
  if (s.phase === "over" || s.winner) return { ok: false, error: "Partida encerrada." };
  if (actor !== s.turn) return { ok: false, error: "Não é o seu turno." };
  if (move.to < 0 || move.to >= NODE_COUNT) return { ok: false, error: "Posição inválida." };
  if (s.board[move.to] !== 0) return { ok: false, error: "Posição ocupada." };

  if (s.phase === "placing") {
    if (move.from !== null) return { ok: false, error: "Fase de colocação: não se move peças." };
    if (s.hand[actor] <= 0) return { ok: false, error: "Sem peças na reserva." };
  } else {
    if (move.from === null) return { ok: false, error: "Fase de movimentação: informe a origem." };
    if (s.board[move.from] !== actor) return { ok: false, error: "A peça de origem não é sua." };
    if (!canFly(s, actor) && !(ADJACENCY[move.from] ?? []).includes(move.to)) {
      return { ok: false, error: "Destino não adjacente." };
    }
  }

  const next = s.board.slice();
  if (move.from !== null) next[move.from] = 0;
  next[move.to] = actor;
  const formed = millsFormedAt(next, move.to, actor).length > 0;

  if (formed) {
    if (move.remove === null) return { ok: false, error: "Moinho formado: escolha uma captura." };
    const targets = removableTargets(next, opponent(actor));
    if (!targets.includes(move.remove)) return { ok: false, error: "Captura não permitida." };
  } else if (move.remove !== null) {
    return { ok: false, error: "Nenhum moinho formado: captura inválida." };
  }

  return { ok: true };
}

/** Aplica a jogada (assume validada) e devolve o novo estado imutável. */
export function applyMove(s: GameState, move: Move): GameState {
  const next = cloneState(s);
  const actor = next.turn;
  const foe = opponent(actor);

  if (move.from === null) {
    next.hand[actor] -= 1;
  } else {
    next.board[move.from] = 0;
  }
  next.board[move.to] = actor;

  if (move.remove !== null) {
    next.board[move.remove] = 0;
    next.captured[actor] += 1;
  }

  next.ply += 1;
  next.turn = foe;
  if (next.hand[1] === 0 && next.hand[2] === 0 && next.phase === "placing") {
    next.phase = "moving";
  }

  // Condições de fim de jogo, avaliadas para quem vai jogar agora.
  if (next.phase === "moving") {
    if (countOnBoard(next.board, foe) < 3) {
      next.phase = "over";
      next.winner = actor;
      next.reason = "annihilation";
      if (gameEndCallback) gameEndCallback(actor, "annihilation");
    } else if (!hasAnyMove(next)) {
      next.phase = "over";
      next.winner = actor;
      next.reason = "blockade";
      if (gameEndCallback) gameEndCallback(actor, "blockade");
    }
  }

  return next;
}

/** Aplica com validação — usado pelo servidor/online. */
export function tryApplyMove(
  s: GameState,
  move: Move,
  actor: Player,
): { ok: true; state: GameState } | ValidationError {
  const v = validateMove(s, move, actor);
  if (!v.ok) return v;
  return { ok: true, state: applyMove(s, move) };
}

export function resign(s: GameState, player: Player): GameState {
  const next = cloneState(s);
  next.phase = "over";
  next.winner = opponent(player);
  next.reason = "resign";
  return next;
}

export function timeout(s: GameState, player: Player): GameState {
  const next = cloneState(s);
  next.phase = "over";
  next.winner = opponent(player);
  next.reason = "timeout";
  return next;
}

/* ------------------------------ serialização ------------------------------ */

export interface SerializedState {
  board: number[];
  turn: Player;
  hand: [number, number];
  captured: [number, number];
  phase: Phase;
  winner: Player | null;
  reason: GameState["reason"];
  ply: number;
}

export function serialize(s: GameState): SerializedState {
  return {
    board: s.board.slice(),
    turn: s.turn,
    hand: [s.hand[1], s.hand[2]],
    captured: [s.captured[1], s.captured[2]],
    phase: s.phase,
    winner: s.winner,
    reason: s.reason,
    ply: s.ply,
  };
}

export function deserialize(raw: unknown): GameState {
  const fallback = createInitialState();
  if (!raw || typeof raw !== "object") return fallback;
  const d = raw as Partial<SerializedState>;
  if (!Array.isArray(d.board) || d.board.length !== NODE_COUNT) return fallback;
  return {
    board: d.board.map((c) => (c === 1 || c === 2 ? (c as Player) : 0)) as Cell[],
    turn: d.turn === 2 ? 2 : 1,
    hand: { 1: d.hand?.[0] ?? 0, 2: d.hand?.[1] ?? 0 },
    captured: { 1: d.captured?.[0] ?? 0, 2: d.captured?.[1] ?? 0 },
    phase: d.phase === "moving" || d.phase === "over" ? d.phase : "placing",
    winner: d.winner === 1 || d.winner === 2 ? d.winner : null,
    reason: d.reason ?? null,
    ply: d.ply ?? 0,
  };
}
