/**
 * IA da máquina: Minimax com poda Alfa-Beta, ordenação de jogadas,
 * função de avaliação ponderada por fase e aprofundamento iterativo com
 * orçamento de tempo (mantém a UI responsiva).
 */
import { ADJACENCY } from "./board";
import {
  applyMove,
  canFly,
  countMills,
  countOnBoard,
  generateMoves,
  hasAnyMove,
  isInMill,
  opponent,
  type GameState,
  type Move,
  type Player,
} from "./engine";

export type Difficulty = "recruta" | "sargento" | "general";

export interface AiProfile {
  label: string;
  depth: number;
  /** Probabilidade de jogar uma alternativa sub-ótima (imperfeição humana). */
  blunder: number;
  timeBudgetMs: number;
  description: string;
}

export const AI_PROFILES: Record<Difficulty, AiProfile> = {
  recruta: {
    label: "Recruta",
    depth: 1,
    blunder: 0.35,
    timeBudgetMs: 250,
    description: "Recém-chegado ao front. Enxerga só a jogada imediata e hesita sob pressão.",
  },
  sargento: {
    label: "Sargento",
    depth: 3,
    blunder: 0.08,
    timeBudgetMs: 700,
    description: "Veterano de patrulha. Antecipa três lances, bloqueia trilhas e arma emboscadas.",
  },
  general: {
    label: "General",
    depth: 5,
    blunder: 0,
    timeBudgetMs: 1800,
    description: "Estado-maior. Planeja campanhas inteiras com poda alfa-beta profunda.",
  },
};

const WIN = 100000;

interface Weights {
  mill: number;
  blockedFoe: number;
  material: number;
  twoInLine: number;
  threeInLine: number;
  doubleMill: number;
  mobility: number;
}

const PLACING_W: Weights = {
  mill: 26,
  blockedFoe: 1,
  material: 9,
  twoInLine: 10,
  threeInLine: 7,
  doubleMill: 42,
  mobility: 0,
};

const MOVING_W: Weights = {
  mill: 43,
  blockedFoe: 10,
  material: 11,
  twoInLine: 8,
  threeInLine: 0,
  doubleMill: 42,
  mobility: 5,
};

/** Configurações de 2/3 peças alinhadas com casa vazia disponível. */
import { MILLS } from "./board";

function lineStats(state: GameState, player: Player) {
  let two = 0;
  let three = 0;
  for (const m of MILLS) {
    let own = 0;
    let empty = 0;
    for (const n of m) {
      const c = state.board[n];
      if (c === player) own++;
      else if (c === 0) empty++;
    }
    if (own === 2 && empty === 1) two++;
    if (own === 1 && empty === 2) three++;
  }
  return { two, three };
}

function doubleMills(state: GameState, player: Player): number {
  let count = 0;
  for (let n = 0; n < state.board.length; n++) {
    if (state.board[n] !== player) continue;
    let mills = 0;
    for (const m of MILLS) {
      if (!m.includes(n)) continue;
      if (
        state.board[m[0]!] === player &&
        state.board[m[1]!] === player &&
        state.board[m[2]!] === player
      )
        mills++;
    }
    if (mills >= 2) count++;
  }
  return count;
}

function blockedPieces(state: GameState, player: Player): number {
  if (canFly(state, player)) return 0;
  let blocked = 0;
  for (let n = 0; n < state.board.length; n++) {
    if (state.board[n] !== player) continue;
    if (!(ADJACENCY[n] ?? []).some((a) => state.board[a] === 0)) blocked++;
  }
  return blocked;
}

function mobility(state: GameState, player: Player): number {
  if (canFly(state, player)) return 12;
  let m = 0;
  for (let n = 0; n < state.board.length; n++) {
    if (state.board[n] !== player) continue;
    for (const a of ADJACENCY[n] ?? []) if (state.board[a] === 0) m++;
  }
  return m;
}

