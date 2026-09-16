import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _clientKey = "";

function getEnv(key: string): string {
  // Vite injects VITE_* via import.meta.env; SSR may also have process.env
  try {
    // @ts-ignore
    const v = import.meta.env?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  } catch {
    /* ignore */
  }
  try {
    // @ts-ignore
    const v = (globalThis as unknown as { process?: { env?: Record<string, string> } })?.process
      ?.env?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  } catch {
    /* ignore */
  }
  return "";
}

function getSupabaseUrl(): string {
  // Um "/" final quebra a montagem das URLs /auth/v1 e /rest/v1.
  return getEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
}

function getSupabaseAnonKey(): string {
  return getEnv("VITE_SUPABASE_ANON_KEY");
}

function makeClient(url: string, key: string): SupabaseClient {
  if (!url || !key) {
    // Placeholder that won't throw during SSR/build but will be replaced once env is present.
    // We keep realtime/data calls as no-ops so UI degrades gracefully.
    return createClient(
      url || "https://placeholder.supabase.co",
      key || "placeholder-key",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function getSupabase(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  const cacheKey = `${url}::${key}`;
  if (!_client || _clientKey !== cacheKey) {
    _client = makeClient(url, key);
    _clientKey = cacheKey;
  }
  return _client;
}

// Named export for backward compatibility — lazy proxy so `supabase.from()` always hits current client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase() as unknown as Record<string | symbol, unknown>;
    const value = client[prop as string];
    // bind functions to client
    if (typeof value === "function") return (value as (...args: unknown[]) => unknown).bind(client);
    return value;
  },
  has(_target, prop) {
    const client = getSupabase() as unknown as Record<string | symbol, unknown>;
    return prop in (client as object);
  },
});

export function isSupabasePlaceholder(): boolean {
  return !getSupabaseUrl() || !getSupabaseAnonKey();
}

/**
 * Resolve a configuração do Supabase por um único caminho.
 *
 * `client.ts` e `auth.ts` já leram essas variáveis de formas diferentes no
 * passado — o cliente aceitava `process.env` como fallback e o gate do login
 * não — o que fazia a tela dizer "Supabase não configurado" com o cliente
 * conectado. Manter a resolução aqui garante que os dois concordem.
 */
export function getSupabaseConfig(): {
  url: string;
  key: string;
  configured: boolean;
} {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return {
    url,
    key,
    configured: Boolean(url && key && !url.includes("placeholder")),
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().configured;
}

/** Nomes das variáveis ausentes, para a tela de login dizer o que falta. */
export function missingSupabaseEnvVars(): string[] {
  const missing: string[] = [];
  if (!getSupabaseUrl()) missing.push("VITE_SUPABASE_URL");
  if (!getSupabaseAnonKey()) missing.push("VITE_SUPABASE_ANON_KEY");
  return missing;
}

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
