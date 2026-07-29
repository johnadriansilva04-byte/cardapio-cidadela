import type { Order } from "@/lib/types";

const QUEUE_KEY = "n8n_pending_queue";

export interface N8nPayload {
  cliente: string;
  telefone: string;
  total: number;
  cidadela_code?: string;
  cidadela_access_type?: "15_min" | "15_dias";
}

export function buildOrderPayload(order: Order, cidadelaCode?: string, accessType?: "15_min" | "15_dias"): N8nPayload {
  return {
    cliente: order.cliente,
    telefone: order.telefone,
    total: order.total,
    cidadela_code: cidadelaCode,
    cidadela_access_type: accessType,
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
