import type { Order, PromoCode } from "@/lib/types";

export function newComanda(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `FEB${stamp}`;
}

export function generatePromoCode(prefix = "FEB-VIP"): PromoCode {
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return {
    code: `${prefix}-${rand}-1944`,
    label: "Código soberano de operação",
    discount: 10,
    createdAt: new Date().toISOString(),
    used: false,
  };
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
