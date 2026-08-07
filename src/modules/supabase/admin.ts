import { useEffect, useState } from "react";
import { supabase } from "./client";

// Função para gerar código de administrador
function generateAdminCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ADM-${result}`;
}

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
    const loadTrialFromStorage = async () => {
      const savedTrial = localStorage.getItem("admin_trial");
      if (savedTrial) {
        // Verificar timeout antes de carregar
        if (!checkSessionTimeout()) {
          const parsed = JSON.parse(savedTrial);
          setTrial(parsed);
          checkExpiration(parsed);
          updateLastActivity();
          
          // Carregar configurações do Supabase em background
          loadAdminConfig(parsed.id).catch(err => {
            console.error("Erro ao carregar config:", err);
          });
        }
      }
      setIsLoading(false);
    };
    
    loadTrialFromStorage();
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
    
    // Se for premium, não está expirado
    if (trialData.is_premium) {
      setIsExpired(false);
      return;
    }
    
    const isExpired = now > expiresAt;
    setIsExpired(isExpired);

    if (!isExpired) {
      const minutesLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60));
      setDaysRemaining(Math.max(0, minutesLeft));
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
    const trialExpiresAt = new Date(trialStartedAt.getTime() + 2 * 60 * 1000); // 2 minutos
    
    // Gerar código de administrador (ADM-XXXXXX)
    const accessCode = generateAdminCode();

    const { data, error } = await supabase
      .from("admin_trials")
      .insert({
        store_name: storeName,
        admin_phone: adminPhone,
        admin_email: adminEmail,
        access_code: accessCode,
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

    // Salvar no localStorage mesmo se expirou, para poder mostrar mensagem correta
    localStorage.setItem("admin_trial", JSON.stringify(trialData));
    setTrial(trialData);
    checkExpiration(trialData);
    updateLastActivity(); // Atualizar timestamp de atividade ao entrar

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
      .from("admin_trials")
      .select("*")
      .eq("access_code", code)
      .single();

    if (error || !data) {
      return { success: false, message: "Código inválido ou não encontrado" };
    }

    const adminTrial = data as AdminTrial;
    
    // Verificar se já é premium
    if (adminTrial.is_premium) {
      return { success: false, message: "Esta conta já é premium" };
    }

    const now = new Date();
    const premiumExpiresAt = new Date();
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + 30); // 30 dias de premium

    // Atualizar trial para premium
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

    // Buscar trial atualizado do Supabase
    const { data: updatedData, error: fetchError } = await supabase
      .from("admin_trials")
      .select("*")
      .eq("id", adminTrial.id)
      .single();

    if (fetchError || !updatedData) {
      // Se falhar ao buscar, usar dados atualizados localmente
      const updatedTrial = {
        ...adminTrial,
        is_premium: true,
        premium_expires_at: premiumExpiresAt.toISOString(),
      };
      localStorage.setItem("admin_trial", JSON.stringify(updatedTrial));
      setTrial(updatedTrial);
      checkExpiration(updatedTrial);
    } else {
      // Usar dados atualizados do Supabase
      localStorage.setItem("admin_trial", JSON.stringify(updatedData));
      setTrial(updatedData as AdminTrial);
      checkExpiration(updatedData as AdminTrial);
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
  async function getSoberaniaPoints(storeId: string, customerEmail: string) {
    const { data, error } = await supabase
      .from("soberania_points")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_email", customerEmail)
      .single();

    if (error) {
      console.error("Erro ao buscar pontos de soberania:", error);
      return null;
    }

    return data as SoberaniaPoints;
  }

  async function updateSoberaniaPoints(storeId: string, customerEmail: string, customerPhone: string, amount: number, reason: string, source: SoberaniaTransaction["source"]) {
    // Buscar pontos atuais
    const current = await getSoberaniaPoints(storeId, customerEmail);
    
    if (!current) {
      // Criar novo registro
      const { data, error } = await supabase
        .from("soberania_points")
        .insert({
          store_id: storeId,
          customer_email: customerEmail,
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
        .eq("store_id", storeId)
        .eq("customer_email", customerEmail);

      if (error) {
        console.error("Erro ao atualizar pontos de soberania:", error);
        return false;
      }
    }

    // Registrar transação
    const { error: transactionError } = await supabase
      .from("soberania_transactions")
      .insert({
        store_id: storeId,
        customer_email: customerEmail,
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

  async function getSoberaniaHistory(storeId: string, customerEmail: string) {
    const { data, error } = await supabase
      .from("soberania_transactions")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_email", customerEmail)
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
