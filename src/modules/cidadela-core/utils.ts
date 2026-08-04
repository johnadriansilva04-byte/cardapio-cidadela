import type { Order, PromoCode } from "@/lib/types";

export function newComanda(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `FEB${stamp}`;
}

export function generatePromoCode(
  prefix = "FEB-VIP",
  accessType?: "15_min" | "15_dias",
): PromoCode {
  const rand = Math.random().toString(36).toUpperCase().slice(2, 8);
  const codePrefix = accessType === "15_dias" ? "VIP" : "CID";
  const now = new Date();
  const expiration = new Date(now);
  
  if (accessType === "15_dias") {
    expiration.setDate(expiration.getDate() + 15);
  } else {
    expiration.setMinutes(expiration.getMinutes() + 15);
  }
  
  return {
    code: `${codePrefix}-${rand}`,
    label:
      accessType === "15_dias"
        ? "Código VIP - 15 dias de acesso"
        : "Código temporário - 15 minutos de acesso",
    discount: 10,
    createdAt: now.toISOString(),
    expiration: expiration.toISOString(),
    used: false,
  };
}

export function isCodeValid(code: PromoCode): boolean {
  if (code.used) return false;

  const createdAt = new Date(code.createdAt);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  // Códigos VIP (15 dias) expiram em 15 dias
  if (code.label.includes("15 dias")) {
    return diffMinutes <= 15 * 24 * 60; // 15 dias em minutos
  }

  // Códigos temporários (15 min) expiram em 15 minutos
  if (code.label.includes("15 minutos")) {
    return diffMinutes <= 15;
  }

  // Códigos antigos sem label específico não expiram
  return true;
}

export const STATUS_LABEL: Record<Order["status"], string> = {
  pendente: "OPERACIONAL",
  andamento: "EM MISSÃO",
  entregue: "ENTREGUE",
};

export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Comanda térmica 32 colunas. */
export function buildThermalTicket(order: Order, storeName: string): string {
  const W = 32;
  const line = "-".repeat(W);
  const center = (t: string) => t.padStart(Math.floor((W + t.length) / 2)).padEnd(W);
  const row = (l: string, r: string) => l.slice(0, W - r.length - 1).padEnd(W - r.length) + r;

  return [
    center(storeName.toUpperCase()),
    center("COMANDA FEB"),
    line,
    `PEDIDO: ${order.comanda}`,
    `DATA..: ${new Date(order.createdAt).toLocaleString("pt-BR")}`,
    `CLIENTE: ${order.cliente}`,
    `FONE...: ${order.telefone}`,
    order.tipo_entrega === "entrega" ? `ENDER..: ${order.endereco}` : "RETIRADA NO BALCAO",
    line,
    ...order.itens.map((i) => row(`${i.quantity}x ${i.name}`, brl(i.total))),
    line,
    row("TAXA", brl(order.taxa_entrega)),
    row("TOTAL", brl(order.total)),
    `PAGTO.: ${order.pagamento.toUpperCase()}${order.troco ? ` (troco p/ ${order.troco})` : ""}`,
    order.observacoes ? `OBS...: ${order.observacoes}` : "",
    line,
    center("A COBRA ESTA FUMANDO"),
    center("HONRA . DIGNIDADE . BRIO"),
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function printTicket(ticket: string) {
  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  win.document.write(
    `<pre style="font-family:ui-monospace,monospace;font-size:12px;line-height:1.35">${ticket.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</pre>`,
  );
  win.document.close();
  win.focus();
  win.print();
}
