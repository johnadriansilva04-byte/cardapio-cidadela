import { X, Lock, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

import { CobraFumando } from "@/components/CobraFumando";
import { ConfigOperacional } from "@/components/cidadela/Config";
import { MenuPrincipal } from "./admin/MenuPrincipal";
import { GerenciarCategorias } from "./admin/GerenciarCategorias";
import { GerenciarLanches } from "./admin/GerenciarLanches";
import { GerenciarPedidos } from "./admin/GerenciarPedidos";
import { DescontosConfig } from "./admin/DescontosConfig";
import { useStore } from "@/modules/cidadela-core/store";
import { useAdminTrial } from "@/modules/supabase/admin";
import { sendAdminTrial } from "@/modules/fluxos-n8n/webhook";

type Module = "menu" | "config" | "categorias" | "lanches" | "pedidos" | "descontos";
type LoginStep = "login" | "trial" | "premium" | "blocked";

export function AdminModal({ onClose }: { onClose: () => void }) {
  const { state, update } = useStore();
  const { trial, isLoading, isExpired, daysRemaining, createTrial, validateAccessCode, loadOrdersFromSupabase, activateLiberationCode, signInWithGoogle, signOut, checkSession } = useAdminTrial();
  const [loginStep, setLoginStep] = useState<"login" | "trial" | "premium">("login");
  const [adminEmail, setAdminEmail] = useState("");
  const [liberationCode, setLiberationCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [error, setError] = useState("");
  const [module, setModule] = useState<Module>("menu");
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Carregar WhatsApp do trial no state quando trial carrega
  useEffect(() => {
    if (trial && trial.admin_phone && !state.admin.phone) {
      update((prev) => ({
        ...prev,
        admin: { ...prev.admin, phone: trial.admin_phone },
      }));
    }
  }, [trial, state.admin.phone, update]);

  // Limpar trials antigos no localStorage com mais de 2 minutos
  useEffect(() => {
    const savedTrial = localStorage.getItem("admin_trial");
    if (savedTrial) {
      try {
        const parsed = JSON.parse(savedTrial);
        const expiresAt = new Date(parsed.trial_expires_at);
        const startedAt = new Date(parsed.trial_started_at);
        const diffMinutes = (expiresAt.getTime() - startedAt.getTime()) / (1000 * 60);
        
        // Se o trial tem mais de 2 minutos, limpar
        if (diffMinutes > 2) {
          console.log("Limpando trial antigo com mais de 2 minutos");
          localStorage.removeItem("admin_trial");
          localStorage.removeItem("admin_last_activity");
        }
      } catch (e) {
        console.error("Erro ao verificar trial antigo:", e);
      }
    }
  }, []);

  // Cronômetro em tempo real para o trial
  useEffect(() => {
    if (!trial || trial.is_premium || isExpired) {
      setTimeRemaining("");
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expiresAt = new Date(trial.trial_expires_at);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("00:00");
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setTimeRemaining(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [trial, isExpired]);

  // Verificar sessão do Google ao montar e após callback
  useEffect(() => {
    const checkGoogleSession = async () => {
      // Verificar se acabou de fazer login com Google via callback
      const justLoggedIn = localStorage.getItem("google_auth_just_logged_in");
      const googleEmail = localStorage.getItem("google_auth_email");
      
      if (justLoggedIn === "true" && googleEmail) {
        // Limpar flags
        localStorage.removeItem("google_auth_just_logged_in");
        localStorage.removeItem("google_auth_email");
        
        // Usar o e-mail do Google
        setAdminEmail(googleEmail);
        // Pequeno delay para garantir que o state foi atualizado
        setTimeout(() => handleLogin(), 100);
        return;
      }
      
      // Verificar sessão atual do Supabase
      const session = await checkSession();
      if (session?.user?.email) {
        setAdminEmail(session.user.email);
        // Pequeno delay para garantir que o state foi atualizado
        setTimeout(() => handleLogin(), 100);
      }
    };
    checkGoogleSession();
  }, []);

  async function handleGoogleLogin() {
    const result = await signInWithGoogle();
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError("Erro ao fazer login com Google");
    }
  }

  async function handleLogin() {
    setError("");
    const email = adminEmail.trim();
    
    if (!email) {
      setError("Digite seu e-mail");
      return;
    }

    // Validar formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("E-mail inválido");
      return;
    }

    // Mostrar loading durante validação
    setError("Validando...");
    
    const result = await validateAccessCode(email);
    
    if (result.trial) {
      // E-mail encontrado, carregar dados do dono no state
      update((prev) => ({
        ...prev,
        admin: { 
          ...prev.admin, 
          email: email,
          phone: result.adminPhone,
          storeId: result.storeId,
        },
      }));

      // Carregar pedidos do Supabase em paralelo para evitar delay
      if (result.storeId) {
        loadOrdersFromSupabase(result.storeId).then((orders) => {
          update((prev) => ({
            ...prev,
            orders: orders.map(order => ({
              id: order.id,
              cliente: order.customer_name,
              telefone: order.customer_phone,
              endereco: order.delivery_address || '',
              observacoes: order.observations || '',
              itens: order.order_items?.map((item: any) => ({
                id: item.product_id,
                name: item.product_name,
                quantity: item.quantity,
                price: item.unit_price,
                total: item.total,
              })) || [],
              total: order.total,
              tipo_entrega: order.delivery_type,
              taxa_entrega: order.delivery_fee,
              pagamento: order.payment_method,
              troco: order.change_for,
              comanda: order.comanda,
              synced: order.webhook_sent,
              status: order.status === 'pending' ? 'pendente' : order.status === 'confirmed' || order.status === 'preparing' ? 'andamento' : 'entregue',
              createdAt: order.created_at,
            })),
          }));
        });
      }

      setError(""); // Limpar mensagem de loading
      
      if (result.trial?.is_premium) {
        setLoginStep("premium");
      } else {
        setLoginStep("trial");
      }
    } else {
      setError("E-mail não encontrado. Crie um novo trial.");
    }
  }

  async function handleCreateTrial() {
    setError("");
    if (!storeName.trim() || !adminPhone.trim() || !adminEmail.trim()) {
      setError("Preencha todos os campos");
      return;
    }

    // Validar formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail.trim())) {
      setError("E-mail inválido");
      return;
    }

    // Salvar dados do dono no state
    update((prev) => ({
      ...prev,
      admin: { 
        ...prev.admin, 
        email: adminEmail.trim(),
        phone: adminPhone.trim() 
      },
    }));

    // Criar trial no Supabase usando e-mail como identificador
    const result = await createTrial(storeName.trim(), adminPhone.trim(), adminEmail.trim());
    if (!result) {
      setError("Erro ao criar trial");
      return;
    }

    // Enviar para o webhook N8N com os dados do trial
    const webhookResult = await sendAdminTrial(
      state.integrations.adminTrialUrl,
      storeName.trim(),
      adminPhone.trim(),
      adminEmail.trim(),
    );

    if (!webhookResult.success) {
      console.error("Erro ao enviar webhook:", webhookResult.error);
      // Continuar mesmo se webhook falhar (trial já foi criado)
    }

    // Acesso direto - não precisa mais digitar código
    setLoginStep("trial");
    setError("");
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
    const message = encodeURIComponent("Quero código do painel Pracinha. Trial expirou.");
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
                  {isExpired ? "Trial expirado" : "Insira seu e-mail"}
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
                      <p className="mt-1 text-sm text-gray-300">Adquira o código para continuar.</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleWhatsAppPayment}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                >
                  Solicitar Código
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
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Entrar com Google
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-slate-900 px-2 text-gray-400">ou entre com e-mail</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    E-mail
                  </label>
                  <input
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="seu@email.com"
                    type="email"
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

                {error && <p className={`text-sm ${error.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{error}</p>}

                <div className="border-t border-border pt-4">
                  <p className="text-sm text-gray-300 mb-3">Primeira vez?</p>
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
                    <input
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="E-mail do administrador"
                      type="email"
                      className="w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-gray-500"
                    />
                    <button
                      type="button"
                      onClick={handleCreateTrial}
                      className="w-full rounded-lg border border-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--brass)] hover:bg-[color:var(--brass)]/10 transition-colors"
                    >
                      Trial Gratuito (2 dias)
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
                {trial.is_premium ? "Premium" : timeRemaining ? `Trial - ${timeRemaining}` : `Trial - ${daysRemaining} min`}
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
              ⚠️ Trial expira em {timeRemaining || `${daysRemaining} min`}. Adquira o código.
            </p>
          </div>
        )}

        <div className="px-5 py-6 bg-slate-900">
          {module === "menu" && <MenuPrincipal onSelectModule={setModule} />}
          {module === "config" && <ConfigOperacional />}
          {module === "categorias" && <GerenciarCategorias onBack={() => setModule("menu")} />}
          {module === "lanches" && <GerenciarLanches onBack={() => setModule("menu")} />}
          {module === "pedidos" && <GerenciarPedidos />}
          {module === "descontos" && <DescontosConfig onBack={() => setModule("menu")} />}
        </div>
      </div>
    </div>
  );
}
