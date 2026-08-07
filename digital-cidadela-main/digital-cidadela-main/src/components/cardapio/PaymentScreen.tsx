import { useEffect, useState } from "react";
import { Copy, Check, X } from "lucide-react";
import type { Order } from "@/lib/types";
import { brl } from "@/modules/core/utils";

export default function PaymentScreen({
  order,
  pixKey,
  onSuccess,
  onClose,
}: {
  order: Order;
  pixKey: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const isPix = order.pagamento === "pix";

  useEffect(() => {
    if (isPix) return;
    const id = setTimeout(onSuccess, 2000);
    return () => clearTimeout(id);
  }, [isPix, onSuccess]);

  function confirm() {
    setLoading(true);
    setTimeout(onSuccess, 3000);
  }

  if (!isPix) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 backdrop-blur">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-300">Processando pagamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--color-brass)]/40 bg-black p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Pagamento PIX</h2>
          <button onClick={onClose} aria-label="Fechar pagamento">
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        <p className="text-center text-3xl font-black text-[color:var(--color-brass)]">
          {brl(order.total)}
        </p>

        <div className="mt-4 grid place-items-center">
          {pixKey ? (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixKey)}`}
              alt="QR Code PIX para pagamento do pedido"
              width={200}
              height={200}
              className="rounded-lg bg-white p-2"
            />
          ) : (
            <p className="text-xs text-red-400">Chave PIX não configurada pelo administrador</p>
          )}
        </div>

        {pixKey && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(pixKey);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-black/60 px-3 py-2 text-xs text-gray-300"
          >
            <span className="truncate">{pixKey}</span>
            {copied ? (
              <Check className="size-4 shrink-0 text-green-400" />
            ) : (
              <Copy className="size-4 shrink-0 text-gray-400" />
            )}
          </button>
        )}

        <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">
          <p>1. Abra o app do seu banco</p>
          <p>2. Escaneie o QR Code ou copie a chave PIX</p>
        </div>

        <button
          onClick={confirm}
          disabled={loading}
          className="ember-glow mt-4 w-full rounded-full bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Confirmando..." : "Já paguei"}
        </button>
      </div>
    </div>
  );
}
