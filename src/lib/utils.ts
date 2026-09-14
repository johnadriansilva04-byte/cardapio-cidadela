import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RestaurantStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as BRL currency
 */
export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Convert a hex color (#rgb | #rrggbb) to an rgba() string.
 * Falls back to cyan when the color is missing/invalid.
 */
export function hexToRgba(hex: string | undefined | null, alpha: number): string {
  const h = (hex ?? "#06b6d4").replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(6, 182, 212, ${alpha})`;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generate a URL-friendly slug from restaurant name
 */
export function generateSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Format restaurant status for display
 */
export function statusLabel(status: RestaurantStatus): string {
  return { draft: "RASCUNHO", published: "PUBLICADO", paused: "PAUSADO" }[status];
}

/**
 * Format a date for Brazilian locale
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Generate a comanda number (sequential)
 */
export function newComanda(): string {
  if (typeof window === "undefined") return "#1";
  const counter = parseInt(localStorage.getItem("comanda_counter") || "0");
  const newCounter = counter + 1;
  localStorage.setItem("comanda_counter", newCounter.toString());
  return `#${newCounter}`;
}

/**
 * Build a thermal ticket string for printing
 */
export function buildThermalTicket(
  order: {
    comanda: string;
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    delivery_type: string;
    observations: string;
    total: number;
    delivery_fee?: number;
    payment_method: string;
    change_for?: string;
    order_items?: { product_name: string; quantity: number; total: number; notes?: string }[];
    created_at: string;
  },
  restaurantName: string,
): string {
  const W = 32;
  const line = "-".repeat(W);
  const center = (t: string) => t.padStart(Math.floor((W + t.length) / 2)).padEnd(W);
  const row = (l: string, r: string) => l.slice(0, W - r.length - 1).padEnd(W - r.length) + r;

  const items = order.order_items ?? [];
  const isDelivery = order.delivery_type === "entrega";
  const fee = isDelivery ? (order.delivery_fee ?? 0) : 0;

  const itemRows: string[] = [];
  for (const i of items) {
    itemRows.push(row(`${i.quantity}x ${i.product_name}`, brl(i.total)));
    if (i.notes) {
      // quebra notas em linhas de até W-2 chars com prefixo "  > "
      const note = i.notes.slice(0, 200);
      const chunks: string[] = [];
      for (let c = 0; c < note.length; c += W - 4) chunks.push(note.slice(c, c + (W - 4)));
      for (const ch of chunks) itemRows.push(`  > ${ch}`);
    }
  }

  const rows = [
    center(restaurantName.toUpperCase()),
    center("PEDIDO"),
    line,
    `PEDIDO: ${order.comanda}`,
    `DATA..: ${new Date(order.created_at).toLocaleString("pt-BR")}`,
    `CLIENTE: ${order.customer_name}`,
    `FONE...: ${order.customer_phone}`,
    isDelivery ? `ENDER..: ${order.delivery_address}` : "RETIRADA NO BALCAO",
    line,
    ...itemRows,
    line,
  ];

  if (isDelivery && fee > 0) rows.push(row("TAXA ENTREGA", brl(fee)));
  rows.push(row("TOTAL", brl(order.total)));
  rows.push(
    `PAGTO.: ${order.payment_method.toUpperCase()}${order.change_for ? ` (troco p/ ${order.change_for})` : ""}`,
  );
  if (order.observations) rows.push(`OBS...: ${order.observations}`);
  rows.push(line, "");

  return rows.filter(Boolean).join("\n");
}

/**
 * CRC16/CCITT-FALSE (hex) required by the PIX EMV payload.
 */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Build a PIX "Copia e Cola" EMV payload. This is what banking apps actually
 * scan/accept — encoding the bare key is NOT valid, so we assemble the full
 * EMV string and append the CRC16.
 */
export function buildPixPayload(opts: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string;
}): string {
  const { pixKey, merchantName, merchantCity, amount, txid } = opts;
  if (!pixKey) return "";

  const id = (n: string) => String(n).padStart(2, "0");
  const field = (idNumber: number, value: string) =>
    id(String(idNumber)) + id(String(value.length)) + value;

  // Merchant Account Information (GUI obrigatório + chave PIX)
  const mai = field(26, field(0, "br.gov.bcb.pix") + field(1, pixKey));

  const amountStr = amount.toFixed(2);
  const txidClean = txid.replace(/[^\w]/g, "").slice(0, 25) || "***";
  const body =
    field(0, "01") + // Payload Format Indicator
    mai +
    field(52, "0000") + // MCC
    field(53, "986") + // Moeda BRL
    field(54, amountStr) + // Valor
    field(58, "BR") + // País
    field(
      59,
      merchantName
        .replace(/[^A-Z0-9 ]/gi, "")
        .slice(0, 25)
        .toUpperCase(),
    ) +
    field(
      60,
      merchantCity
        .replace(/[^A-Z0-9 ]/gi, "")
        .slice(0, 15)
        .toUpperCase(),
    ) +
    field(62, field(5, txidClean)); // TXID

  return body + "6304" + crc16(body + "6304");
}

