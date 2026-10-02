import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Crown,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  CalendarClock,
  Store as StoreIcon,
} from "lucide-react";
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
import { StatTile, ExpandableSection, InfoRow } from "@/modules/ui/ExpandableSection";
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

const SUBSCRIPTION_LINK =
  (import.meta.env?.VITE_MERCADOPAGO_SUBSCRIPTION_LINK as string | undefined) ||
  "https://mpago.la/1Mz2uqH";

const PRICE_LABEL = "R$ 39,90/mês";

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

  const activeRestaurant = useMemo(
    () => restaurants.find((r) => r.id === activeId) ?? null,
    [restaurants, activeId],
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(SUBSCRIPTION_LINK);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente o link.");
    }
  }

  function openPayment() {
    // Registra o e-mail da conta para correlacionar o webhook com o restaurante.
    if (activeId && user?.email) void registerPendingSubscription(activeId, user.email);
    setPaymentOpen(true);
  }

  async function syncNow() {
    if (!activeId || !session?.access_token) {
      toast.error("Sessão expirada. Entre novamente.");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/subscription/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storeId: activeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string };
      if (!res.ok) {
        toast.error("Não foi possível sincronizar com o Mercado Pago.");
        return;
      }
      await loadStatus(activeId);
      if (data.status === "premium") toast.success("Assinatura Premium ativada!");
      else if (data.status === "none") toast.message("Nenhuma assinatura encontrada ainda.");
      else toast.message("Assinatura ainda não está ativa no Mercado Pago.");
    } catch {
      toast.error("Falha de conexão ao sincronizar.");
    } finally {
      setSyncing(false);
    }
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
        subtitle="Receba pedidos ilimitados por mês. Ativação automática após o pagamento."
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

      {/* Status atual */}
      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Status atual
            </p>
            <p className="mt-1 flex items-center gap-2 text-lg font-black text-white">
              {isPremium ? (
                <>
                  <Sparkles className="size-5 text-amber-300" />
                  Premium
                </>
              ) : (
                <>
                  <ShieldCheck className="size-5 text-gray-400" />
                  Gratuito
                </>
              )}
            </p>
            {activeRestaurant && (
              <p className="mt-0.5 text-xs text-gray-500">{activeRestaurant.name}</p>
            )}
          </div>
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold " +
              (isPremium
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-white/10 bg-white/[0.04] text-gray-300")
            }
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            {isPremium ? "Premium ativo" : "Plano gratuito"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {isPremium ? (
            <StatTile
              icon={<CalendarClock className="size-3.5" />}
              tone="amber"
              label="Renovação"
              value={
                status?.premiumExpiresAt
                  ? new Date(status.premiumExpiresAt).toLocaleDateString("pt-BR")
                  : "—"
              }
              hint="Próxima cobrança"
            />
          ) : (
            <StatTile
              icon={<ShieldCheck className="size-3.5" />}
              tone={remaining <= 2 ? "amber" : "cyan"}
              label="Pedidos restantes"
              value={String(remaining)}
              hint={`${used} de ${MONTHLY_FREE_LIMIT} usados`}
            />
          )}
          <StatTile
            icon={<Crown className="size-3.5" />}
            tone="violet"
            label="Plano gratuito"
            value={`${MONTHLY_FREE_LIMIT}/mês`}
            hint="Depois disso, assine Premium"
          />
        </div>

        {!isPremium && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-400">
              <span>
                {used} de {MONTHLY_FREE_LIMIT} pedidos usados este mês
              </span>
              <span>{remaining} restantes</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={
                  "h-full rounded-full transition-all " +
                  (remaining <= 0 ? "bg-red-500" : remaining <= 2 ? "bg-amber-500" : "bg-cyan-500")
                }
                style={{ width: `${Math.min(100, (used / MONTHLY_FREE_LIMIT) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {isPremium ? (
            <>
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
                className="rounded-full bg-cyan-500 text-black hover:bg-cyan-400"
              >
                <ExternalLink className="size-4" /> Gerenciar assinatura
              </Button>
              <Button
                variant="outline"
                onClick={() => setCancelOpen(true)}
                className="rounded-full border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
              >
                Cancelar assinatura
              </Button>
            </>
          ) : (
            <Button
              onClick={openPayment}
              className="rounded-full bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:bg-cyan-400"
            >
              <Crown className="size-4" /> Assinar Premium - {PRICE_LABEL}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={syncNow}
            disabled={syncing}
            className="rounded-full border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
          >
            {syncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sincronizar com Mercado Pago
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          Pagou e ainda aparece como gratuito? O Mercado Pago pode demorar alguns segundos para
          avisar. Clique em <span className="font-semibold text-gray-400">Sincronizar</span> para
          conferir na hora.
        </p>
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

      {/* Modal de pagamento */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="border-white/10 bg-[#12121a] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Crown className="size-4 text-amber-300" /> Assinar Premium
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {PRICE_LABEL} · pedidos ilimitados. Ativação automática após o pagamento.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 text-sm text-gray-300">
            {[
              "Pedidos ilimitados todos os meses",
              "Ativação automática",
              "Cancele quando quiser",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-emerald-400" /> {item}
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="break-all text-[11px] text-gray-400">{SUBSCRIPTION_LINK}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={copyLink}
              className="flex-1 rounded-full border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
            >
              <Copy className="size-4" /> Copiar link
            </Button>
            <Button
              onClick={() => window.open(SUBSCRIPTION_LINK, "_blank", "noopener,noreferrer")}
              className="flex-1 rounded-full bg-cyan-500 text-black hover:bg-cyan-400"
            >
              <ExternalLink className="size-4" /> Abrir em nova aba
            </Button>
          </div>

          <p className="text-center text-[11px] leading-relaxed text-gray-500">
            Após o pagamento, sua assinatura será ativada automaticamente.
          </p>
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
