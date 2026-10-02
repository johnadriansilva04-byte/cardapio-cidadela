import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _clientKey = "";

function getEnv(key: string): string {
  // Vite injects VITE_* via import.meta.env; SSR may also have process.env
  try {
    const v = import.meta.env?.[key];
    if (typeof v === "string" && v) return v;
  } catch {
    /* ignore */
  }
  try {
    const v = (globalThis as unknown as { process?: { env?: Record<string, string> } })?.process
      ?.env?.[key];
    if (typeof v === "string" && v) return v;
  } catch {
    /* ignore */
  }
  return "";
}

function getSupabaseUrl(): string {
  return getEnv("VITE_SUPABASE_URL");
}

function getSupabaseAnonKey(): string {
  return getEnv("VITE_SUPABASE_ANON_KEY");
}

function makeClient(url: string, key: string): SupabaseClient {
  if (!url || !key) {
    // Placeholder that won't throw during SSR/build but will be replaced once env is present.
    // We keep realtime/data calls as no-ops so UI degrades gracefully.
    return createClient(url || "https://placeholder.supabase.co", key || "placeholder-key");
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
