import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  try {
    return import.meta.env?.VITE_SUPABASE_URL || "";
  } catch {
    return "";
  }
}

function getSupabaseAnonKey(): string {
  try {
    return import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
  } catch {
    return "";
  }
}

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    if (!url || !key) {
      _client = createClient(
        url || "https://placeholder.supabase.co",
        key || "placeholder-key",
      );
    } else {
      _client = createClient(url, key);
    }
  }
  return _client;
}

// Named export for backward compatibility — lazy proxy
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabase() as unknown as Record<string | symbol, unknown>;
    return client[prop];
  },
});

// Legacy types for game matchmaking
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