/**
 * Print a ticket in a new window
 */
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

/** Monta as linhas de endereço de entrega (rua, complemento, bairro, cidade). */
export function formatDeliveryAddress(order: {
  delivery_address: string;
  customer_complement?: string;
  customer_neighborhood?: string;
  customer_city?: string;
}): string[] {
  const street = order.delivery_address.trim();
  const complement = (order.customer_complement ?? "").trim();
  const neighborhood = (order.customer_neighborhood ?? "").trim();
  const city = (order.customer_city ?? "").trim();

  const parts = [street, complement && `Complemento: ${complement}`, neighborhood, city].filter(
    (p): p is string => Boolean(p),
  );
  if (parts.length === 0) return ["Endereço não informado"];

  const lines: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current && current.length + part.length + 2 > 40) {
      lines.push(current);
      current = part;
    } else {
      current = current ? `${current}, ${part}` : part;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generate a WhatsApp message for an order
 */
export function buildWhatsAppMessage(
  order: {
    comanda: string;
    customer_name: string;
    total: number;
    order_items?: { product_name: string; quantity: number; total: number; notes?: string }[];
    observations: string;
    payment_method: string;
    delivery_type: string;
    delivery_address: string;
    customer_complement?: string;
    customer_neighborhood?: string;
    customer_city?: string;
    delivery_fee?: number;
  },
  restaurantName: string,
): string {
  const isDelivery = order.delivery_type === "entrega";
  const fee = isDelivery ? (order.delivery_fee ?? 0) : 0;
  const subtotal = order.total - fee;

  const deliveryLines = isDelivery ? formatDeliveryAddress(order) : [];

  const lines = [
    `🍽️ *NOVO PEDIDO ${order.comanda}*`,
    `━━━━━━━━━━━━━━`,
    "",
    `👤 *Cliente:* ${order.customer_name}`,
    isDelivery ? "🛵 *Entrega a domicílio*" : "🏪 *Retirada no balcão*",
    ...deliveryLines,
    `💳 ${order.payment_method.toUpperCase()}`,
    "",
    `📋 *Itens:*`,
  ];

  order.order_items?.forEach((i) => {
    lines.push(`  ${i.quantity}x ${i.product_name} — ${brl(i.total)}`);
    if (i.notes) lines.push(`     _${i.notes}_`);
  });

  lines.push("");
  if (isDelivery && fee > 0) {
    lines.push(`*Subtotal:* ${brl(subtotal)}`);
    lines.push(`🛵 *Taxa de entrega:* ${brl(fee)}`);
  }
  lines.push(`💰 *TOTAL: ${brl(order.total)}*`);

  if (order.observations) {
    lines.push(`📝 ${order.observations}`);
  }

  return lines.join("\n");
}

/**
 * Open WhatsApp with order message
 */
export function sendToWhatsApp(whatsappNumber: string, message: string) {
  const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}
