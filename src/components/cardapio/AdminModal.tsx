import { X, Lock, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

import { CobraFumando } from "@/components/CobraFumando";
import { ConfigOperacional } from "@/components/cidadela/Config";
import { MenuPrincipal } from "./admin/MenuPrincipal";
import { GerenciarCategorias } from "./admin/GerenciarCategorias";
import { GerenciarLanches } from "./admin/GerenciarLanches";
import { GerenciarPedidos } from "./admin/GerenciarPedidos";
import { useStore } from "@/modules/cidadela-core/store";
import { useAdminTrial } from "@/modules/supabase/admin";
import { sendAdminTrial } from "@/modules/fluxos-n8n/webhook";

type Module = "menu" | "config" | "categorias" | "lanches" | "pedidos";
type LoginStep = "login" | "trial" | "premium" | "blocked";

export function AdminModal({ onClose }: { onClose: () => void }) {
  const { state, update } = useStore();
  const { trial, isLoading, isExpired, daysRemaining, createTrial, validateAccessCode, loadOrdersFromSupabase, activateLiberationCode } = useAdminTrial();
  const [loginStep, setLoginStep] = useState<"login" | "trial" | "premium">("login");
  const [accessCode, setAccessCode] = useState("");
  const [liberationCode, setLiberationCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [error, setError] = useState("");
  const [module, setModule] = useState<Module>("menu");

  // Carregar WhatsApp do trial no state quando trial carrega
  useEffect(() => {
    if (trial && trial.admin_phone && !state.admin.phone) {
      update((prev) => ({
        ...prev,
        admin: { ...prev.admin, phone: trial.admin_phone },
      }));
    }
  }, [trial, state.admin.phone, update]);

  async function handleLogin() {
    setError("");
    if (!accessCode.trim()) {
      setError("Digite o código de acesso");
      return;
    }

    const result = await validateAccessCode(accessCode.trim());
    if (result.valid) {
      // Carregar dados do dono no state
      update((prev) => ({
        ...prev,
        admin: { 
          ...prev.admin, 
          phone: result.adminPhone,
          storeId: result.storeId,
          accessCode: accessCode.trim(),
        },
      }));

      // Carregar pedidos do Supabase
      if (result.storeId) {
        const orders = await loadOrdersFromSupabase(result.storeId);
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
      }

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

    // Salvar WhatsApp do dono no state
    update((prev) => ({
      ...prev,
      admin: { ...prev.admin, phone: adminPhone.trim() },
    }));

    // Criar trial no Supabase primeiro (gera o access_code)
    const result = await createTrial(storeName.trim(), adminPhone.trim());
    if (!result) {
      setError("Erro ao criar trial");
      return;
    }

    // Enviar para o webhook N8N com o código gerado
    const webhookResult = await sendAdminTrial(
      state.integrations.adminTrialUrl,
      storeName.trim(),
      adminPhone.trim(),
      result.access_code,
    );

    if (!webhookResult.success) {
      console.error("Erro ao enviar webhook:", webhookResult.error);
      // Continuar mesmo se webhook falhar (trial já foi criado)
    }

    // Mostrar código para o usuário e pedir que digite para entrar
    setAccessCode(result.access_code);
    setError("✓ Trial criado! Código enviado via WhatsApp. Clique em 'Entrar' para acessar.");
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
              ⚠️ Trial expira em {daysRemaining} dias. Adquira o código.
            </p>
          </div>
        )}

        <div className="px-5 py-6 bg-slate-900">
          {module === "menu" && <MenuPrincipal onSelectModule={setModule} />}
          {module === "config" && <ConfigOperacional />}
          {module === "categorias" && <GerenciarCategorias onBack={() => setModule("menu")} />}
          {module === "lanches" && <GerenciarLanches onBack={() => setModule("menu")} />}
          {module === "pedidos" && <GerenciarPedidos />}
        </div>
      </div>
    </div>
  );
}
