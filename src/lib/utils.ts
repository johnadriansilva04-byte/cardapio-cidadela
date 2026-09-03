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
    payment_method: string;
    change_for?: string;
    order_items?: { product_name: string; quantity: number; total: number }[];
    created_at: string;
  },
  restaurantName: string,
): string {
  const W = 32;
  const line = "-".repeat(W);
  const center = (t: string) => t.padStart(Math.floor((W + t.length) / 2)).padEnd(W);
  const row = (l: string, r: string) => l.slice(0, W - r.length - 1).padEnd(W - r.length) + r;

  const items = order.order_items ?? [];

  return [
    center(restaurantName.toUpperCase()),
    center("PEDIDO"),
    line,
    `PEDIDO: ${order.comanda}`,
    `DATA..: ${new Date(order.created_at).toLocaleString("pt-BR")}`,
    `CLIENTE: ${order.customer_name}`,
    `FONE...: ${order.customer_phone}`,
    order.delivery_type === "entrega"
      ? `ENDER..: ${order.delivery_address}`
      : "RETIRADA NO BALCAO",
    line,
    ...items.map((i) => row(`${i.quantity}x ${i.product_name}`, brl(i.total))),
    line,
    row("TOTAL", brl(order.total)),
    `PAGTO.: ${order.payment_method.toUpperCase()}${order.change_for ? ` (troco p/ ${order.change_for})` : ""}`,
    order.observations ? `OBS...: ${order.observations}` : "",
    line,
    "",
  ]
    .filter(Boolean)
    .join("\n");
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

/**
 * Generate a WhatsApp message for an order
 */
export function buildWhatsAppMessage(
  order: {
    comanda: string;
    customer_name: string;
    total: number;
    order_items?: { product_name: string; quantity: number; total: number }[];
    observations: string;
    payment_method: string;
    delivery_type: string;
    delivery_address: string;
  },
  restaurantName: string,
): string {
  const lines = [
    `🍽️ *NOVO PEDIDO ${order.comanda}*`,
    `━━━━━━━━━━━━━━`,
    "",
    `👤 ${order.customer_name}`,
    `📍 ${order.delivery_type === "entrega" ? order.delivery_address : "Retirada"}`,
    `💳 ${order.payment_method.toUpperCase()}`,
    "",
    `📋 *Itens:*`,
  ];

  order.order_items?.forEach((i) => {
    lines.push(`  ${i.quantity}x ${i.product_name} — ${brl(i.total)}`);
  });

  lines.push("");
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
