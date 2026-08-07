import type { Order } from "@/lib/types";

export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function newComanda(): string {
  const counter = parseInt(localStorage.getItem("comanda_counter") || "0");
  const newCounter = counter + 1;
  localStorage.setItem("comanda_counter", newCounter.toString());
  return `#${newCounter}`;
}

export function generatePromoCode(
  prefix?: string,
  accessType: "15_min" | "15_dias" = "15_min",
): { code: string; expiration: Date } {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = prefix || (accessType === "15_dias" ? "VIP-" : "CID-");
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const now = new Date();
  const expiration = new Date(
    now.getTime() + (accessType === "15_dias" ? 15 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000),
  );

  return { code, expiration };
}

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
  const escaped = ticket.replace(
    /[<>&]/g,
    (c) => (({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }) as Record<string, string>)[c] as string,
  );
  win.document.write(
    `<pre style="font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.35;">${escaped}</pre>`,
  );
  win.document.close();
  win.focus();
  win.print();
}

export async function sendToN8N(webhookUrl: string, payload: unknown) {
  if (!webhookUrl) return false;
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.error("Erro ao enviar webhook:", error);
    return false;
  }
}
