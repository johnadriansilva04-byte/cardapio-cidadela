import { CheckCircle2, MessageCircle, ExternalLink } from "lucide-react";
import { brl, buildWhatsAppMessage, sendToWhatsApp } from "@/lib/utils";

interface SuccessOrder {
  id: string;
  comanda: string;
  total: number;
  customer_name: string;
  customer_phone: string;
  items: { product_name: string; quantity: number; total: number }[];
  observations: string;
  payment_method: string;
  delivery_type: string;
}

export default function SuccessModal({
  order,
  restaurantSlug,
  restaurantName,
  restaurantWhatsapp,
  onClose,
}: {
  order: SuccessOrder;
  restaurantSlug: string;
  restaurantName: string;
  restaurantWhatsapp: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-green-500/40 bg-black p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-green-400" />
        <h2 className="mt-3 text-xl font-black text-white">Pedido confirmado!</h2>
        <p className="mt-1 text-sm text-gray-400">
          Comanda {order.comanda} • {brl(order.total)}
        </p>

        {/* Cidadela unlock hint */}
        <div className="mt-4 rounded-xl border border-cyan-400/50 bg-cyan-400/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
            Cidadela desbloqueada!
          </p>
          <p className="mt-1 text-xs text-cyan-200/70">
            Sua compra desbloqueou o acesso à Cidadela
          </p>
        </div>

        <div className="mt-5 space-y-2">
          {/* Order tracking button */}
          <a
            href={`/pedido/${order.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-cyan-500/50 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
          >
            <ExternalLink className="size-4" /> Acompanhar pedido
          </a>

          {/* WhatsApp button */}
          {restaurantWhatsapp && (
            <button
              onClick={() => {
                const msg = buildWhatsAppMessage(
                  {
                    comanda: order.comanda,
                    customer_name: order.customer_name,
                    total: order.total,
                    order_items: order.items,
                    observations: order.observations,
                    payment_method: order.payment_method,
                    delivery_type: order.delivery_type,
                    delivery_address: "",
                  },
                  restaurantName,
                );
                sendToWhatsApp(restaurantWhatsapp, msg);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-green-500/50 py-3 text-sm font-semibold text-green-400 hover:bg-green-500/10"
            >
              <MessageCircle className="size-4" /> Enviar para WhatsApp
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full rounded-full bg-gray-800 py-3 text-sm font-bold text-white hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
