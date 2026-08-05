import { useEffect, useState } from "react";
import { supabase } from "./client";

type SoberaniaPoints = {
  id: string;
  customer_phone: string;
  customer_email?: string;
  points: number;
  last_updated: string;
  created_at: string;
};

type SoberaniaTransaction = {
  id: string;
  customer_phone: string;
  type: "earned" | "lost" | "spent" | "rewarded";
  amount: number;
  reason: string;
  source: "game" | "order" | "ad" | "admin";
  timestamp: string;
  created_at: string;
};

type AdminTrial = {
  id: string;
  store_id?: string;
  store_name: string;
  store_slogan?: string;
  store_marquee?: string;
  pix_key?: string;
  whatsapp?: string;
  admin_phone: string;
  admin_email: string;
  trial_started_at: string;
  trial_expires_at: string;
  is_active: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  config_updated_at?: string;
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
        
        // Carregar configurações do Supabase
        loadAdminConfig(parsed.id);
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

  async function loadAdminConfig(storeId: string) {
    const { data, error } = await supabase
      .from("admin_trials")
      .select("store_name, store_slogan, store_marquee, pix_key, whatsapp")
      .eq("id", storeId)
      .single();

    if (error) {
      console.error("Erro ao carregar configurações do admin:", error);
      return;
    }

    if (data) {
      // Retornar as configurações para serem aplicadas no store
      return data;
    }
  }

  async function createTrial(storeName: string, adminPhone: string, adminEmail: string) {
    const trialStartedAt = new Date();
    const trialExpiresAt = new Date(trialStartedAt);
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 2); // 2 dias de trial

    const { data, error } = await supabase
      .from("admin_trials")
      .insert({
        store_name: storeName,
        admin_phone: adminPhone,
        admin_email: adminEmail,
        access_code: null, // Não usamos mais access_code, usamos e-mail
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

  async function validateAccessCode(email: string) {
    const { data, error } = await supabase
      .from("admin_trials")
      .select("*")
      .eq("admin_email", email)
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
    }

    return { valid: isValid, trial: trialData, adminPhone: trialData.admin_phone, storeId: trialData.id };
  }

  async function loadOrdersFromSupabase(storeId: string) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar pedidos do Supabase:", error);
      return [];
    }

    return orders || [];
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

  // Funções para gerenciar pontos de soberania
  async function getSoberaniaPoints(customerPhone: string) {
    const { data, error } = await supabase
      .from("soberania_points")
      .select("*")
      .eq("customer_phone", customerPhone)
      .single();

    if (error) {
      console.error("Erro ao buscar pontos de soberania:", error);
      return null;
    }

    return data as SoberaniaPoints;
  }

  async function updateSoberaniaPoints(customerPhone: string, amount: number, reason: string, source: SoberaniaTransaction["source"]) {
    // Buscar pontos atuais
    const current = await getSoberaniaPoints(customerPhone);
    
    if (!current) {
      // Criar novo registro
      const { data, error } = await supabase
        .from("soberania_points")
        .insert({
          customer_phone: customerPhone,
          points: amount,
          last_updated: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Erro ao criar pontos de soberania:", error);
        return false;
      }
    } else {
      // Atualizar pontos existentes
      const newPoints = Math.max(0, current.points + amount);
      const { error } = await supabase
        .from("soberania_points")
        .update({
          points: newPoints,
          last_updated: new Date().toISOString(),
        })
        .eq("customer_phone", customerPhone);

      if (error) {
        console.error("Erro ao atualizar pontos de soberania:", error);
        return false;
      }
    }

    // Registrar transação
    const { error: transactionError } = await supabase
      .from("soberania_transactions")
      .insert({
        customer_phone: customerPhone,
        type: amount >= 0 ? "earned" : "lost",
        amount: Math.abs(amount),
        reason,
        source,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

    if (transactionError) {
      console.error("Erro ao registrar transação de soberania:", transactionError);
    }

    return true;
  }

  async function getSoberaniaHistory(customerPhone: string) {
    const { data, error } = await supabase
      .from("soberania_transactions")
      .select("*")
      .eq("customer_phone", customerPhone)
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("Erro ao buscar histórico de soberania:", error);
      return [];
    }

    return data as SoberaniaTransaction[];
  }

  async function updateAdminConfig(storeId: string, config: {
    store_name?: string;
    store_slogan?: string;
    store_marquee?: string;
    pix_key?: string;
    whatsapp?: string;
  }) {
    const { error } = await supabase
      .from("admin_trials")
      .update({
        ...config,
        config_updated_at: new Date().toISOString(),
      })
      .eq("id", storeId);

    if (error) {
      console.error("Erro ao atualizar configurações do admin:", error);
      return false;
    }

    return true;
  }

  // Funções para autenticação com Google
  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("Erro ao fazer login com Google:", error);
      return { success: false, error: error.message };
    }

    return { success: true, url: data.url };
  }

  // Sign out
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erro ao fazer logout:", error);
      return false;
    }
    clearTrial();
    return true;
  }

  // Verificar sessão atual
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  return {
    trial,
    isLoading,
    isExpired,
    daysRemaining,
    createTrial,
    validateAccessCode,
    loadOrdersFromSupabase,
    activateLiberationCode,
    clearTrial,
    getSoberaniaPoints,
    updateSoberaniaPoints,
    getSoberaniaHistory,
    updateAdminConfig,
    loadAdminConfig,
    signInWithGoogle,
    signOut,
    checkSession,
  };
}
