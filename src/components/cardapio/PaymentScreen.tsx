import { useEffect, useState } from "react";
import { Copy, Check, X, QrCode } from "lucide-react";
import type { Order } from "@/lib/types";
import { brl, hexToRgba, buildPixPayload } from "@/lib/utils";

export default function PaymentScreen({
  order,
  pixKey,
  merchantName = "Meu Restaurante",
  merchantCity = "BRASIL",
  accent = "#06b6d4",
  onSuccess,
  onClose,
}: {
  order: Order;
  pixKey: string;
  merchantName?: string;
  merchantCity?: string;
  accent?: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const isPix = order.payment_method === "pix";

  // Payload EMV "Copia e Cola" — o que o app do banco realmente lê.
  const payload = pixKey
    ? buildPixPayload({
        pixKey,
        merchantName,
        merchantCity,
        amount: order.total,
        txid: order.id.replace(/-/g, "").slice(0, 25),
      })
    : "";
  const qrData = payload || pixKey;

  useEffect(() => {
    if (isPix) return;
    const id = setTimeout(onSuccess, 2000);
    return () => clearTimeout(id);
  }, [isPix, onSuccess]);

  function confirm() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
    }, 3000);
  }

  if (!isPix) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 backdrop-blur">
        <div className="text-center">
          <div
            className="mx-auto size-10 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: hexToRgba(accent, 0.25), borderTopColor: accent }}
          />
          <p className="mt-4 text-sm text-gray-300">Processando pagamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b12] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black text-white">
            <QrCode className="size-5" style={{ color: accent }} />
            Pagamento PIX
          </h2>
          <button onClick={onClose} aria-label="Fechar pagamento">
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        <p className="text-center text-3xl font-black" style={{ color: accent }}>
          {brl(order.total)}
        </p>
        <p className="mt-1 text-center text-xs text-gray-400">
          Comanda {order.comanda}
        </p>

        <div className="mt-5 grid place-items-center">
          {qrData ? (
            <div
              className="rounded-xl p-2"
              style={{ border: `1px solid ${hexToRgba(accent, 0.25)}`, backgroundColor: "#fff" }}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=210x210&data=${encodeURIComponent(qrData)}`}
                alt="QR Code PIX para pagamento do pedido"
                width={210}
                height={210}
                className="rounded-lg"
              />
            </div>
          ) : (
            <p className="text-xs text-red-400">Chave PIX não configurada pelo administrador</p>
          )}
        </div>

        {qrData && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(qrData);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-xs text-gray-300 transition-colors hover:bg-white/[0.08]"
          >
            <span className="truncate">{qrData}</span>
            {copied ? (
              <Check className="size-4 shrink-0 text-green-400" />
            ) : (
              <Copy className="size-4 shrink-0 text-gray-400" />
            )}
          </button>
        )}

        <div
          className="mt-4 rounded-xl p-3 text-xs leading-relaxed"
          style={{
            border: `1px solid ${hexToRgba(accent, 0.3)}`,
            backgroundColor: hexToRgba(accent, 0.08),
            color: accent,
          }}
        >
          <p className="font-bold">Como pagar</p>
          <p>1. Abra o app do seu banco</p>
          <p>2. Escaneie o QR Code ou copie a chave PIX</p>
          <p>3. Confirme aqui quando o pagamento for feito</p>
        </div>

        <button
          onClick={confirm}
          disabled={loading}
          className="mt-5 w-full rounded-full py-3 text-sm font-bold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundColor: accent,
            boxShadow: `0 0 24px ${hexToRgba(accent, 0.45)}`,
          }}
        >
          {loading ? "Confirmando..." : "Já paguei"}
        </button>
      </div>
    </div>
  );
}
