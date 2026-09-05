import { useState, useEffect } from "react";
import { supabase } from "./client";
import { generateUniqueSlug, seedDefaultMenu } from "./restaurants";

/**
 * Legacy compatibility — now wraps the restaurants table.
 * Kept for backward compatibility with any code referencing useAdminTrial.
 */

export interface AdminTrial {
  id: string;
  store_id: string;
  store_name: string | null;
  store_slogan: string | null;
  store_marquee: string | null;
  pix_key: string | null;
  whatsapp: string | null;
  admin_phone: string | null;
  admin_email: string | null;
  trial_started_at: string;
  trial_expires_at: string;
  is_active: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
}

export function isTrialValid(_trial: AdminTrial | null): boolean {
  // All accounts are now always valid (no more trial system)
  return true;
}

export function getRemainingTrialTime(_trial: AdminTrial | null) {
  return {
    isExpired: false,
    secondsRemaining: 0,
    formattedTime: "Acesso completo",
  };
}

export function useAdminTrial() {
  const [trial, setTrial] = useState<AdminTrial | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("admin_trial");
    if (saved) {
      try {
        setTrial(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
    setIsLoading(false);
  }, []);

  async function createTrial(storeName: string, _adminPhone: string, adminEmail: string) {
    // Cria o registro legacy do trial + um restaurante real (publicado) para o
    // link público /cardapio/:slug funcionar imediatamente.

    const { data, error } = await supabase
      .from("admin_trials")
      .insert({
        store_id: `owner_${Date.now()}`,
        store_name: storeName,
        admin_email: adminEmail,
        trial_started_at: new Date().toISOString(),
        trial_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        is_active: true,
        is_premium: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating trial:", error);
      return null;
    }

    // Restaurante real vinculado ao trial (owner_id = store_id)
    const slug = await generateUniqueSlug(storeName);
    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .insert({
        owner_id: data.store_id,
        name: storeName,
        slug,
        status: "published",
      })
      .select()
      .single();

    if (restError) {
      console.error("Error creating restaurant for trial:", restError);
    } else if (restaurant) {
      await seedDefaultMenu(restaurant.id);
    }

    localStorage.setItem("admin_trial", JSON.stringify(data));
    setTrial(data as AdminTrial);
    return data as AdminTrial;
  }

  async function validateAccessCode(email: string) {
    if (!email?.trim()) return { valid: false, trial: null };

    const { data: t, error } = await supabase
      .from("admin_trials")
      .select("*")
      .eq("admin_email", email.trim())
      .maybeSingle();

    if (error || !t) {
      return { valid: false, trial: null };
    }
    localStorage.setItem("admin_trial", JSON.stringify(t));
    setTrial(t as AdminTrial);
    return { valid: true, trial: t as AdminTrial };
  }

  async function activateLiberationCode(_code: string) {
    return { success: true, message: "Acesso liberado!" };
  }

  async function loadOrdersFromSupabase(storeId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items (*)")
      .eq("restaurant_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading orders:", error);
      return [];
    }
    return data || [];
  }

  async function loadAdminConfig(storeId: string) {
    const { data } = await supabase
      .from("admin_trials")
      .select("store_name, store_slogan, store_marquee, pix_key, whatsapp")
      .eq("id", storeId)
      .maybeSingle();
    return data;
  }

  async function updateAdminConfig(
    storeId: string,
    config: Record<string, unknown>,
  ) {
    const { error } = await supabase
      .from("admin_trials")
      .update({ ...config, config_updated_at: new Date().toISOString() })
      .eq("id", storeId);
    if (error) {
      console.error("Error updating admin config:", error);
      return false;
    }
    return true;
  }

  function reloadTrial() {
    const savedTrial = localStorage.getItem("admin_trial");
    if (savedTrial) setTrial(JSON.parse(savedTrial));
  }

  function clearTrial() {
    localStorage.removeItem("admin_trial");
    setTrial(null);
  }

  return {
    trial,
    isLoading,
    isExpired: false,
    daysRemaining: 0,
    secondsRemaining: 0,
    formattedTime: "Acesso completo",
    generateAdminCode: () => "",
    createTrial,
    validateAccessCode,
    activateLiberationCode,
    loadAdminConfig,
    loadOrdersFromSupabase,
    updateAdminConfig,
    reloadTrial,
    clearTrial,
  };
}
