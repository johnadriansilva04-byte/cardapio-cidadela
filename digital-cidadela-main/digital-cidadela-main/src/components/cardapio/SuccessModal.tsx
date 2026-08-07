import { CheckCircle2, Printer } from "lucide-react";
import type { Order } from "@/lib/types";
import { brl } from "@/modules/core/utils";

export default function SuccessModal({
  order,
  cidadelaCode,
  points,
  onClose,
  onPrint,
}: {
  order: Order;
  cidadelaCode?: { code: string; access_type: "15_min" | "15_dias" } | null;
  points: number;
  onClose: () => void;
  onPrint: () => void;
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
            onClick={onPrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[color:var(--color-brass)]/50 py-3 text-sm font-semibold text-[color:var(--color-brass)]"
          >
            <Printer className="size-4" /> Comanda
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
