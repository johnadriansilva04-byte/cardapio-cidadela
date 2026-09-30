import { useEffect, useMemo } from "react";
import { CheckCircle2, MessageCircle, Eye, Star } from "lucide-react";
import { brl, sendToWhatsApp } from "@/lib/utils";

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
  customer_complement?: string;
  customer_neighborhood?: string;
  customer_city?: string;
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

  const isDelivery = order.delivery_type === "entrega";
  const points = soberaniaPoints(order.total);

  // Confete de celebração — peças com cor, deriva e atraso determinísticos.
  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: `${(i * 37 + 13) % 100}%`,
        delay: `${(i % 8) * 90}ms`,
        drift: `${((i % 7) - 3) * 24}px`,
        color: ["#06b6d4", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899"][i % 5],
        size: i % 3 === 0 ? 7 : 5,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur sm:items-center sm:p-4">
      {/* Chuva de confete — só visual, não captura cliques */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: c.left,
              animationDelay: c.delay,
              backgroundColor: c.color,
              width: c.size,
              height: c.size * 1.4,
              "--cx": c.drift,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="w-full max-w-md rounded-t-[24px] border border-white/10 bg-[#0b0b12] p-6 shadow-2xl sm:rounded-[24px]">
        <div className="text-center">
          <div
            className="animate-pop-in mx-auto grid size-14 place-items-center rounded-full"
            style={{
              backgroundColor: `${restaurantAccent}1a`,
              border: `1px solid ${restaurantAccent}55`,
              boxShadow: `0 0 26px ${restaurantAccent}44`,
            }}
          >
            <CheckCircle2 className="size-7" style={{ color: restaurantAccent }} />
          </div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-white">Pedido confirmado!</h2>
          <p className="mt-1 text-sm text-gray-400">
            Comanda <span className="font-bold text-gray-200">{order.comanda}</span> •{" "}
            {brl(order.total)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            {isDelivery
              ? "A cozinha já recebeu seu pedido. Você pode acompanhar cada etapa em tempo real."
              : "A cozinha já recebeu seu pedido. Avisaremos quando estiver pronto para retirada."}
          </p>
        </div>

        {points > 0 && (
          <div
            className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: `${restaurantAccent}12`,
              color: restaurantAccent,
            }}
          >
            <Star className="size-3.5 fill-current" />+{points} pontos de soberania
          </div>
        )}

        <div className="mt-5 space-y-2">
          <a
            href={`/pedido/${order.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black text-white shadow-lg transition-all hover:brightness-110"
            style={{
              backgroundColor: restaurantAccent,
              boxShadow: `0 6px 20px ${restaurantAccent}55`,
            }}
          >
            <Eye className="size-4" /> Acompanhar pedido
          </a>

          {restaurantWhatsapp && (
            <button
              onClick={() => {
                const msg = `Olá! Acabei de fazer o pedido ${order.comanda} no ${restaurantName}.`;
                sendToWhatsApp(restaurantWhatsapp, msg);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-500/40 bg-green-500/5 py-3 text-sm font-semibold text-green-400 transition-colors hover:bg-green-500/10"
            >
              <MessageCircle className="size-4" /> Falar com o restaurante
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-xl py-3 text-sm font-bold text-gray-400 transition-colors hover:text-white"
          >
            Voltar ao cardápio
          </button>
        </div>
      </div>
    </div>
  );
}
