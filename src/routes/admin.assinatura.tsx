import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Copy, ExternalLink, Loader2, ShieldCheck, Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PageHeader } from "@/modules/ui/PageHeader";
import { LoadingState, EmptyState, InlineError } from "@/modules/ui/Feedback";
import { ExpandableSection, InfoRow } from "@/modules/ui/ExpandableSection";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { normalizePhone } from "@/modules/supabase/auth";
import {
  checkSubscriptionStatus,
  cancelPremium,
  registerPendingSubscription,
  getPreapprovalId,
  MONTHLY_FREE_LIMIT,
} from "@/modules/supabase/subscription";
import { supabase } from "@/modules/supabase/client";
import type { Restaurant, SubscriptionStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura Premium — Cardápio Cidadela" }] }),
  component: SubscriptionPage,
});

const PAYMENT_LINK =
  (import.meta.env?.VITE_MERCADOPAGO_PAYMENT_LINK as string | undefined) ||
  "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1084609242-7aa21a60-04a6-4237-bc53-01a95db5d4e9";

const ANNUAL_PRICE =
  (import.meta.env?.VITE_PREMIUM_ANNUAL_PRICE as string | undefined) || "R$ 199,99/ano";

function SubscriptionPage() {
  const { user, session, loading: authLoading } = useAuth();
  const accountPhone = normalizePhone((user?.user_metadata?.phone as string) || user?.phone || "");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [preapprovalId, setPreapprovalId] = useState<string | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const retryRef = useRef(0);

  const loadStatus = useCallback(async (storeId: string) => {
    const s = await checkSubscriptionStatus(storeId);
    setStatus(s);
    setPreapprovalId(await getPreapprovalId(storeId));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await ensureRestaurantsForUser(user);
        const data = await getRestaurantsByOwner(user.id);
        if (cancelled) return;
        setRestaurants(data);
        if (data.length > 0) {
          retryRef.current = 0;
          setActiveId((prev) => prev || data[0].id);
        } else if (retryRef.current < 3) {
          // O restaurante pode ser criado logo após o cadastro — tenta de novo.
          retryRef.current++;
          await new Promise((r) => setTimeout(r, retryRef.current * 400));
          if (cancelled) return;
          const retry = await getRestaurantsByOwner(user.id);
          if (!cancelled) {
            setRestaurants(retry);
            if (retry.length > 0) setActiveId((p) => p || retry[0].id);
          }
        }
      } catch (e) {
        console.error("[assinatura] load", e);
        if (!cancelled) setError("Falha ao carregar sua assinatura.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    loadStatus(activeId).catch(() => {
      if (!cancelled) setError("Falha ao carregar o status da assinatura.");
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, loadStatus]);

  // Depois de mandar o dono ao checkout, quando ele volta para esta aba o
  // status é conferido sozinho — sem ele ter que achar o botão "Sincronizar".
  useEffect(() => {
    if (!awaitingPayment || !activeId || status?.isPremium) return;
    let checking = false;
    const check = async () => {
      if (document.visibilityState !== "visible" || checking) return;
      checking = true;
      const result = await runSync();
      checking = false;
      if (result === "premium") {
        setAwaitingPayment(false);
        toast.success("Assinatura Premium ativada!");
      }
    };
    document.addEventListener("visibilitychange", check);
    const poll = window.setInterval(check, 6000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(poll);
    };
    // runSync é estável o bastante (lê activeId/session atuais) para o efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingPayment, activeId, status?.isPremium]);

  const activeRestaurant = useMemo(
    () => restaurants.find((r) => r.id === activeId) ?? null,
    [restaurants, activeId],
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(PAYMENT_LINK);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente o link.");
    }
  }

  async function openPayment() {
    if (!activeId) return;
    // Registra o e-mail da conta para correlacionar o webhook com o restaurante.
    if (user?.email) void registerPendingSubscription(activeId, user.email);

    // Gera um link de pagamento com o external_reference correto
    try {
      const res = await fetch("/api/payment/create-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ storeId: activeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { initPoint?: string };
      if (!res.ok || !data.initPoint) {
        toast.error("Não foi possível gerar o link de pagamento.");
        return;
      }

      // Abre o checkout no mesmo gesto do clique. O modal é só fallback para
      // quando o navegador bloqueia o popup — antes era sempre um clique extra.
      const win = window.open(data.initPoint, "_blank", "noopener,noreferrer");
      setAwaitingPayment(true);
      if (!win) setPaymentOpen(true);
    } catch {
      toast.error("Não foi possível gerar o link de pagamento.");
    }
  }

  async function runSync(): Promise<"premium" | "none" | "pending" | "error"> {
    if (!activeId || !session?.access_token) return "error";
    try {
      // Para pagamentos pontuais, a sincronização é feita pelo webhook automaticamente
      // Aqui apenas recarregamos o status
      await loadStatus(activeId);
      if (status?.isPremium) return "premium";
      return "none";
    } catch {
      return "error";
    }
  }

  async function syncNow() {
    if (!activeId || !session?.access_token) {
      toast.error("Sessão expirada. Entre novamente.");
      return;
    }
    setSyncing(true);
    const result = await runSync();
    setSyncing(false);
    if (result === "premium") {
      setAwaitingPayment(false);
      toast.success("Assinatura Premium ativada!");
    } else if (result === "none") toast.message("Nenhuma assinatura encontrada ainda.");
    else if (result === "pending")
      toast.message("Assinatura ainda não está ativa no Mercado Pago.");
    else toast.error("Não foi possível sincronizar com o Mercado Pago.");
  }

  async function confirmCancel() {
    if (!activeId) return;
    setCancelling(true);
    try {
      const ok = await cancelPremium(activeId);
      if (!ok) {
        toast.error("Não foi possível cancelar agora.");
        return;
      }
      await loadStatus(activeId);
      setCancelOpen(false);
      toast.success("Assinatura cancelada. Você voltou ao plano gratuito.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <LoadingState label="Carregando assinatura…" />;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assinatura Premium" subtitle="Gerencie seu plano." />
        <InlineError message={error} />
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assinatura Premium" subtitle="Gerencie seu plano." />
        <EmptyState
          icon={StoreIcon}
          title="Nenhum restaurante ainda"
          description="Crie um restaurante para poder assinar o Premium."
        />
      </div>
    );
  }

  const isPremium = status?.isPremium ?? false;
  const used = status?.monthlyOrderCount ?? 0;
  const remaining = status?.remainingOrders ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Crown className={isPremium ? "size-5 text-amber-300" : "size-5 text-cyan-300"} />
            Assinatura Premium
          </span>
        }
        subtitle="Pedidos ilimitados por 1 ano. Ativação automática após o pagamento via Pix, cartão ou boleto."
      />

      {restaurants.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.03] px-2.5 py-1.5">
            <StoreIcon className="size-3.5 text-gray-500" />
            <span className="text-[11px] font-semibold text-gray-400">Restaurante</span>
          </div>
          {restaurants.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveId(r.id)}
              className={
                "rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors " +
                (r.id === activeId
                  ? "bg-cyan-500 text-black"
                  : "border border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]")
              }
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {/* Plano + ação num único bloco: um clique até o pagamento */}
      <section
        className={
          "relative overflow-hidden rounded-3xl border p-5 sm:p-6 " +
          (isPremium
            ? "border-amber-500/25 bg-gradient-to-b from-amber-500/[0.10] to-transparent"
            : "border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01]")
        }
      >
        <div
          aria-hidden
          className={
            "pointer-events-none absolute -right-16 -top-16 size-48 rounded-full blur-3xl " +
            (isPremium ? "bg-amber-500/20" : "bg-cyan-500/10")
          }
        />

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Seu plano
            </span>
            <span
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold " +
                (isPremium
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-white/10 bg-white/[0.04] text-gray-400")
              }
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {isPremium ? "Premium ativo" : "Gratuito"}
            </span>
          </div>

          <p className="mt-2 flex items-center gap-2 text-2xl font-black tracking-tight text-white">
            {isPremium ? (
              <Crown className="size-6 shrink-0 text-amber-300" />
            ) : (
              <ShieldCheck className="size-6 shrink-0 text-cyan-300" />
            )}
            {isPremium ? "Pedidos ilimitados" : `${MONTHLY_FREE_LIMIT} pedidos/mês`}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {isPremium
              ? status?.premiumExpiresAt
                ? `Válido até ${new Date(status.premiumExpiresAt).toLocaleDateString("pt-BR")}.`
                : "Assinatura ativa e sem limite de pedidos."
              : `${remaining} de ${MONTHLY_FREE_LIMIT} pedidos restantes este mês.`}
          </p>

          {!isPremium && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={
                  "h-full rounded-full transition-all " +
                  (remaining <= 0 ? "bg-red-500" : remaining <= 2 ? "bg-amber-500" : "bg-cyan-500")
                }
                style={{ width: `${Math.min(100, (used / MONTHLY_FREE_LIMIT) * 100)}%` }}
              />
            </div>
          )}

          <div className="mt-5">
            {isPremium ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    window.open(
                      preapprovalId
                        ? `https://www.mercadopago.com.br/subscriptions/${preapprovalId}`
                        : SUBSCRIPTION_LINK,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="rounded-full bg-white/[0.06] text-white hover:bg-white/[0.12]"
                >
                  <ExternalLink className="size-4" /> Gerenciar assinatura
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCancelOpen(true)}
                  className="rounded-full border-white/10 bg-transparent text-gray-400 hover:bg-white/[0.06] hover:text-white"
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                onClick={openPayment}
                size="lg"
                className="w-full rounded-full bg-cyan-500 text-sm font-bold text-black shadow-[0_8px_30px_rgba(6,182,212,0.3)] transition-transform hover:scale-[1.01] hover:bg-cyan-400 sm:w-auto sm:px-8"
              >
                <Crown className="size-4" /> Assinar por {ANNUAL_PRICE}
              </Button>
            )}
          </div>

          {awaitingPayment && !isPremium && (
            <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.07] px-3.5 py-3">
              <Loader2 className="size-4 shrink-0 animate-spin text-cyan-300" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-cyan-200">Confirmando seu pagamento…</p>
                <p className="mt-0.5 text-[11px] text-cyan-200/70">
                  Conclua no Mercado Pago. Assim que aprovar, liberamos sozinho — sem recarregar.
                </p>
              </div>
            </div>
          )}

          {!isPremium && (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-gray-500 sm:text-left">
              Pagou e ainda aparece como gratuito?{" "}
              <button
                type="button"
                onClick={syncNow}
                disabled={syncing}
                className="font-semibold text-cyan-400 underline-offset-2 transition-colors hover:text-cyan-300 hover:underline disabled:opacity-50"
              >
                {syncing ? "Conferindo…" : "Conferir agora"}
              </button>
            </p>
          )}
        </div>
      </section>

      {/* Histórico / detalhes */}
      <ExpandableSection
        icon={<Crown className="size-5" />}
        tone="amber"
        title="Detalhes da assinatura"
        summary={isPremium ? "Premium ativo" : "Plano gratuito"}
      >
        <InfoRow label="Restaurante" value={activeRestaurant?.name ?? "—"} />
        <InfoRow label="Status" value={isPremium ? "Premium" : "Gratuito"} />
        <InfoRow label="Pedidos usados no mês" value={String(used)} />
        <InfoRow label="Limite gratuito" value={`${MONTHLY_FREE_LIMIT}/mês`} />
        <InfoRow
          label="Data de renovação"
          value={
            status?.premiumExpiresAt
              ? new Date(status.premiumExpiresAt).toLocaleString("pt-BR")
              : "—"
          }
        />
        <InfoRow label="ID da assinatura MP" value={preapprovalId ?? "—"} />
        <InfoRow
          label="Reset do contador"
          value={status?.resetDate ? new Date(status.resetDate).toLocaleDateString("pt-BR") : "—"}
        />
      </ExpandableSection>

      {/* Fallback: só quando o navegador bloqueia a nova aba do checkout */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="border-white/10 bg-[#12121a] text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Crown className="size-4 text-amber-300" /> Finalizar assinatura
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {ANNUAL_PRICE} · pedidos ilimitados por 1 ano. Ativação automática após o pagamento.
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs leading-relaxed text-gray-400">
            Seu navegador bloqueou a nova aba. Use o botão abaixo para abrir o Mercado Pago, ou
            copie o link e abra no celular.
          </p>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                window.open(PAYMENT_LINK, "_blank", "noopener,noreferrer");
                setPaymentOpen(false);
              }}
              className="rounded-full bg-cyan-500 text-black hover:bg-cyan-400"
            >
              <ExternalLink className="size-4" /> Abrir Mercado Pago
            </Button>
            <Button
              variant="outline"
              onClick={copyLink}
              className="rounded-full border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
            >
              <Copy className="size-4" /> Copiar link
            </Button>
          </div>

          <p className="text-center text-[11px] leading-relaxed text-amber-300/80">
            Use o mesmo telefone da sua conta{accountPhone ? ` (${accountPhone})` : ""} no Mercado
            Pago para a ativação ser vinculada a este restaurante.
          </p>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar assinatura Premium?"
        description="Você volta ao plano gratuito de 5 pedidos por mês. O acesso Premium continua até o fim do período já pago."
        confirmLabel="Cancelar assinatura"
        cancelLabel="Manter Premium"
        onConfirm={confirmCancel}
        loading={cancelling}
      />
    </div>
  );
}
