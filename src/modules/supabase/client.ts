import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Legacy types for game matchmaking (preserved for Cidadela components)
export type GameType = "battle" | "trilha" | "iq_test";

export interface GameSession {
  id: string;
  game_type: GameType;
  player1_id: string;
  player1_name: string;
  player1_data: Record<string, unknown>;
  player2_id: string | null;
  player2_name: string | null;
  player2_data: Record<string, unknown> | null;
  status: "waiting" | "active" | "completed";
  current_turn: number;
  game_state: Record<string, unknown>;
  winner: string | null;
  created_at: string;
}

export interface GameMove {
  id: string;
  session_id: string;
  player_id: string;
  player_number: number;
  move_type: string;
  move_data: Record<string, unknown>;
  round_number: number;
  timestamp: string;
}
