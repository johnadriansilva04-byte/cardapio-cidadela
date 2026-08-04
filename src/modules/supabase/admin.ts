import { useEffect, useState } from "react";
import { supabase } from "./client";

type AdminTrial = {
  id: string;
  store_name: string;
  admin_phone: string;
  access_code: string;
  trial_started_at: string;
  trial_expires_at: string;
  is_active: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  created_at: string;
};

type LiberationCode = {
  id: string;
  code: string;
  store_id: string;
  plan_type: string;
  duration_days: number;
  used: boolean;
  used_at: string | null;
  created_at: string;
};

export function useAdminTrial() {
  const [trial, setTrial] = useState<AdminTrial | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);

  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 horas em ms

  // Verificar timeout de sessão
  function checkSessionTimeout() {
    const lastActivity = localStorage.getItem("admin_last_activity");
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity);
      if (elapsed > SESSION_TIMEOUT) {
        // Sessão expirou, limpar trial
        localStorage.removeItem("admin_trial");
        localStorage.removeItem("admin_last_activity");
        setTrial(null);
        setIsExpired(true);
        return true;
      }
    }
    return false;
  }

  // Atualizar timestamp de atividade
  function updateLastActivity() {
    localStorage.setItem("admin_last_activity", Date.now().toString());
  }

  // Carregar trial do localStorage
  useEffect(() => {
    const savedTrial = localStorage.getItem("admin_trial");
    if (savedTrial) {
      // Verificar timeout antes de carregar
      if (!checkSessionTimeout()) {
        const parsed = JSON.parse(savedTrial);
        setTrial(parsed);
        checkExpiration(parsed);
        updateLastActivity();
      }
    }
    setIsLoading(false);
  }, []);

  // Atualizar atividade em eventos do usuário
  useEffect(() => {
    const handleActivity = () => {
      if (trial) {
        updateLastActivity();
      }
    };

    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("scroll", handleActivity);

    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [trial]);

  function checkExpiration(trialData: AdminTrial) {
    const now = new Date();
    const expiresAt = new Date(trialData.trial_expires_at);
    const isExpired = now > expiresAt;
    setIsExpired(isExpired);

    if (!isExpired) {
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      setDaysRemaining(Math.max(0, daysLeft));
    }
  }

  async function createTrial(storeName: string, adminPhone: string) {
    const accessCode = `FEB-${Math.random().toString(36).toUpperCase().slice(2, 8)}-CID`;
    const trialStartedAt = new Date();
    const trialExpiresAt = new Date(trialStartedAt);
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 2); // 2 dias de trial

    const { data, error } = await supabase
      .from("admin_trials")
      .insert({
        store_name: storeName,
        admin_phone: adminPhone,
        access_code: accessCode,
        trial_started_at: trialStartedAt.toISOString(),
        trial_expires_at: trialExpiresAt.toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating trial:", error);
      return null;
    }

    // Salvar no localStorage
    localStorage.setItem("admin_trial", JSON.stringify(data));
    setTrial(data);
    checkExpiration(data);

    return data;
  }

  async function validateAccessCode(code: string) {
    const { data, error } = await supabase
      .from("admin_trials")
      .select("*")
      .eq("access_code", code)
      .single();

    if (error || !data) {
      return { valid: false, trial: null };
    }

    const trialData = data as AdminTrial;
    const now = new Date();
    const expiresAt = new Date(trialData.trial_expires_at);

    // Verificar se está no trial ou premium
    const isValid = trialData.is_active && (now <= expiresAt || trialData.is_premium);

    if (isValid) {
      localStorage.setItem("admin_trial", JSON.stringify(trialData));
      setTrial(trialData);
      checkExpiration(trialData);
      updateLastActivity(); // Atualizar timestamp de atividade ao entrar
      
      // Atualizar estado global com storeId do trial
      update((prev) => ({
        ...prev,
        admin: {
          ...prev.admin,
          storeId: trialData.id,
          accessCode: code,
        },
      }));
    }

    return { valid: isValid, trial: trialData, adminPhone: trialData.admin_phone, storeId: trialData.id };
  }

  async function activateLiberationCode(code: string) {
    const { data, error } = await supabase
      .from("liberation_codes")
      .select("*")
      .eq("code", code)
      .eq("used", false)
      .single();

    if (error || !data) {
      return { success: false, message: "Código inválido ou já utilizado" };
    }

    const liberationCode = data as LiberationCode;
    const now = new Date();
    const premiumExpiresAt = new Date();
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + liberationCode.duration_days);

    // Atualizar trial para premium
    const { error: updateError } = await supabase
      .from("admin_trials")
      .update({
        is_premium: true,
        premium_expires_at: premiumExpiresAt.toISOString(),
      })
      .eq("id", liberationCode.store_id);

    if (updateError) {
      return { success: false, message: "Erro ao ativar código" };
    }

    // Marcar código como usado
    await supabase
      .from("liberation_codes")
      .update({ used: true, used_at: now.toISOString() })
      .eq("id", liberationCode.id);

    // Atualizar trial local
    if (trial) {
      const updatedTrial = {
        ...trial,
        is_premium: true,
        premium_expires_at: premiumExpiresAt.toISOString(),
      };
      localStorage.setItem("admin_trial", JSON.stringify(updatedTrial));
      setTrial(updatedTrial);
      checkExpiration(updatedTrial);
    }

    return { success: true, message: "Código ativado com sucesso!" };
  }

  function clearTrial() {
    localStorage.removeItem("admin_trial");
    setTrial(null);
    setIsExpired(false);
    setDaysRemaining(0);
  }

  return {
    trial,
    isLoading,
    isExpired,
    daysRemaining,
    createTrial,
    validateAccessCode,
    activateLiberationCode,
    clearTrial,
  };
}
