import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hkzhksauilonqppipjyc.supabase.co";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_qT04tnP1_XEbAZ5EHw02FQ_CFDtX_LM";

export const supabase = createClient(supabaseUrl, supabaseKey);

type Robot = {
  name: string;
  ideology: string;
  personality: string;
  strategy: string;
  aggressiveness: number;
  eloquence: number;
  logic: number;
  hp: number;
};

type BattleMessage = {
  id: number;
  player_id: string;
  text: string;
  timestamp: string;
};

export type Battle = {
  id: string;
  topic: string;
  player1_id: string;
  player1_name: string;
  player1_robot: Robot;
  player2_id: string | null;
  player2_name: string | null;
  player2_robot: Robot | null;
  status: "waiting" | "active" | "completed";
  current_round: number;
  messages: BattleMessage[];
  winner: string | null;
  created_at: string;
};
