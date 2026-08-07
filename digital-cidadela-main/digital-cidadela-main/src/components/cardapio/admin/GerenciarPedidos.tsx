import { useEffect, useState } from "react";
import { Printer, RefreshCw } from "lucide-react";
import { useAdminTrial } from "@/modules/supabase/admin";
import { supabase } from "@/modules/supabase/client";
import { useStore } from "@/modules/core/store";
import { brl, buildThermalTicket, printTicket } from "@/modules/core/utils";
import type { Order } from "@/lib/types";

interface DbOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  product_id: string;
}
interface DbOrder {
  id: string;
  comanda: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_type: string;
  observations: string;
  total: number;
  delivery_fee: number;
  payment_method: string;
  payment_status: string;
  payment_proof_url: string | null;
  created_at: string;
  order_items: DbOrderItem[];
}

const statusColor: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-300",
  awaiting_confirmation: "bg-yellow-500/20 text-yellow-300",
  paid: "bg-green-500/20 text-green-300",
  rejected: "bg-red-500/20 text-red-300",
};

export default function GerenciarPedidos({ storeId }: { storeId: string }) {
  const { loadOrdersFromSupabase } = useAdminTrial();
  const storeName = useStore((s) => s.store.name);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const data = await loadOrdersFromSupabase(storeId);
    setOrders(data as unknown as DbOrder[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  async function setPayment(id: string, status: "paid" | "rejected") {
    const patch =
      status === "paid"
        ? { payment_status: status, payment_confirmed_at: new Date().toISOString() }
        : { payment_status: status, payment_rejected_reason: "Comprovante inválido" };
    await supabase.from("orders").update(patch).eq("id", id);
    refresh();
  }

  function print(o: DbOrder) {
    const order: Order = {
      comanda: o.comanda,
      cliente: o.customer_name,
      telefone: o.customer_phone,
      endereco: o.delivery_address,
      observacoes: o.observations,
      itens: (o.order_items ?? []).map((i) => ({
        id: i.product_id,
        name: i.product_name,
        quantity: i.quantity,
        price: Number(i.unit_price),
        total: Number(i.total),
      })),
      total: Number(o.total),
      tipo_entrega: o.delivery_type === "retirada" ? "retirada" : "entrega",
      taxa_entrega: Number(o.delivery_fee),
      pagamento: (o.payment_method as Order["pagamento"]) ?? "pix",
      status: "pendente",
      createdAt: o.created_at,
      synced: true,
    };
    printTicket(buildThermalTicket(order, storeName));
  }

  return (
    <div className="space-y-3">
      <button
        onClick={refresh}
        className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-tech)]"
      >
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
      </button>

      {orders.length === 0 && (
        <p className="py-6 text-center text-xs text-gray-500">Nenhum pedido encontrado</p>
      )}

      {orders.map((o) => (
        <div key={o.id} className="rounded-xl border border-red-500/20 bg-black/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">{o.comanda}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                statusColor[o.payment_status] ?? statusColor['pending']
              }`}
            >
              {o.payment_status}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {o.customer_name} • {o.customer_phone}
          </p>
          <p className="text-xs text-gray-400">{brl(Number(o.total))}</p>

          <div className="mt-2 flex flex-wrap gap-2">
            {o.payment_proof_url && (
              <a
                href={o.payment_proof_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-blue-500/40 px-2 py-1 text-[10px] text-blue-300"
              >
                Ver comprovante
              </a>
            )}
            <button
              onClick={() => setPayment(o.id, "paid")}
              className="rounded-lg border border-green-500/40 px-2 py-1 text-[10px] text-green-300"
            >
              Confirmar pagamento
            </button>
            <button
              onClick={() => setPayment(o.id, "rejected")}
              className="rounded-lg border border-red-500/40 px-2 py-1 text-[10px] text-red-300"
            >
              Rejeitar pagamento
            </button>
            <button
              onClick={() => print(o)}
              className="flex items-center gap-1 rounded-lg border border-[color:var(--color-brass)]/50 px-2 py-1 text-[10px] text-[color:var(--color-brass)]"
            >
              <Printer className="size-3" /> Comanda
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
