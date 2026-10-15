import { buildThermalTicket, printTicket } from "@/lib/utils";
import { loadPreferences } from "@/modules/mobile/preferences";
import { getOrderById } from "@/modules/supabase/orders";
import type { Order } from "@/lib/types";

/**
 * Impressão automática de comandas.
 *
 * Imprime sozinho quando um pedido novo chega no painel — sem clique. É o que
 * o restaurante espera na operação: o pedido entra e a comanda sai na térmica.
 *
 * Limites honestos (navegador não fala direto com a impressora):
 * - o trabalho vai para a impressora PADRÃO do sistema, então ela precisa estar
 *   instalada, com driver, e marcada como padrão no Windows/Mac;
 * - no Chrome com `--kiosk-printing` (ou impressão silenciosa habilitada) sai
 *   sem diálogo; nos demais navegadores o diálogo abre uma vez e o operador
 *   confirma — o popup ainda assim NÃO é bloqueado (usamos iframe).
 */

// Um backend realtime pode reentregar/duplicar eventos; sem dedup a mesma
// comanda sairia duas vezes na térmica.
const printed = new Map<string, number>();
const DEDUP_MS = 60_000;

function alreadyPrinted(orderId: string, now: number): boolean {
  // limpa entradas antigas para não crescer sem limite
  for (const [id, ts] of printed) {
    if (now - ts > DEDUP_MS) printed.delete(id);
  }
  const seen = printed.get(orderId);
  if (seen && now - seen < DEDUP_MS) return true;
  printed.set(orderId, now);
  return false;
}

/** Só imprime se a preferência deste dispositivo estiver ligada. */
export function isAutoPrintEnabled(): boolean {
  return loadPreferences().autoPrint;
}

/**
 * Imprime a comanda de um pedido recém-chegado, respeitando a preferência e
 * evitando duplicidade. Devolve `true` quando de fato disparou a impressão.
 *
 * O pedido vem do evento de realtime (INSERT) e não traz os itens
 * (`order_items`); sem eles a comanda sairia sem os produtos. Por isso o
 * cruzamos com o pedido completo carregado pela tela (via `known`) e, se ainda
 * faltar, buscamos o detalhe antes de imprimir.
 */
export function maybeAutoPrintOrder(
  order: Order,
  restaurantName: string,
  known?: Map<string, Order>,
): boolean {
  if (typeof window === "undefined") return false;
  if (!loadPreferences().autoPrint) return false;
  if (!order?.id) return false;

  const now = Date.now();
  if (alreadyPrinted(order.id, now)) return false;

  const fromList = known?.get(order.id);
  const complete =
    order.order_items?.length || fromList?.order_items?.length
      ? {
          ...order,
          ...fromList,
          order_items: order.order_items?.length ? order.order_items : fromList?.order_items,
        }
      : null;

  if (complete) {
    printOrderTicket(complete, restaurantName);
    return true;
  }

  // Sem itens ainda: busca o detalhe completo (o realtime chega antes de a
  // lista recarregar) e imprime quando chegar, para não sair comanda vazia.
  // O dono tem leitura do próprio pedido, então `getOrderById` traz os itens.
  void getOrderById(order.id)
    .then((full) => {
      printOrderTicket(full ?? order, restaurantName);
    })
    .catch(() => {
      printOrderTicket(order, restaurantName);
    });
  return true;
}

/** Monta a comanda térmica e manda para a impressora padrão (via iframe). */
export function printOrderTicket(order: Order, restaurantName: string): void {
  const items = order.order_items ?? [];
  const ticket = buildThermalTicket(
    {
      comanda: order.comanda,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      delivery_address: order.delivery_address,
      delivery_type: order.delivery_type,
      observations: order.observations,
      total: order.total,
      delivery_fee: order.delivery_fee ?? 0,
      payment_method: order.payment_method,
      order_items: items.map((i) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        total: i.total,
        notes: (i as unknown as { notes?: string }).notes ?? "",
      })),
      created_at: order.created_at,
    },
    restaurantName,
  );
  printTicket(ticket);
}
