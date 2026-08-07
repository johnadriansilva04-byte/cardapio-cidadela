import { useState } from "react";
import { X, ArrowLeft, Copy } from "lucide-react";
import MenuPrincipal, { type AdminScreen } from "./admin/MenuPrincipal";
import GerenciarCategorias from "./admin/GerenciarCategorias";
import GerenciarLanches from "./admin/GerenciarLanches";
import GerenciarPedidos from "./admin/GerenciarPedidos";
import DescontosConfig from "./admin/DescontosConfig";
import PremiumPaymentModal from "./PremiumPaymentModal";
import { useAdminTrial } from "@/modules/supabase/admin";
import { useStore } from "@/modules/core/store";
import { supabase } from "@/modules/supabase/client";

const field =
  "w-full rounded-lg border border-red-500/30 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-red-500 focus:outline-none";

export default function AdminModal({ onClose }: { onClose: () => void }) {
  const state = useStore();
  const update = useStore((s) => s.update);
  const {
    trial,
    isExpired,
    secondsRemaining,
    formattedTime,
    createTrial,
    validateAccessCode,
    activateLiberationCode,
    updateAdminConfig,
    clearTrial,
  } = useAdminTrial();

  const [screen, setScreen] = useState<AdminScreen>("menu");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [storeName, setStoreName] = useState(state.store.name);
  const [liberation, setLiberation] = useState("");
  const [message, setMessage] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveredCode, setRecoveredCode] = useState<string | null>(null);

  const [cfg, setCfg] = useState({
    store_name: state.store.name,
    store_slogan: state.store.slogan,
    store_marquee: state.store.marquee,
    pix_key: state.payment.pixKey,
    whatsapp: state.whatsapp,
    accessKey: state.admin.accessKey,
    n8n: state.integrations.n8nWebhookUrl,
  });

  const unlocked = Boolean(trial) && (!isExpired || Boolean(trial?.is_premium));
  const status = trial?.is_premium ? "PREMIUM ATIVO" : formattedTime;

  async function handleCreate() {
    if (!email.trim() || !phone.trim()) {
      setMessage("Informe e-mail e telefone");
      return;
    }

    // Verificar duplicidade no Supabase
    const { data: existingEmail } = await supabase
      .from("admin_trials")
      .select("id")
      .eq("admin_email", email.trim())
      .maybeSingle();

    if (existingEmail) {
      setMessage("Este e-mail já está cadastrado. Use outro e-mail ou faça login.");
      return;
    }

    const { data: existingPhone } = await supabase
      .from("admin_trials")
      .select("id")
      .eq("admin_phone", phone.trim())
      .maybeSingle();

    if (existingPhone) {
      setMessage("Este telefone já está cadastrado. Use outro número ou faça login.");
      return;
    }

    const created = await createTrial(storeName, phone, email);
    if (!created) {
      setMessage("Não foi possível criar o trial");
      return;
    }
    update((s) => {
      s.admin.storeId = created.store_id;
      s.admin.email = email;
      s.admin.phone = phone;
    });
    setMessage(`Seu código de administrador: ${created.store_id}`);
  }

  async function handleLogin() {
    const { valid, trial: t } = await validateAccessCode(email);
    if (!t) {
      setMessage("Conta não encontrada");
      return;
    }
    update((s) => {
      s.admin.storeId = t.store_id;
      s.admin.email = t.admin_email ?? email;
      s.whatsapp = t.whatsapp ?? "";
    });
    setMessage(valid ? "Acesso liberado" : "Trial expirado");
  }

  function handleRequestPremium() {
    setShowPaymentModal(true);
  }

  function handlePaymentComplete(plan: { years: number; price: number }) {
    setShowPaymentModal(false);
    const whatsappMessage = `Trial acabou, quero o código premium - Plano: ${plan.years} ${plan.years === 1 ? 'ano' : 'anos'} - R$ ${plan.price}`;
    const whatsappUrl = `https://wa.me/5548999880030?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
  }

  async function handleRecoverCode() {
    if (!recoveryEmail.trim()) {
      setMessage("Informe seu e-mail cadastrado");
      return;
    }

    try {
      const { data: adminData } = await supabase
        .from("admin_trials")
        .select("store_id, admin_email")
        .eq("admin_email", recoveryEmail.trim())
        .maybeSingle();

      if (adminData) {
        setRecoveredCode(adminData.store_id);
      } else {
        setMessage("E-mail não encontrado. Verifique ou crie uma nova conta.");
      }
    } catch (error) {
      console.error("Erro ao recuperar código:", error);
      setMessage("Erro ao buscar código. Tente novamente.");
    }
  }

  async function saveConfig() {
    update((s) => {
      s.store.name = cfg.store_name;
      s.store.slogan = cfg.store_slogan;
      s.store.marquee = cfg.store_marquee;
      s.payment.pixKey = cfg.pix_key;
      s.whatsapp = cfg.whatsapp;
      s.admin.accessKey = cfg.accessKey;
      s.integrations.n8nWebhookUrl = cfg.n8n;
    });
    if (trial) {
      await updateAdminConfig(trial.id, {
        store_name: cfg.store_name,
        store_slogan: cfg.store_slogan,
        store_marquee: cfg.store_marquee,
        pix_key: cfg.pix_key,
        whatsapp: cfg.whatsapp,
      });
    }
    setMessage("Configurações salvas");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/90 backdrop-blur sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[color:var(--color-brass)]/50 bg-black p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {screen !== "menu" && (
              <button onClick={() => setScreen("menu")} aria-label="Voltar ao menu">
                <ArrowLeft className="size-5 text-gray-400" />
              </button>
            )}
            <h2 className="text-lg font-bold text-[color:var(--color-tech)]">Painel FEB</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar painel">
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        {message && (
          <p className="mb-3 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-2 text-xs text-cyan-200">
            {message}
          </p>
        )}

        {!unlocked ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Teste gratuito de 2 minutos. Já tem conta? Entre com seu e-mail.
            </p>
            <input
              className={field}
              placeholder="Nome da loja"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
            <input
              className={field}
              placeholder="E-mail do administrador"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className={field}
              placeholder="Telefone do administrador"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="flex-1 rounded-lg bg-[color:var(--color-brass)] py-2 text-sm font-bold text-black"
              >
                Iniciar trial
              </button>
              <button
                onClick={handleLogin}
                className="flex-1 rounded-lg border border-cyan-400/50 py-2 text-sm font-bold text-cyan-300"
              >
                Entrar
              </button>
            </div>

            <div className="border-t border-red-500/20 pt-3">
              <input
                className={field}
                placeholder="Código de liberação (ADM-XXXXXX)"
                value={liberation}
                onChange={(e) => setLiberation(e.target.value.toUpperCase())}
              />
              <button
                onClick={async () => {
                  const res = await activateLiberationCode(liberation);
                  setMessage(res.message);
                }}
                className="mt-2 w-full rounded-lg border border-green-500/50 py-2 text-sm font-bold text-green-300"
              >
                Ativar premium
              </button>
              <button
                onClick={handleRequestPremium}
                className="mt-2 w-full rounded-lg border border-[color:var(--color-brass)]/50 py-2 text-sm font-bold text-[color:var(--color-brass)]"
              >
                Solicitar código premium
              </button>
              <button
                onClick={() => setShowRecoveryModal(true)}
                className="mt-2 w-full rounded-lg border border-gray-500/30 py-2 text-xs text-gray-400 hover:border-gray-500/50"
              >
                Perdeu seu código de acesso? Recuperar
              </button>

              {trial?.store_id && (
                <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                  <p className="mb-2 text-xs text-gray-400">Seu link personalizado:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-cyan-300 break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/?store_id=${trial.store_id}` : `/?store_id=${trial.store_id}`}
                    </code>
                    <button
                      onClick={() => {
                        const url = typeof window !== 'undefined' ? `${window.location.origin}/?store_id=${trial.store_id}` : `/?store_id=${trial.store_id}`;
                        navigator.clipboard.writeText(url);
                        setMessage("Link copiado!");
                      }}
                      className="rounded border border-cyan-500/50 p-1 text-cyan-300 hover:border-cyan-400"
                      aria-label="Copiar link"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Compartilhe este link no seu WhatsApp
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {screen === "menu" && <MenuPrincipal onSelect={setScreen} status={status} />}

            {screen === "config" && (
              <div className="space-y-3">
                <input
                  className={field}
                  placeholder="Nome da loja"
                  value={cfg.store_name}
                  onChange={(e) => setCfg({ ...cfg, store_name: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Slogan"
                  value={cfg.store_slogan}
                  onChange={(e) => setCfg({ ...cfg, store_slogan: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Marquee"
                  value={cfg.store_marquee}
                  onChange={(e) => setCfg({ ...cfg, store_marquee: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Chave PIX"
                  value={cfg.pix_key}
                  onChange={(e) => setCfg({ ...cfg, pix_key: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="WhatsApp"
                  value={cfg.whatsapp}
                  onChange={(e) => setCfg({ ...cfg, whatsapp: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Webhook N8N"
                  value={cfg.n8n}
                  onChange={(e) => setCfg({ ...cfg, n8n: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Chave administrativa"
                  value={cfg.accessKey}
                  onChange={(e) => setCfg({ ...cfg, accessKey: e.target.value })}
                />
                <button
                  onClick={saveConfig}
                  className="w-full rounded-lg bg-[color:var(--color-brass)] py-2 text-sm font-bold text-black"
                >
                  Salvar
                </button>
              </div>
            )}

            {screen === "categorias" && <GerenciarCategorias />}
            {screen === "lanches" && <GerenciarLanches />}
            {screen === "pedidos" && <GerenciarPedidos storeId={trial?.store_id ?? ""} />}
            {screen === "descontos" && <DescontosConfig />}

            {screen === "menu" && (
              <button
                onClick={() => {
                  clearTrial();
                  setMessage("Sessão encerrada");
                }}
                className="mt-4 w-full text-xs text-gray-500"
              >
                Sair do painel
              </button>
            )}
          </>
        )}
      </div>

      {showPaymentModal && (
        <PremiumPaymentModal
          onClose={() => setShowPaymentModal(false)}
          onPaid={handlePaymentComplete}
        />
      )}

      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-6 text-center">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Recuperar Código de Acesso</h2>
              <button onClick={() => setShowRecoveryModal(false)} aria-label="Fechar">
                <X className="size-5 text-gray-400" />
              </button>
            </div>

            {!recoveredCode ? (
              <>
                <p className="mb-4 text-sm text-gray-300">
                  Informe o e-mail cadastrado para recuperar seu código de acesso.
                </p>

                <input
                  className={field}
                  placeholder="E-mail cadastrado"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                />

                {message && <p className="mt-2 text-xs text-destructive">{message}</p>}

                <button
                  onClick={handleRecoverCode}
                  className="mt-4 w-full rounded-lg bg-cyan-500/20 border border-cyan-500/50 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                >
                  Buscar código
                </button>

                <button
                  onClick={() => {
                    const whatsappMessage = "Perdi meu código de acesso do cardápio";
                    const whatsappUrl = `https://wa.me/5548999880030?text=${encodeURIComponent(whatsappMessage)}`;
                    window.open(whatsappUrl, '_blank');
                  }}
                  className="mt-2 w-full rounded-lg border border-gray-500/30 py-2 text-xs text-gray-400 hover:border-gray-500/50"
                >
                  Ou solicitar via WhatsApp
                </button>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-300">
                  Seu código de acesso foi encontrado:
                </p>

                <div className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <p className="text-xs text-gray-400 mb-1">Código de acesso (store_id):</p>
                  <p className="text-2xl font-bold text-cyan-300">{recoveredCode}</p>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(recoveredCode);
                    setMessage("Código copiado!");
                  }}
                  className="mt-4 w-full rounded-lg bg-cyan-500/20 border border-cyan-500/50 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                >
                  Copiar código
                </button>

                <button
                  onClick={() => {
                    setShowRecoveryModal(false);
                    setRecoveredCode(null);
                    setRecoveryEmail("");
                    setMessage("");
                  }}
                  className="mt-2 w-full rounded-lg border border-gray-500/30 py-2 text-xs text-gray-400 hover:border-gray-500/50"
                >
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
