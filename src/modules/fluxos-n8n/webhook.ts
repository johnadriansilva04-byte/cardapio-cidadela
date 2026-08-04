import type { Order } from "@/lib/types";

const QUEUE_KEY = "n8n_pending_queue";

export interface N8nPayload {
  cliente: string;
  telefone: string;
  endereco: string;
  observacoes: string;
  total: number;
  itens: Order["itens"];
  tipo_entrega: string;
  taxa_entrega: number;
  distancia_km: number;
  imprimir: boolean;
  impressao_largura: number;
  origem: "CIDADELA_PWA";
  comanda: string;
  evento: string;
  timestamp: string;
  pagamento: "pix" | "dinheiro" | "cartao";
  troco?: string;
  cidadela_code?: string;
  cidadela_access_type?: "15_min" | "15_dias";
  restaurante_whatsapp?: string;
  access_code?: string;
  store_id?: string;
}

export function buildOrderPayload(
  order: Order,
  cidadelaCode?: string,
  accessType?: "15_min" | "15_dias",
  restauranteWhatsApp?: string,
  accessCode?: string,
  storeId?: string,
): N8nPayload {
  return {
    cliente: order.cliente,
    telefone: order.telefone,
    endereco: order.endereco,
    observacoes: order.observacoes,
    total: order.total,
    itens: order.itens,
    tipo_entrega: order.tipo_entrega,
    taxa_entrega: order.taxa_entrega,
    distancia_km: 0,
    imprimir: true,
    impressao_largura: 32,
    origem: "CIDADELA_PWA",
    comanda: order.comanda,
    evento: "novo_pedido",
    timestamp: new Date().toISOString(),
    pagamento: order.pagamento,
    troco: order.troco,
    cidadela_code: cidadelaCode,
    cidadela_access_type: accessType,
    restaurante_whatsapp: restauranteWhatsApp,
    access_code: accessCode,
    store_id: storeId,
  };
}

function readQueue(): { url: string; payload: N8nPayload }[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(items: { url: string; payload: N8nPayload }[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function pendingCount(): number {
  return readQueue().length;
}

async function post(url: string, payload: N8nPayload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("Webhook error:", res.status, res.statusText);
      throw new Error(`Webhook respondeu ${res.status}`);
    }
    return true;
  } catch (error) {
    console.error("Erro ao enviar webhook:", error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Envia ao N8N; em falha/offline, enfileira localmente para sincronizar depois. */
export async function sendToN8n(url: string, payload: N8nPayload): Promise<boolean> {
  if (!url) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    writeQueue([...readQueue(), { url, payload }]);
    return false;
  }
  try {
    await post(url, payload);
    return true;
  } catch {
    writeQueue([...readQueue(), { url, payload }]);
    return false;
  }
}

/** Reenvia tudo que ficou pendente. Retorna quantos foram sincronizados. */
export async function flushQueue(): Promise<number> {
  const queue = readQueue();
  if (!queue.length) return 0;
  const remaining: typeof queue = [];
  let sent = 0;
  for (const entry of queue) {
    try {
      await post(entry.url, entry.payload);
      sent += 1;
    } catch {
      remaining.push(entry);
    }
  }
  writeQueue(remaining);
  return sent;
}

export interface CidadelaAuthPayload {
  codigo: string;
  origem: "CIDADELA_PWA";
  timestamp: string;
}

export interface CidadelaAuthResponse {
  success: boolean;
  autenticado: boolean;
  nivel_acesso?: "admin" | "operador";
  token_sessao?: string;
  expiracao?: string;
  erro?: "codigo_invalido" | "codigo_expirado" | "tentativas_excedidas";
}

/** Valida código de acesso via webhook Cidadela */
export async function validateCidadelaCode(
  url: string,
  codigo: string,
): Promise<CidadelaAuthResponse> {
  if (!url) {
    return { success: false, autenticado: false, erro: "codigo_invalido" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const payload: CidadelaAuthPayload = {
      codigo: codigo.toUpperCase(),
      origem: "CIDADELA_PWA",
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { success: false, autenticado: false, erro: "codigo_invalido" };
    }
    const data: CidadelaAuthResponse = await res.json();
    return data;
  } catch {
    return { success: false, autenticado: false, erro: "codigo_invalido" };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// WEBHOOKS DE JOGOS ONLINE
// ============================================

export interface GameSessionPayload {
  acao: "criar" | "entrar" | "atualizar" | "completar";
  game_type: "battle" | "trilha" | "iq_test";
  session_id?: string;
  player1_id?: string;
  player1_name?: string;
  player1_data?: Record<string, unknown>;
  player2_id?: string;
  player2_name?: string;
  player2_data?: Record<string, unknown>;
  player1_phone?: string;
  player2_phone?: string;
  game_state?: Record<string, unknown>;
  winner?: string;
}

export interface GameSessionResponse {
  success: boolean;
  acao?: string;
  session_id?: string;
  message?: string;
  error?: string;
}

/** Envia eventos de sessão de jogo via webhook */
export async function sendGameSession(
  url: string,
  payload: GameSessionPayload,
): Promise<GameSessionResponse> {
  if (!url) {
    return { success: false, error: "missing_url" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("Game session webhook error:", res.status, res.statusText);
      return { success: false, error: `http_${res.status}` };
    }
    const data: GameSessionResponse = await res.json();
    return data;
  } catch (error) {
    console.error("Erro ao enviar game session webhook:", error);
    return { success: false, error: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

export interface GameMovePayload {
  session_id: string;
  player_id: string;
  player_number?: number;
  move_type: string;
  move_data?: Record<string, unknown>;
  round_number?: number;
}

export interface GameMoveResponse {
  success: boolean;
  move_id?: string;
  message?: string;
  error?: string;
}

/** Envia movimentos/jogadas de jogo via webhook */
export async function sendGameMove(
  url: string,
  payload: GameMovePayload,
): Promise<GameMoveResponse> {
  if (!url) {
    return { success: false, error: "missing_url" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("Game move webhook error:", res.status, res.statusText);
      return { success: false, error: `http_${res.status}` };
    }
    const data: GameMoveResponse = await res.json();
    return data;
  } catch (error) {
    console.error("Erro ao enviar game move webhook:", error);
    return { success: false, error: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// WEBHOOK DE TRIAL ADMINISTRATIVO
// ============================================

export interface AdminTrialPayload {
  acao: "criar_trial";
  store_name: string;
  admin_phone: string;
  access_code: string;
  origem: "CIDADELA_PWA";
  timestamp: string;
}

export interface AdminTrialResponse {
  success: boolean;
  access_code?: string;
  trial_expires_at?: string;
  message?: string;
  error?: string;
}

/** Envia solicitação de criação de trial administrativo via webhook */
export async function sendAdminTrial(
  url: string,
  storeName: string,
  adminPhone: string,
  accessCode: string,
): Promise<AdminTrialResponse> {
  if (!url) {
    return { success: false, error: "missing_url" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const payload: AdminTrialPayload = {
      acao: "criar_trial",
      store_name: storeName,
      admin_phone: adminPhone,
      access_code: accessCode,
      origem: "CIDADELA_PWA",
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("Admin trial webhook error:", res.status, res.statusText);
      return { success: false, error: `http_${res.status}` };
    }
    const data: AdminTrialResponse = await res.json();
    return data;
  } catch (error) {
    console.error("Erro ao enviar admin trial webhook:", error);
    return { success: false, error: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
