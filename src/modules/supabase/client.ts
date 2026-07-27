import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hkzhksauilonqppipjyc.supabase.co";
const supabaseKey = "sb_publishable_qT04tnP1_XEbAZ5EHw02FQ_CFDtX_LM";

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Battle = {
  id: string;
  topic: string;
  player1_id: string;
  player1_name: string;
  player1_robot: any;
  player2_id: string | null;
  player2_name: string | null;
  player2_robot: any | null;
  status: "waiting" | "active" | "completed";
  current_round: number;
  messages: any[];
  winner: string | null;
  created_at: string;
};
