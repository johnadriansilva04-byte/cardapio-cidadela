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
export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
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
  const url =
    import.meta.env?.VITE_SUPABASE_URL || "";
  const key =
    import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
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
