import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hkzhksauilonqppipjyc.supabase.co";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_qT04tnP1_XEbAZ5EHw02FQ_CFDtX_LM";

export const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// TIPOS GENÉRICOS DE JOGO
// ============================================

export type GameType = "battle" | "iq_test" | "chess" | "dama" | "trilha";
export type GameStatus = "waiting" | "active" | "completed" | "abandoned";

export type GameSession = {
  id: string;
  game_type: GameType;
  player1_id: string;
  player1_name: string;
  player1_data: Record<string, any>;
  player2_id: string | null;
  player2_name: string | null;
  player2_data: Record<string, any>;
  status: GameStatus;
  current_turn: number;
  winner: string | null;
  game_state: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type GameMove = {
  id: string;
  session_id: string;
  player_id: string;
  player_number: 1 | 2;
  move_type: string;
  move_data: Record<string, any>;
  timestamp: string;
  round_number: number;
};

// ============================================
// TIPOS ESPECÍFICOS POR JOGO
// ============================================

// Battle Arena
export type BattleRobot = {
  name: string;
  ideology: string;
  personality: string;
  strategy: string;
  aggressiveness: number;
  eloquence: number;
  logic: number;
  hp: number;
};

export type BattleMessage = {
  id: number;
  player_id: string;
  text: string;
  timestamp: string;
};

export type BattleGameState = {
  topic: string;
  current_round: number;
  messages: BattleMessage[];
  robot1: BattleRobot;
  robot2: BattleRobot;
};

// IQ Test
export type IQQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  difficulty: "easy" | "medium" | "hard";
};

export type IQAnswer = {
  player_id: string;
  question_id: string;
  answer: number;
  is_correct: boolean;
  time_taken: number;
};

export type IQTestGameState = {
  current_question: number;
  score_player1: number;
  score_player2: number;
  questions: IQQuestion[];
  answers: IQAnswer[];
  time_limit: number;
};

// Chess/Dama
export type ChessGameState = {
  board: string[][];
  pieces: { player1: string[]; player2: string[] };
  captured_pieces: { player1: string[]; player2: string[] };
  is_check: boolean;
  is_checkmate: boolean;
  is_stalemate: boolean;
  castling_rights: {
    player1: { kingside: boolean; queenside: boolean };
    player2: { kingside: boolean; queenside: boolean };
  };
  en_passant_target: string | null;
};

// Trilha (Nine Men's Morris)
export type TrilhaPhase = "placement" | "movement" | "flying";

export type TrilhaBoard = {
  [position: string]: "player1" | "player2" | null;
};

export type TrilhaGameState = {
  phase: TrilhaPhase;
  board: TrilhaBoard;
  pieces_remaining: { player1: number; player2: number };
  pieces_on_board: { player1: number; player2: number };
  last_mill: string | null;
  must_capture: boolean;
  blocked_positions: { [position: string]: boolean };
};

export type TrilhaMoveData =
  | { type: "place"; position: number }
  | { type: "move"; from: number; to: number }
  | { type: "capture"; position: number; captured_piece: number }
  | { type: "fly"; from: number; to: number };
