import { Settings, X, Lock, AlertCircle } from "lucide-react";
import { useState } from "react";

import { CobraFumando } from "@/components/CobraFumando";
import { ConfigOperacional } from "@/components/cidadela/Config";
import { useStore } from "@/modules/cidadela-core/store";
import { useAdminTrial } from "@/modules/supabase/admin";

type Tab = "config" | "pedidos";
type LoginStep = "login" | "trial" | "premium" | "blocked";

const TABS: { id: Tab; label: string }[] = [
  { id: "config", label: "Operacional" },
  { id: "pedidos", label: "Comandas" },
];

export function AdminModal({ onClose }: { onClose: () => void }) {
  const { state, update } = useStore();
  const [tab, setTab] = useState<Tab>("config");
  const [loginStep, setLoginStep] = useState<LoginStep>("login");
  const [accessCode, setAccessCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [liberationCode, setLiberationCode] = useState("");
  const [error, setError] = useState("");

  const {
    trial,
    isLoading,
    isExpired,
    daysRemaining,
    createTrial,
    validateAccessCode,
    activateLiberationCode,
  } = useAdminTrial();

  async function handleLogin() {
    setError("");
    if (!accessCode.trim()) {
      setError("Digite o código de acesso");
      return;
    }

    const result = await validateAccessCode(accessCode.trim());
    if (result.valid) {
      if (result.trial?.is_premium) {
        setLoginStep("premium");
      } else {
        setLoginStep("trial");
      }
    } else {
      setError("Código inválido");
    }
  }

  async function handleCreateTrial() {
    setError("");
    if (!storeName.trim() || !adminPhone.trim()) {
      setError("Preencha todos os campos");
      return;
    }

    const result = await createTrial(storeName.trim(), adminPhone.trim());
    if (result) {
      setLoginStep("trial");
    } else {
      setError("Erro ao criar trial");
    }
  }

  async function handleActivateCode() {
    setError("");
    if (!liberationCode.trim()) {
      setError("Digite o código de liberação");
      return;
    }

    const result = await activateLiberationCode(liberationCode.trim());
    if (result.success) {
      setLoginStep("premium");
    } else {
      setError(result.message);
    }
  }

  function handleWhatsAppPayment() {
    const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || state.whatsapp;
    const message = encodeURIComponent(
      "Olá! Gostaria de adquirir o código de liberação para o painel administrativo do Pracinha. Meu trial expirou.",
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  }

  // Se não tiver trial ou estiver expirado, mostrar tela de login
  if (!trial || isExpired) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm">
        <div className="mx-auto min-h-screen w-full max-w-md bg-slate-900 sm:my-6 sm:min-h-0 sm:rounded-2xl sm:border sm:border-border">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <Lock className="size-6 text-[color:var(--brass)]" />
              <div>
                <h2 className="text-stencil text-lg text-white">ACESSO ADMINISTRATIVO</h2>
                <p className="text-tech text-[9px] text-gray-300">
                  {isExpired ? "Trial expirado" : "Insira seu código de acesso"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="text-white hover:text-gray-300"
            >
              <X className="size-5" />
            </button>
          </header>

          <div className="px-5 py-6">
            {isExpired ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-400">Trial Expirado</p>
                      <p className="mt-1 text-sm text-gray-300">
                        Seu período de teste de 2 dias encerrou. Adquira o código de liberação para
                        continuar usando o painel.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleWhatsAppPayment}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                >
                  Solicitar Código via WhatsApp
                </button>

                <div className="rounded-lg border border-border bg-slate-800 p-4">
                  <p className="text-sm font-medium text-gray-200 mb-2">Já tem o código?</p>
                  <input
                    value={liberationCode}
                    onChange={(e) => setLiberationCode(e.target.value)}
                    placeholder="Digite o código de liberação"
                    className="w-full rounded-lg border border-input bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    onClick={handleActivateCode}
                    className="mt-2 w-full rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)] hover:opacity-90 transition-opacity"
                  >
                    Ativar Código
                  </button>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Código de Acesso
                  </label>
                  <input
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Digite seu código"
                    className="w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-gray-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  className="w-full rounded-lg bg-[color:var(--brass)] px-4 py-3 text-sm font-medium text-[color:var(--matte)] hover:opacity-90 transition-opacity"
                >
                  Entrar
                </button>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="border-t border-border pt-4">
                  <p className="text-sm text-gray-300 mb-3">
                    Primeira vez? Crie seu trial gratuito:
                  </p>
                  <div className="space-y-3">
                    <input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Nome da loja"
                      className="w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-gray-500"
                    />
                    <input
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="WhatsApp do administrador"
                      className="w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-gray-500"
                    />
                    <button
                      type="button"
                      onClick={handleCreateTrial}
                      className="w-full rounded-lg border border-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--brass)] hover:bg-[color:var(--brass)]/10 transition-colors"
                    >
                      Iniciar Trial Gratuito (2 dias)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Se estiver no trial, mostrar banner de dias restantes
  const showTrialBanner = trial && !trial.is_premium && !isExpired;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="mx-auto min-h-screen w-full max-w-4xl bg-slate-900 sm:my-6 sm:min-h-0 sm:rounded-2xl sm:border sm:border-border">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <CobraFumando className="size-9 text-[color:var(--brass)]" />
            <div>
              <h2 className="text-stencil text-xl text-white">PAINEL ADMINISTRATIVO</h2>
              <p className="text-tech text-[9px] text-gray-300">
                {trial.is_premium ? "Premium" : `Trial - ${daysRemaining} dias restantes`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="text-white hover:text-gray-300"
          >
            <X className="size-5" />
          </button>
        </header>

        {showTrialBanner && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-5 py-3">
            <p className="text-sm text-yellow-400">
              ⚠️ Seu trial expira em {daysRemaining} dias. Adquira o código premium para continuar
              usando o painel.
            </p>
          </div>
        )}

        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 bg-slate-800">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`text-tech flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[10px] ${
                tab === id
                  ? "bg-[color:var(--olive)] text-white"
                  : "text-gray-300 hover:bg-slate-700"
              }`}
            >
              <Settings className="size-3.5" /> {label}
            </button>
          ))}
        </nav>

        <div className="px-5 py-6 bg-slate-900">
          {tab === "config" && <ConfigOperacional />}
          {tab === "pedidos" && (
            <div className="text-center text-sm text-gray-300">
              Módulo de comandas em desenvolvimento
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
