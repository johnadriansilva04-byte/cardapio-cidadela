/**
 * Heurísticas de antispam para o envio de pedido no navegador.
 *
 * Duas regras baratas que pegam a maioria dos scripts de flood sem atrapalhar
 * o cliente real:
 *
 *  1. Honeypot: um campo escondido que humano não vê nem preenche. Bot lê o
 *     HTML e preenche tudo, caindo na armadilha.
 *  2. Tempo mínimo: um humano leva segundos para nome + telefone + bairro;
 *     envio em menos de `MIN_CHECKOUT_MS` é quase sempre automação.
 *
 * Isto é defesa em profundidade, não a muralha: o cliente é do atacante e pode
 * ser burlado. O bloqueio que conta está no servidor (rate limit por IP nas
 * rotas de API e o antiflood por telefone dentro da RPC `create_order_atomic`).
 */

/** Tempo mínimo (ms) entre abrir o checkout e confirmar. */
export const MIN_CHECKOUT_MS = 3000;

/**
 * No E2E o preenchimento é instantâneo de propósito, então a regra de tempo
 * fica desligada — o honeypot continua valendo.
 */
const timingEnabled = import.meta.env.VITE_E2E !== "1";

export interface SubmissionSignals {
  /** Valor do campo honeypot (deve estar vazio). */
  honeypot: string;
  /** Timestamp (ms) de quando o formulário foi aberto. */
  openedAt: number;
  /** Agora, para os testes controlarem o relógio. */
  now?: number;
}

/** `true` quando os sinais indicam um envio automatizado. */
export function looksLikeBot({ honeypot, openedAt, now = Date.now() }: SubmissionSignals): boolean {
  if (honeypot.trim()) return true;
  if (timingEnabled && now - openedAt < MIN_CHECKOUT_MS) return true;
  return false;
}
