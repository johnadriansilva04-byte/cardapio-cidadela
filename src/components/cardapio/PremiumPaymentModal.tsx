import { X, Copy, Check, Crown } from "lucide-react";
import { useState } from "react";

const PIX_KEY = "65025130000124"; // CNPJ Banco Santander S.A.
const PIX_CNPJ = "65025130000124"; // CNPJ Banco Santander S.A.

type Plan = {
  years: number;
  price: number;
};

const PLANS: Plan[] = [
  { years: 1, price: 300 },
  { years: 2, price: 500 },
  { years: 3, price: 700 },
];

export default function PremiumPaymentModal({
  onClose,
  onPaid,
}: {
  onClose: () => void;
  onPaid: (plan: Plan) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
  };

  const handlePaid = () => {
    if (selectedPlan) {
      onPaid(selectedPlan);
    }
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

        {!selectedPlan ? (
          <>
            <p className="mb-4 text-sm text-gray-300">
              Escolha o plano desejado para continuar:
            </p>

            <div className="mb-4 space-y-3">
              {PLANS.map((plan) => (
                <button
                  key={plan.years}
                  onClick={() => handlePlanSelect(plan)}
                  className="w-full rounded-lg border border-[color:var(--color-brass)]/30 bg-black/50 p-4 text-left hover:border-[color:var(--color-brass)] hover:bg-[color:var(--color-brass)]/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Crown className="size-5 text-[color:var(--color-brass)]" />
                      <div>
                        <p className="font-bold text-white">{plan.years} {plan.years === 1 ? 'Ano' : 'Anos'}</p>
                        <p className="text-xs text-gray-400">Acesso completo ao sistema</p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-[color:var(--color-brass)]">
                      R$ {plan.price}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-300">
              Plano selecionado: <span className="font-bold text-[color:var(--color-brass)]">{selectedPlan.years} {selectedPlan.years === 1 ? 'Ano' : 'Anos'} - R$ {selectedPlan.price}</span>
            </p>

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
              <p className="mb-2 text-xs text-gray-400">CNPJ (Banco Santander S.A.):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-[color:var(--color-cyan)]">{PIX_CNPJ}</code>
                <button
                  onClick={handleCopy}
                  className="rounded-lg border border-gray-500/50 p-2 text-gray-300 hover:border-gray-400"
                  aria-label="Copiar CNPJ"
                >
                  {copied ? <Check className="size-4 text-green-400" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={handlePaid}
              className="w-full rounded-full bg-[color:var(--color-brass)] py-3 text-sm font-bold text-black hover:bg-[color:var(--color-brass)]/80"
            >
              Já paguei
            </button>

            <button
              onClick={() => setSelectedPlan(null)}
              className="mt-2 w-full rounded-lg border border-gray-600/30 py-2 text-xs text-gray-400 hover:border-gray-500/50"
            >
              Voltar para escolher plano
            </button>
          </>
        )}
      </div>
    </div>
  );
}
