import { useState, useEffect } from "react";
import { Check, X, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/modules/supabase/client";
import { useStore } from "@/modules/cidadela-core/store";

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  total: number;
  payment_status: "pending" | "awaiting_confirmation" | "paid" | "rejected";
  payment_proof_url: string | null;
  payment_rejected_reason: string | null;
  itens: Array<{ name: string; quantity: number; total: number }>;
};

export function GerenciarPedidos() {
  const { state } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Buscar pedidos do Supabase
  const fetchOrders = async () => {
    const storeId = state.admin.storeId || state.admin.accessKey;
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar pedidos:", error);
    } else {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  // Carregar pedidos ao montar
  useEffect(() => {
    fetchOrders();
  }, []);

  const handleConfirmPayment = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_confirmed_at: new Date().toISOString(),
        payment_confirmed_by: state.admin.storeId,
      })
      .eq("id", orderId);

    if (error) {
      console.error("Erro ao confirmar pagamento:", error);
      alert("Erro ao confirmar pagamento");
    } else {
      fetchOrders();
      setSelectedOrder(null);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedOrder) return;

    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "rejected",
        payment_rejected_reason: rejectReason,
      })
      .eq("id", selectedOrder.id);

    if (error) {
      console.error("Erro ao rejeitar pagamento:", error);
      alert("Erro ao rejeitar pagamento");
    } else {
      fetchOrders();
      setSelectedOrder(null);
      setShowRejectModal(false);
      setRejectReason("");
    }
  };

  const getStatusBadge = (status: Order["payment_status"]) => {
    const styles = {
      pending: "bg-gray-500",
      awaiting_confirmation: "bg-yellow-500",
      paid: "bg-green-500",
      rejected: "bg-red-500",
    };
    const labels = {
      pending: "Pendente",
      awaiting_confirmation: "Aguardando Confirmação",
      paid: "Pago",
      rejected: "Rejeitado",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold text-white ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-tech" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-tech">Gerenciar Pedidos</h2>

      <div className="space-y-3">
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="rounded-lg border border-border bg-secondary p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-tech">{order.customer_name}</span>
                    {getStatusBadge(order.payment_status)}
                  </div>
                  <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                  <p className="text-xs text-muted-foreground">{order.delivery_address}</p>
                  <p className="text-sm font-bold text-tech mt-2">
                    R$ {order.total.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {order.payment_status === "awaiting_confirmation" && order.payment_proof_url && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 rounded hover:bg-muted transition-colors"
                        title="Ver comprovante"
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmPayment(order.id)}
                        className="p-2 rounded bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors"
                        title="Confirmar pagamento"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowRejectModal(true);
                        }}
                        className="p-2 rounded bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                        title="Rejeitar pagamento"
                      >
                        <X className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal para ver comprovante */}
      {selectedOrder && selectedOrder.payment_proof_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-tech">Comprovante de Pagamento</h3>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            <img
              src={selectedOrder.payment_proof_url}
              alt="Comprovante"
              className="w-full rounded-lg"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => handleConfirmPayment(selectedOrder.id)}
                className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors"
              >
                Confirmar Pagamento
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(true);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
              >
                Rejeitar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para rejeitar pagamento */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-tech">Rejeitar Pagamento</h3>
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição..."
              className="w-full h-32 rounded-lg border border-border bg-secondary p-3 text-sm resize-none"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRejectPayment}
                disabled={!rejectReason}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
