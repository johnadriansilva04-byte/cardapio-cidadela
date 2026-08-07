import { useState, useEffect } from "react";
import { supabase } from "./client";

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

export function isTrialValid(trial: AdminTrial | null): boolean {
  if (!trial) return false;
  if (trial.is_premium) return true;
  const now = new Date();
  const expiresAt = new Date(trial.trial_expires_at);
  return trial.is_active && now <= expiresAt;
}

export function getRemainingTrialTime(trial: AdminTrial | null): {
  isExpired: boolean;
  secondsRemaining: number;
  formattedTime: string;
} {
  if (!trial) {
    return { isExpired: true, secondsRemaining: 0, formattedTime: "Expirado" };
  }
  
  if (trial.is_premium) {
    if (trial.premium_expires_at) {
      const remaining = new Date(trial.premium_expires_at).getTime() - Date.now();
      const days = Math.max(0, Math.ceil(remaining / 86400000));
      return {
        isExpired: false,
        secondsRemaining: remaining > 0 ? Math.floor(remaining / 1000) : 0,
        formattedTime: days > 0 ? `${days} dias restantes` : "Premium",
      };
    }
    return { isExpired: false, secondsRemaining: 0, formattedTime: "Premium" };
  }
  
  const now = new Date();
  const expiresAt = new Date(trial.trial_expires_at);
  const remaining = expiresAt.getTime() - now.getTime();
  
  if (!trial.is_active || remaining <= 0) {
    return { isExpired: true, secondsRemaining: 0, formattedTime: "Expirado" };
  }
  
  const secondsRemaining = Math.floor(remaining / 1000);
  const minutes = Math.floor(secondsRemaining / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return {
      isExpired: false,
      secondsRemaining,
      formattedTime: `${hours}h ${minutes % 60}min restantes`,
    };
  }
  
  if (minutes > 0) {
    return {
      isExpired: false,
      secondsRemaining,
      formattedTime: `${minutes}min restantes`,
    };
  }
  
  return {
    isExpired: false,
    secondsRemaining,
    formattedTime: `${secondsRemaining}s restantes`,
  };
}

export function useAdminTrial() {
  const [trial, setTrial] = useState<AdminTrial | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

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

  useEffect(() => {
    if (!trial) {
      setIsExpired(false);
      setSecondsRemaining(0);
      setDaysRemaining(0);
      return;
    }
    const tick = () => {
      const { isExpired, secondsRemaining, formattedTime } = getRemainingTrialTime(trial);
      setIsExpired(isExpired);
      setSecondsRemaining(secondsRemaining);
      
      if (trial.is_premium && trial.premium_expires_at) {
        setDaysRemaining(
          Math.max(
            0,
            Math.ceil(
              (new Date(trial.premium_expires_at).getTime() - Date.now()) / 86400000,
            ),
          )
        );
      } else {
        setDaysRemaining(0);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [trial]);

  function generateAdminCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "ADM-";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async function createTrial(storeName: string, adminPhone: string, adminEmail: string) {
    const trialStartedAt = new Date();
    const trialExpiresAt = new Date(trialStartedAt.getTime() + 2 * 60 * 1000); // 2 minutos
    const storeId = generateAdminCode();

    const { data, error } = await supabase
      .from("admin_trials")
      .insert({
        store_id: storeId,
        store_name: storeName,
        admin_phone: adminPhone,
        admin_email: adminEmail,
        trial_started_at: trialStartedAt.toISOString(),
        trial_expires_at: trialExpiresAt.toISOString(),
        created_at: new Date().toISOString(),
        is_active: true,
        is_premium: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating trial:", error);
      return null;
    }

    localStorage.setItem("admin_trial", JSON.stringify(data));
    setTrial(data as AdminTrial);
    return data as AdminTrial;
  }

  async function validateAccessCode(email: string) {
    const { data, error } = await supabase
      .from("admin_trials")
      .select("*")
      .eq("admin_email", email)
      .maybeSingle();

    if (error || !data) {
      return { valid: false, trial: null };
    }

    const trialData = data as AdminTrial;
    const isValid = isTrialValid(trialData);

    localStorage.setItem("admin_trial", JSON.stringify(trialData));
    setTrial(trialData);

    return { valid: isValid, trial: trialData };
  }

  async function activateLiberationCode(code: string) {
    const { data, error } = await supabase
      .from("admin_trials")
      .select("*")
      .eq("store_id", code)
      .maybeSingle();

    if (error || !data) {
      return { success: false, message: "Código inválido ou não encontrado" };
    }

    const adminTrial = data as AdminTrial;

    if (adminTrial.is_premium) {
      return { success: false, message: "Esta conta já é premium" };
    }

    const premiumExpiresAt = new Date();
    premiumExpiresAt.setFullYear(premiumExpiresAt.getFullYear() + 1); // 1 ano

    const { error: updateError } = await supabase
      .from("admin_trials")
      .update({
        is_premium: true,
        premium_expires_at: premiumExpiresAt.toISOString(),
      })
      .eq("id", adminTrial.id);

    if (updateError) {
      return { success: false, message: "Erro ao ativar código" };
    }

    const updated = {
      ...adminTrial,
      is_premium: true,
      premium_expires_at: premiumExpiresAt.toISOString(),
    };
    localStorage.setItem("admin_trial", JSON.stringify(updated));
    setTrial(updated);

    return { success: true, message: "Código ativado com sucesso!" };
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
    config: {
      store_name?: string;
      store_slogan?: string;
      store_marquee?: string;
      pix_key?: string;
      whatsapp?: string;
    },
  ) {
    const { error } = await supabase
      .from("admin_trials")
      .update({ ...config, config_updated_at: new Date().toISOString() })
      .eq("id", storeId);

    if (error) {
      console.error("Erro ao atualizar configurações:", error);
      return false;
    }
    return true;
  }

  async function loadOrdersFromSupabase(storeId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items (*)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar pedidos:", error);
      return [];
    }
    return data || [];
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
    isExpired,
    daysRemaining,
    secondsRemaining,
    formattedTime: getRemainingTrialTime(trial).formattedTime,
    generateAdminCode,
    createTrial,
    validateAccessCode,
    activateLiberationCode,
    loadAdminConfig,
    updateAdminConfig,
    loadOrdersFromSupabase,
    reloadTrial,
    clearTrial,
  };
}
