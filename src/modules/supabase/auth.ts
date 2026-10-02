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
  avatar_url: string;
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

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Envia a foto de perfil para o bucket `avatars` e grava a URL no perfil.
 * Caminho `avatars/<uid>/avatar_<ts>.<ext>` — a policy do Storage só deixa o
 * próprio usuário escrever na pasta dele.
 */
export async function updateProfileAvatar(
  file: File,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "Você não está autenticado." };
  if (!AVATAR_MIME.has(file.type)) {
    return { ok: false, error: "Formato não permitido. Use JPG, PNG ou WebP." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "Arquivo muito grande (máx. 5 MB)." };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true, cacheControl: "3600" });
  if (uploadError) {
    const msg = uploadError.message ?? "";
    console.error("[auth] avatar upload error:", msg);
    if (/bucket.*not found|No such bucket/i.test(msg)) {
      return {
        ok: false,
        error:
          "Bucket 'avatars' não encontrado. Rode o supabase/schema.sql no SQL Editor do Supabase.",
      };
    }
    if (/row-level security|row level security/i.test(msg)) {
      return { ok: false, error: "Sem permissão para enviar a foto. Faça login novamente." };
    }
    return { ok: false, error: "Não foi possível enviar a foto. Tente novamente." };
  }

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (profileError) {
    const msg = profileError.message ?? "";
    console.error("[auth] avatar profile update error:", msg);
    if (/column|avatar_url|PGRST204|42703/i.test(msg)) {
      return {
        ok: false,
        error:
          "Coluna 'avatar_url' não existe. Rode o supabase/schema.sql no SQL Editor do Supabase.",
      };
    }
    return { ok: false, error: "Foto enviada, mas não foi possível salvar no perfil." };
  }

  // Mantém o metadata em sincronia para o menu lateral atualizar sem recarregar.
  await supabase.auth.updateUser({ data: { avatar_url: url } });
  return { ok: true, url };
}

/**
 * Remove a foto de perfil (mantém as iniciais como fallback).
 */
export async function removeProfileAvatar(): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "Você não está autenticado." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: "", updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (profileError) {
    console.error("[auth] avatar remove error:", profileError.message);
    return { ok: false, error: "Não foi possível remover a foto." };
  }
  await supabase.auth.updateUser({ data: { avatar_url: "" } });
  return { ok: true };
}

/**
 * Troca o telefone de acesso do usuário.
 *
 * Como o login usa telefone→pseudo-email, mudar o telefone significa mudar o
 * email da conta. Se a confirmação por email estiver ligada no projeto, o
 * Supabase manda um link para o endereço novo e a troca só vale depois do
 * clique — nesse caso devolvemos `pending` para a UI avisar em vez de fingir
 * sucesso. O perfil também é atualizado (nome do telefone e metadata).
 */
export async function updateProfilePhone(
  newPhone: string,
  password: string,
): Promise<{ ok: boolean; pending?: boolean; error?: string }> {
  const digits = normalizePhone(newPhone);
  if (digits.length < 10) {
    return { ok: false, error: "Informe um telefone válido com DDD." };
  }
  if (!password) {
    return { ok: false, error: "Informe sua senha para confirmar." };
  }

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "Você não está autenticado." };

  const currentDigits = normalizePhone((user.user_metadata?.phone as string) || "");
  if (currentDigits && currentDigits === digits) {
    return { ok: false, error: "Este já é o seu telefone." };
  }

  // Confirma a identidade antes de mexer no acesso (o telefone atual continua
  // válido enquanto o novo não é confirmado).
  if (currentDigits) {
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(currentDigits),
      password,
    });
    if (reauthError) {
      return { ok: false, error: "Senha incorreta." };
    }
  }

  const { data: updated, error: emailError } = await supabase.auth.updateUser({
    email: phoneToEmail(digits),
    data: { phone: digits, display_phone: newPhone.trim() },
  });
  if (emailError) {
    console.error("[auth] update phone error:", emailError.message);
    return { ok: false, error: "Não foi possível alterar o telefone." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ phone: digits, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (profileError) {
    // Não é fatal: o login já aponta para o telefone novo.
    console.warn("[auth] update profile phone error:", profileError.message);
  }

  // Com "Confirm email" ligado, o Supabase mantém o email antigo até o link ser
  // clicado — o novo endereço aparece em new_email.
  const pending = Boolean(updated?.user?.new_email);
  return { ok: true, pending };
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
 */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env?.VITE_SUPABASE_URL || "";
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
  return Boolean(url && key && !url.includes("placeholder"));
}

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
