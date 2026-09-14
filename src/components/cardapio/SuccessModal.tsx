import { useEffect } from "react";
import { CheckCircle2, MessageCircle, ExternalLink, Crown, Star } from "lucide-react";
import { brl, buildWhatsAppMessage, sendToWhatsApp } from "@/lib/utils";

function soberaniaPoints(total: number): number {
  // 1 ponto de soberania a cada R$ 30 em compras.
  return Math.floor(total / 30);
}

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
  delivery_address?: string;
  delivery_fee?: number;
  subtotal?: number;
}

export default function SuccessModal({
  order,
  restaurantName,
  restaurantWhatsapp,
  restaurantAccent = "#06b6d4",
  onClose,
}: {
  order: SuccessOrder;
  restaurantAccent?: string;
  restaurantName: string;
  restaurantWhatsapp: string;
  onClose: () => void;
}) {
  // Persiste o último pedido localmente. Assim, mesmo que o banco ainda não
  // tenha a RPC get_order_tracking, a página /pedido/<id> consegue exibir a
  // confirmação com itens. Depois que supabase/schema.sql for aplicado, a RPC
  // tem prioridade e o rastreio em tempo real passa a valer.
  useEffect(() => {
    try {
      localStorage.setItem("last_order", JSON.stringify(order));
    } catch {
      /* storage indisponível */
    }
  }, [order]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b12] p-6 text-center shadow-2xl">
        <CheckCircle2 className="mx-auto size-14 text-green-400" />
        <h2 className="mt-3 text-xl font-black text-white">Pedido confirmado!</h2>
        <p className="mt-1 text-sm text-gray-400">
          Comanda {order.comanda} • {brl(order.total)}
        </p>

        {soberaniaPoints(order.total) > 0 && (
          <div
            className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold"
            style={{
              borderColor: `${restaurantAccent}66`,
              backgroundColor: `${restaurantAccent}12`,
              color: restaurantAccent,
            }}
          >
            <Star className="size-3.5 fill-current" />+{soberaniaPoints(order.total)} pontos de
            soberania
          </div>
        )}

        <div className="mt-5 space-y-2">
          {/* Order tracking button */}
          <a
            href={`/pedido/${order.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
          >
            <ExternalLink className="size-4" /> Acompanhar pedido em tempo real
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
                    delivery_address: order.delivery_address ?? "",
                    delivery_fee: order.delivery_fee ?? 0,
                  },
                  restaurantName,
                );
                sendToWhatsApp(restaurantWhatsapp, msg);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-500/40 bg-green-500/5 py-3 text-sm font-semibold text-green-400 transition-colors hover:bg-green-500/10"
            >
              <MessageCircle className="size-4" /> Enviar pedido no WhatsApp
            </button>
          )}

          {/* Cidadela CTA */}
          <a
            href="https://pracinha.online"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors hover:brightness-125"
            style={{
              borderColor: `${restaurantAccent}88`,
              backgroundColor: `${restaurantAccent}14`,
              color: restaurantAccent,
            }}
          >
            <Crown className="size-4" /> Conheça a Cidadela
          </a>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gray-800 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
