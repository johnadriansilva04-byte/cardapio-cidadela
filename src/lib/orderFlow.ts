import type { Order, OrderStatus } from "@/lib/types";

/**
 * Próximo passo natural do fluxo, na ordem em que o operador costuma avançar.
 *
 * Pedido de retirada não passa por "saiu para entrega" — esse status só faz
 * sentido quando há entrega, e antes disso o operador era obrigado a marcar o
 * pedido como "a caminho" só para chegar em "entregue".
 */
export function nextStatusFor(order: Pick<Order, "status" | "delivery_type">): OrderStatus | null {
  const isDelivery = order.delivery_type === "entrega";
  switch (order.status) {
    case "received":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return isDelivery ? "out_for_delivery" : "delivered";
    case "out_for_delivery":
      return "delivered";
    default:
      return null;
  }
}
