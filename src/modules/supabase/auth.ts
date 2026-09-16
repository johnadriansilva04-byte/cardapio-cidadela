import { supabase } from "./client";
import type { User, Session, AuthError } from "@supabase/supabase-js";

// ============================================================
// Phone-to-email mapping for Supabase Auth
// Supabase Auth requires an email for password-based login.
// We map phone numbers to a deterministic pseudo-email.
// ============================================================

/** Normalize phone to digits-only format */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Convert a normalized phone to a Supabase Auth email */
function phoneToEmail(phone: string): string {
  const digits = normalizePhone(phone);
  return `${digits}@menufacil.local`;
}

// ============================================================
// User profile type (from the `profiles` table)
// ============================================================

export type UserRole = "admin" | "owner" | "user";

export interface UserProfile {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Auth API
// ============================================================

/**
 * Sign up a new user with phone + password.
 * Also creates a profile row in the `profiles` table.
 */
export async function signUpWithPhone(
  phone: string,
  password: string,
  name: string,
): Promise<{ user: User | null; error: AuthError | null }> {
  const email = phoneToEmail(phone);
  const normalizedPhone = normalizePhone(phone);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone: normalizedPhone,
        name,
        display_phone: phone,
      },
    },
  });

  if (error || !data.user) {
    return { user: null, error };
  }

  // Create profile row
  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    phone: normalizedPhone,
    name,
    role: "owner",
  });

  if (profileError) {
    console.error("Error creating profile:", profileError);
    // Don't block signup — profile creation is best-effort
  }

  return { user: data.user, error: null };
}

/**
 * Sign in with phone + password.
 * Maps phone to the internal email and uses Supabase Auth password sign-in.
 */
export async function signInWithPhone(
  phone: string,
  password: string,
): Promise<{ session: Session | null; error: AuthError | null }> {
  const email = phoneToEmail(phone);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { session: null, error };
  }

  return { session: data.session, error: null };
}

/** Sign out the current user */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Update the user's profile (name) in the `profiles` table.
 * Returns true on success.
 */
export async function updateProfileName(name: string): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "Você não está autenticado." };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Informe seu nome." };

  // Update profile table
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (profileError) {
    console.error("[auth] update profile error:", profileError.message);
    return { ok: false, error: "Erro ao atualizar o perfil." };
  }

  // Also update auth metadata so the sidebar updates
  const { error: metaError } = await supabase.auth.updateUser({
    data: { name: trimmed },
  });
  if (metaError) {
    // Non-fatal — profile updated, metadata may lag
    console.warn("[auth] update metadata error:", metaError.message);
  }

  return { ok: true };
}

/**
 * Update the user's password.
 * Verifies a required current password if provided (best-effort on the
 * phone→pseudo email mapping), then updates via Supabase.
 */
export async function updatePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: "A nova senha deve ter no mínimo 6 caracteres." };
  }
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "Você não está autenticado." };

  // Re-authenticate with current password (Supabase maps phone→pseudo email)
  const digits = (user.user_metadata?.phone as string) || normalizePhone(user.phone || "");
  if (digits && currentPassword) {
    const emailToUse = `${digits.replace(/\D/g, "")}@menufacil.local`;
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: currentPassword,
    });
    if (reauthError) {
      return { ok: false, error: "Senha atual incorreta." };
    }
  } else if (!currentPassword) {
    return { ok: false, error: "Informe a senha atual." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    console.error("[auth] update password error:", updateError.message);
    return { ok: false, error: "Erro ao alterar a senha." };
  }
  return { ok: true };
}

/**
 * Exclui a conta do usuário atual.
 * Delega para a RPC `delete_own_account` (SECURITY DEFINER) que remove os
 * restaurantes do dono (CASCADE) e depois o registro em auth.users (que
 * cascateia para profiles). Não é possível apagar o próprio auth user com a
 * chave anon do cliente — por isso a lógica vive no banco.
 */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "Você não está autenticado." };

  try {
    const { error: rpcErr } = await supabase.rpc("delete_own_account");
    if (rpcErr) {
      console.error("[auth] delete_own_account rpc error:", rpcErr.message);
      return {
        ok: false,
        error:
          "Não foi possível excluir a conta agora. Verifique se o schema.sql foi atualizado no Supabase ou tente novamente.",
      };
    }
  } catch (err) {
    console.error("[auth] delete_own_account exception:", err);
    return { ok: false, error: "Erro inesperado ao excluir a conta." };
  }

  await supabase.auth.signOut();
  return { ok: true };
}

/** Get the current session (returns null if no session) */
export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Get the current user (returns null if not authenticated) */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Fetch the user profile from the `profiles` table.
 * Returns null if no profile exists.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as UserProfile;
}

/**
 * Check if a user has admin role.
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.role === "admin";
}

/**
 * Get the user's display phone number from metadata.
 */
export function getDisplayPhone(user: User | null): string {
  if (!user) return "";
  return (user.user_metadata?.display_phone as string) ?? "";
}

/**
 * Get the user's name from metadata or profile.
 */
export function getUserName(user: User | null): string {
  if (!user) return "";
  return (user.user_metadata?.name as string) ?? "";
}

/**
 * Listen to auth state changes.
 * Returns the unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => subscription.unsubscribe();
}

/**
 * Check if Supabase is properly configured (URL and key are set).
 *
 * Delega para `client.ts`: o cliente e este gate precisam concordar, senão a
 * tela de login acusa "não configurado" enquanto o cliente funciona.
 */
export { isSupabaseConfigured, missingSupabaseEnvVars } from "./client";

/**
 * SQL to create the profiles table in Supabase.
 * Run this in the Supabase SQL Editor if the table doesn't exist:
 *
 * ```sql
 * CREATE TABLE IF NOT EXISTS profiles (
 *   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *   phone TEXT NOT NULL,
 *   name TEXT NOT NULL DEFAULT '',
 *   role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('admin', 'owner', 'user')),
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- Enable RLS
 * ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
 *
 * -- Users can read their own profile
 * CREATE POLICY "Users can view own profile"
 *   ON profiles FOR SELECT
 *   USING (auth.uid() = id);
 *
 * -- Users can update their own profile
 * CREATE POLICY "Users can update own profile"
 *   ON profiles FOR UPDATE
 *   USING (auth.uid() = id);
 *
 * -- Allow insert for signup (service role handles this)
 * CREATE POLICY "Allow profile creation"
 *   ON profiles FOR INSERT
 *   WITH CHECK (auth.uid() = id);
 * ```
 */
