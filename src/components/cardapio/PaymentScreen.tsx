import { useEffect, useState } from "react";
import { Copy, Check, X, QrCode, Smartphone, Clock, AlertCircle } from "lucide-react";
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
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutos em segundos
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

  // Countdown timer para expiração do QR Code (5 minutos)
  useEffect(() => {
    if (!isPix) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPix]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isExpiringSoon = timeLeft > 0 && timeLeft <= 60;
  const isExpired = timeLeft === 0;

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
          <p className="mt-4 text-sm text-gray-300">Registrando pedido...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0b0b12] shadow-2xl sm:rounded-[24px]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-white">
            <QrCode className="size-5" style={{ color: accent }} />
            Pagamento PIX
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar pagamento"
            className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-center">
            <p className="text-3xl font-black" style={{ color: accent }}>
              {brl(order.total)}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Comanda {order.comanda}</p>
            
            {isPix && (
              <div className={`mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold ${
                isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-gray-400'
              }`}>
                <Clock className="size-3.5" />
                {isExpired ? 'QR Code expirado' : `Expira em ${formatTime(timeLeft)}`}
              </div>
            )}
          </div>

          <div className="mt-4 grid place-items-center">
            {isExpired ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-6 text-center">
                <AlertCircle className="mx-auto size-8 text-red-400" />
                <p className="mt-2 text-xs font-semibold text-red-300">
                  QR Code expirado
                </p>
                <p className="mt-1 text-[11px] text-red-200/70">
                  Solicite um novo QR Code ao restaurante ou entre em contato pelo WhatsApp.
                </p>
              </div>
            ) : qrData ? (
              <div className={`rounded-2xl bg-white p-2.5 transition-opacity ${isExpiringSoon ? 'animate-pulse' : ''}`}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=210x210&data=${encodeURIComponent(qrData)}`}
                  alt="QR Code PIX para pagamento do pedido"
                  width={210}
                  height={210}
                  className="rounded-lg"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-center">
                <p className="text-xs font-semibold text-amber-300">
                  Chave PIX ainda não configurada pelo estabelecimento
                </p>
                <p className="mt-1 text-[11px] text-amber-200/70">
                  Combine o pagamento direto pelo WhatsApp.
                </p>
              </div>
            )}
          </div>

          {qrData && (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(qrData);
                } catch {
                  /* ignore */
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-xs text-gray-300 transition-colors hover:bg-white/[0.08]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Copy className="size-3.5 shrink-0 text-gray-500" />
                <span className="truncate">PIX copia e cola</span>
              </span>
              {copied ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-green-400">
                  <Check className="size-3.5" /> Copiado
                </span>
              ) : (
                <span className="shrink-0 text-xs font-bold" style={{ color: accent }}>
                  Copiar
                </span>
              )}
            </button>
          )}

          <ol className="mt-4 space-y-2 text-xs text-gray-400">
            <li className="flex items-start gap-2.5">
              <span
                className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black"
                style={{ backgroundColor: hexToRgba(accent, 0.15), color: accent }}
              >
                1
              </span>
              Abra o app do seu banco
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black"
                style={{ backgroundColor: hexToRgba(accent, 0.15), color: accent }}
              >
                2
              </span>
              Escaneie o QR Code ou use o PIX copia e cola
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black"
                style={{ backgroundColor: hexToRgba(accent, 0.15), color: accent }}
              >
                3
              </span>
              Volte aqui e confirme o pagamento
            </li>
          </ol>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-600">
            <Smartphone className="size-3" />O restaurante confere o recebimento antes de preparar
          </p>
        </div>

        <div className="shrink-0 border-t border-white/[0.07] p-5">
          <button
            onClick={confirm}
            disabled={loading || isExpired}
            className="w-full rounded-full py-3.5 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: isExpired ? '#6b7280' : accent,
              boxShadow: isExpired ? 'none' : `0 6px 24px ${hexToRgba(accent, 0.45)}`,
            }}
          >
            {isExpired ? 'Gerar novo QR Code' : loading ? "Confirmando..." : "Já paguei"}
          </button>
        </div>
      </div>
    </div>
  );
}
