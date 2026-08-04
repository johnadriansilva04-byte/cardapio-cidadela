import { useState } from "react";
import { X, Copy, Check, QrCode } from "lucide-react";
import { useStore } from "@/modules/cidadela-core/store";
import type { Order } from "@/lib/types";

type PaymentScreenProps = {
  order: Order;
  onSuccess: () => void;
  onCancel: () => void;
};

export function PaymentScreen({ order, onSuccess, onCancel }: PaymentScreenProps) {
  const { state } = useStore();
  const [copied, setCopied] = useState(false);

  const pixKey = state.payment.pixKey || "Chave PIX não configurada";
  const pixQr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixKey)}`;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmPayment = () => {
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-tech">Pagamento PIX</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-destructive transition-colors"
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
              className="flex-1 px-4 py-3 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmPayment}
              className="flex-1 px-4 py-3 rounded-lg bg-[color:var(--olive)] text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Já paguei
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
