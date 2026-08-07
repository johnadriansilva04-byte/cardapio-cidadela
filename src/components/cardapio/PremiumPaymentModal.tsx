import { X, Copy, Check } from "lucide-react";
import { useState } from "react";

const PIX_KEY = "5511999999999"; // Chave PIX do patrão (substituir pelo real)

export default function PremiumPaymentModal({
  onClose,
  onPaid,
}: {
  onClose: () => void;
  onPaid: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--color-brass)]/50 bg-black p-6 text-center">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[color:var(--color-brass)]">Pagamento Premium</h2>
          <button onClick={onClose} aria-label="Fechar">
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-300">
          Faça o pagamento via PIX abaixo. Após pagar, clique em "Já fiz o PIX" e envie a mensagem no WhatsApp para resgatar seu código premium.
        </p>

        <div className="mb-4 flex justify-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(PIX_KEY)}`}
            alt="QR Code PIX"
            width={200}
            height={200}
            className="rounded-lg bg-white p-2"
          />
        </div>

        <div className="mb-4 rounded-lg border border-gray-600/30 bg-black/50 p-3">
          <p className="mb-2 text-xs text-gray-400">Chave PIX (copie e cole no app):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-[color:var(--color-cyan)]">{PIX_KEY}</code>
            <button
              onClick={handleCopy}
              className="rounded-lg border border-gray-500/50 p-2 text-gray-300 hover:border-gray-400"
              aria-label="Copiar chave PIX"
            >
              {copied ? <Check className="size-4 text-green-400" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>

        <button
          onClick={onPaid}
          className="w-full rounded-full bg-[color:var(--color-brass)] py-3 text-sm font-bold text-black hover:bg-[color:var(--color-brass)]/80"
        >
          Já paguei
        </button>
      </div>
    </div>
  );
}
