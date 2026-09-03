// Re-export platform utilities
export { brl, buildThermalTicket, printTicket, generateSlug, statusLabel, formatDate, newComanda, buildWhatsAppMessage, sendToWhatsApp } from "@/lib/utils";

// Re-export useStore from cidadela-core for backward compatibility with old components
export { useStore } from "@/modules/cidadela-core/store";
