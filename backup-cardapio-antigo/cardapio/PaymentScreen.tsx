import { useState, useEffect } from "react";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { useStore } from "@/modules/cidadela-core/store";
import type { Order } from "@/lib/types";

type PaymentScreenProps = {
  order: Order;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function PaymentScreen({ order, onSuccess, onCancel }: PaymentScreenProps) {
  const { state } = useStore();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const pixKey = state.payment.pixKey || "Chave PIX não configurada";
  const pixQr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixKey)}`;

  const isPixPayment = order.pagamento === 'pix';

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmPayment = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
    }, 3000);
  };

  // Se não for PIX, processa automaticamente
  useEffect(() => {
    if (!isPixPayment) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        onSuccess();
      }, 2000);
    }
  }, [isPixPayment, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/90 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-tech">
            {isPixPayment ? "Pagamento PIX" : "Processando Pedido"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Valor a pagar</p>
            <p className="text-3xl font-bold text-tech mt-1">
              {order.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="size-12 animate-spin text-tech mb-4" />
              <p className="text-sm text-muted-foreground">
                {isPixPayment ? "Processando pagamento..." : "Processando pedido..."}
              </p>
            </div>
          ) : isPixPayment ? (
            <>
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-lg">
                  <img
                    src={pixQr}
                    alt="QR Code PIX"
                    width={180}
                    height={180}
                    className="rounded-md"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-secondary p-4">
                <p className="text-sm text-muted-foreground mb-2">Chave PIX</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-tech break-all">{pixKey}</code>
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="p-2 rounded hover:bg-muted transition-colors"
                    title="Copiar chave PIX"
                  >
                    {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-400">
                  <strong>Instruções:</strong> Abra o app do seu banco, escaneie o QR Code ou copie a chave PIX acima para fazer o pagamento.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg bg-[color:var(--olive)] text-sm font-semibold text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Já paguei"
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
