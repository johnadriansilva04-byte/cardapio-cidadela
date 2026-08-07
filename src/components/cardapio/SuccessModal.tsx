import { CheckCircle2, MessageCircle } from "lucide-react";
import type { Order } from "@/lib/types";
import { brl } from "@/modules/core/utils";

export default function SuccessModal({
  order,
  cidadelaCode,
  points,
  onClose,
  ownerWhatsApp,
}: {
  order: Order;
  cidadelaCode?: { code: string; access_type: "15_min" | "15_dias" } | null;
  points: number;
  onClose: () => void;
  ownerWhatsApp: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-green-500/40 bg-black p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-green-400" />
        <h2 className="mt-3 text-xl font-black text-white">Pedido confirmado!</h2>
        <p className="mt-1 text-sm text-gray-400">
          Comanda {order.comanda} • {brl(order.total)}
        </p>

        {points > 0 && (
          <p className="mt-3 text-sm font-bold text-[color:var(--color-brass)]">
            +{points} pontos de Soberania
          </p>
        )}

        {cidadelaCode && (
          <div className="mt-4 rounded-xl border border-cyan-400/50 bg-cyan-400/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
              Seu código da Cidadela
            </p>
            <p className="mt-1 text-2xl font-black text-cyan-300">{cidadelaCode.code}</p>
            <p className="mt-1 text-[10px] text-cyan-200/70">
              Acesso {cidadelaCode.access_type === "15_dias" ? "de 15 dias" : "de 15 minutos"}
            </p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              const message = `Olá! Acabei de fazer o pedido ${order.comanda} no valor de ${brl(order.total)}. Gostaria de acompanhar.`;
              const whatsappUrl = `https://wa.me/${ownerWhatsApp}?text=${encodeURIComponent(message)}`;
              window.open(whatsappUrl, '_blank');
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-green-500/50 py-3 text-sm font-semibold text-green-400"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-full bg-red-600 py-3 text-sm font-bold text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