/** Avaliação do ponto de vista de `me`. */
export function evaluate(state: GameState, me: Player): number {
  const foe = opponent(me);

  if (state.winner) return state.winner === me ? WIN : -WIN;

  const myCount = countOnBoard(state.board, me) + state.hand[me];
  const foeCount = countOnBoard(state.board, foe) + state.hand[foe];
  if (state.phase === "moving") {
    if (countOnBoard(state.board, foe) < 3) return WIN;
    if (countOnBoard(state.board, me) < 3) return -WIN;
  }

  const w = state.phase === "placing" ? PLACING_W : MOVING_W;
  const myLines = lineStats(state, me);
  const foeLines = lineStats(state, foe);

  let score = 0;
  score += w.mill * (countMills(state.board, me) - countMills(state.board, foe));
  score += w.material * (myCount - foeCount);
  score += w.twoInLine * (myLines.two - foeLines.two);
  score += w.threeInLine * (myLines.three - foeLines.three);
  score += w.doubleMill * (doubleMills(state, me) - doubleMills(state, foe));
  score += w.blockedFoe * (blockedPieces(state, foe) - blockedPieces(state, me));
  score += w.mobility * (mobility(state, me) - mobility(state, foe));

  return score;
}

/** Heurística barata para ordenar jogadas e melhorar a poda. */
function orderMoves(state: GameState, moves: Move[], me: Player): Move[] {
  return moves
    .map((move) => {
      let s = 0;
      if (move.remove !== null) s += 1000;
      if (isInMill(state.board, move.to)) s += 5;
      s += (ADJACENCY[move.to] ?? []).length; // interseções centrais valem mais
      if (move.from !== null && isInMill(state.board, move.from)) s += 8; // abrir/fechar moinho
      return { move, s: state.turn === me ? s : -s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.move);
}

interface SearchCtx {
  me: Player;
  deadline: number;
  nodes: number;
  aborted: boolean;
}

function negamax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchCtx,
): number {
  ctx.nodes++;
  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.aborted = true;

  const perspective = state.turn === ctx.me ? 1 : -1;

  if (state.winner) return perspective * (state.winner === state.turn ? WIN : -WIN) * perspective;
  if (depth <= 0 || ctx.aborted) return evaluate(state, ctx.me) * perspective;

  const moves = generateMoves(state);
  if (moves.length === 0 || !hasAnyMove(state)) {
    // Quem está para jogar e não pode mover, perde por bloqueio.
    return state.turn === ctx.me ? -WIN + state.ply : WIN - state.ply;
  }

  let best = -Infinity;
  for (const move of orderMoves(state, moves, state.turn)) {
    const child = applyMove(state, move);
    const score = -negamax(child, depth - 1, -beta, -alpha, ctx);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
    if (ctx.aborted) break;
  }
  return best;
}

export interface AiDecision {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
  elapsedMs: number;
}

/** Escolhe a jogada da máquina com aprofundamento iterativo + orçamento de tempo. */
export function chooseMove(state: GameState, difficulty: Difficulty): AiDecision {
  const profile = AI_PROFILES[difficulty];
  const me = state.turn;
  const start = Date.now();
  const moves = generateMoves(state);
  if (moves.length === 0) {
    return { move: null, score: 0, depth: 0, nodes: 0, elapsedMs: 0 };
  }

  const ctx: SearchCtx = {
    me,
    deadline: start + profile.timeBudgetMs,
    nodes: 0,
    aborted: false,
  };

  let bestMove: Move = moves[0]!;
  let bestScore = -Infinity;
  let reachedDepth = 0;
  let ranked: Array<{ move: Move; score: number }> = [];

  for (let depth = 1; depth <= profile.depth; depth++) {
    const results: Array<{ move: Move; score: number }> = [];
    let alpha = -Infinity;
    for (const move of orderMoves(state, moves, me)) {
      const child = applyMove(state, move);
      const score = -negamax(child, depth - 1, -Infinity, -alpha, ctx);
      results.push({ move, score });
      if (score > alpha) alpha = score;
      if (ctx.aborted) break;
    }
    if (results.length === 0) break;
    results.sort((a, b) => b.score - a.score);
    ranked = results;
    bestMove = results[0]!.move;
    bestScore = results[0]!.score;
    reachedDepth = depth;
    if (ctx.aborted || Math.abs(bestScore) >= WIN) break;
  }

  // Imperfeição controlada: níveis baixos às vezes escolhem a 2ª/3ª melhor jogada.
  if (profile.blunder > 0 && ranked.length > 1 && Math.random() < profile.blunder) {
    const pool = ranked.slice(0, Math.min(4, ranked.length));
    const pick = pool[1 + Math.floor(Math.random() * (pool.length - 1))];
    if (pick) bestMove = pick.move;
  }

  return {
    move: bestMove,
    score: bestScore,
    depth: reachedDepth,
    nodes: ctx.nodes,
    elapsedMs: Date.now() - start,
  };
}
