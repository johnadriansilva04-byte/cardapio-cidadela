/**
 * Assunto elegante dos e-mails operacionais.
 *
 * O CEO decide o que abrir primeiro pelo assunto, não pelo corpo. Então o
 * assunto responde a duas perguntas numa linha: QUÃO URGENTE é e SOBRE O QUE é.
 *
 *   🔴 Urgente · Cardápio — Dona da Pensão
 *   🟡 Médio · Suporte — Pizzaria da Maria
 *   🧾 Nota fiscal · Dona da Pensão · Anual
 *
 * A prioridade sai do contexto, não do capricho de quem chama: um erro no
 * cardápio público bloqueia o cliente (urgente); no painel, atrapalha o dono
 * (médio); uma conversa de suporte não bloqueia ninguém (leve/médio).
 */

export type ReportPriority = "urgente" | "medio" | "leve";
export type ReportCategory =
  | "Cardápio"
  | "Pedido"
  | "Suporte"
  | "Painel"
  | "Gestão"
  | "Nota fiscal"
  | "Sistema";

// Semáforo: vermelho trava o cliente, amarelo atrapalha o dono, verde é rotina.
const PRIORITY_EMOJI: Record<ReportPriority, string> = {
  urgente: "🔴",
  medio: "🟡",
  leve: "🟢",
};
const PRIORITY_LABEL: Record<ReportPriority, string> = {
  urgente: "Urgente",
  medio: "Médio",
  leve: "Leve",
};

/** Texto da prioridade para o corpo do e-mail (com o semáforo). */
export const PRIORITY_TEXT: Record<ReportPriority, string> = {
  urgente: `${PRIORITY_EMOJI.urgente} Urgente`,
  medio: `${PRIORITY_EMOJI.medio} Médio`,
  leve: `${PRIORITY_EMOJI.leve} Leve`,
};

/** Deduz prioridade e categoria a partir do tipo do relato e da rota. */
export function classifyReport(input: {
  kind: "suporte" | "erro";
  route?: string;
}): { priority: ReportPriority; category: ReportCategory } {
  // Conversa escalada pelo dono: é atendimento, não um erro de tela.
  if (input.kind === "suporte") return { priority: "medio", category: "Suporte" };

  const route = (input.route ?? "").toLowerCase();
  // Painel e mobile primeiro: `/admin/pedidos` contém "pedido", mas é a tela do
  // dono, não o checkout do cliente. A checagem pública vem depois.
  if (route.includes("/admin")) return { priority: "medio", category: "Painel" };
  if (route.includes("/mobile")) return { priority: "medio", category: "Gestão" };
  // Cliente na ponta: se o cardápio ou o pedido quebra, ele não consegue comprar.
  if (route.includes("/cardapio")) return { priority: "urgente", category: "Cardápio" };
  if (route.includes("/pedido") || route.includes("/checkout")) {
    return { priority: "urgente", category: "Pedido" };
  }
  return { priority: "medio", category: "Sistema" };
}

/** Assunto do relato: `🔴 Urgente · Cardápio — Dona da Pensão`. */
export function buildReportSubject(input: {
  priority: ReportPriority;
  category: ReportCategory;
  storeName?: string;
}): string {
  const store = input.storeName ? ` — ${input.storeName.slice(0, 50)}` : "";
  return `${PRIORITY_EMOJI[input.priority]} ${PRIORITY_LABEL[input.priority]} · ${input.category}${store}`;
}

/** Assunto do pedido de nota: `🧾 Nota fiscal · Dona da Pensão · Anual`. */
export function buildInvoiceSubject(input: { restaurantName: string; kindLabel: string }): string {
  return `🧾 Nota fiscal · ${input.restaurantName} · ${input.kindLabel}`;
}
