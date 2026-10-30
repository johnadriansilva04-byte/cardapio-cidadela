import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  ExternalLink,
  Gift,
  Infinity as InfinityIcon,
  Loader2,
  Lock,
  Minus,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store as StoreIcon,
  Zap,
  AlertCircle,
  Mail,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PageHeader } from "@/modules/ui/PageHeader";
import { LoadingState, EmptyState, InlineError } from "@/modules/ui/Feedback";
import { InfoRow } from "@/modules/ui/ExpandableSection";
import { useCountUp } from "@/hooks/useCountUp";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { normalizePhone, updateProfileEmail } from "@/modules/supabase/auth";
import {
  checkSubscriptionStatus,
  cancelPremium,
  registerPendingSubscription,
  getPreapprovalId,
  MONTHLY_FREE_LIMIT,
} from "@/modules/supabase/subscription";
import { supabase } from "@/modules/supabase/client";
import { fetchRewards, type RewardProgress } from "@/modules/supabase/rewards";
import { RewardsProgress } from "@/modules/ui/RewardsProgress";
import type { Restaurant, SubscriptionStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura Premium — Cardápio Cidadela" }] }),
  component: SubscriptionPage,
});

// Link estático é apenas fallback legado — o fluxo real usa o link dinâmico
// gerado por /api/payment/create-link (com external_reference). Sem a env, o
// modal orienta a gerar o link novamente em vez de abrir uma preferência fixa.
const PAYMENT_LINK = (import.meta.env?.VITE_MERCADOPAGO_PAYMENT_LINK as string | undefined) || "";

const SUBSCRIPTION_LINK =
  (import.meta.env?.VITE_MERCADOPAGO_SUBSCRIPTION_LINK as string | undefined) ||
  "https://www.mercadopago.com.br/subscriptions";

const ANNUAL_PRICE =
  (import.meta.env?.VITE_PREMIUM_ANNUAL_PRICE as string | undefined) || "R$ 199,99/ano";

const field =
  "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";

/** Vantagens do Premium, na ordem em que o dono as percebe no dia a dia. */
const PREMIUM_BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: InfinityIcon,
    title: "Pedidos ilimitados",
    text: `Acabou a cota de ${MONTHLY_FREE_LIMIT}/mês — o cardápio recebe o dia inteiro.`,
  },
  {
    icon: Lock,
    title: "Itens sempre liberados",
    text: "O detalhe de cada pedido abre na hora, sem cadeado nem aviso de bloqueio.",
  },
  {
    icon: Zap,
    title: "Confirmação automática",
    text: "Pix, cartão ou boleto aprovam e o Premium liga sozinho, sem espera.",
  },
];

/** Comparativo gratuito × Premium — a diferença em uma olhada, sem letras miúdas. */
const PLAN_COMPARISON: { feature: string; free: string; premium: string }[] = [
  { feature: "Pedidos por mês", free: `${MONTHLY_FREE_LIMIT}`, premium: "Ilimitados" },
  { feature: "Detalhes dos pedidos", free: "Bloqueiam na cota", premium: "Sempre liberados" },
  { feature: "Ativação após pagamento", free: "—", premium: "Automática" },
  { feature: "Cancele quando quiser", free: "—", premium: "Sim, sem multa" },
];

/** Contador animado do uso do plano gratuito. */
function AnimatedCount({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{shown}</>;
}

/** Um e-mail que o Mercado Pago poderia reconhecer (não o pseudo interno). */
function isRealEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !email.includes("@menufacil.local");
}

/** Atalho do hub: abre uma aba de tela cheia, com prévia do conteúdo. */
function HubTile({
  icon: Icon,
  tone,
  title,
  hint,
  badge,
  onClick,
}: {
  icon: LucideIcon;
  tone: "cyan" | "emerald" | "amber" | "violet";
  title: string;
  hint: string;
  badge?: React.ReactNode;
  onClick: () => void;
}) {
  const toneCls = {
    cyan: "bg-cyan-500/15 text-cyan-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    violet: "bg-violet-500/15 text-violet-300",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-2.5 text-left transition-colors hover:border-white/15 hover:bg-white/[0.05]"
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneCls}`}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-white">{title}</span>
          {badge}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-gray-400">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-gray-600" />
    </button>
  );
}

/** Cabeçalho de uma aba de tela cheia: título curto e seta de voltar. */
function TabHeader({
  icon: Icon,
  title,
  tone = "cyan",
}: {
  icon: LucideIcon;
  title: string;
  tone?: "cyan" | "emerald" | "amber" | "violet";
}) {
  const toneCls = {
    cyan: "bg-cyan-500/15 text-cyan-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    violet: "bg-violet-500/15 text-violet-300",
  }[tone];

  return (
    <div className="flex items-center gap-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneCls}`}>
        <Icon className="size-4" />
      </span>
      <SheetTitle className="text-base font-black tracking-tight text-white">{title}</SheetTitle>
    </div>
  );
}

/** Pulso curto de comemoração (puramente visual, não captura cliques). */
function CelebrationBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: `${(i * 41 + 7) % 100}%`,
        delay: `${(i % 8) * 80}ms`,
        drift: `${((i % 7) - 3) * 22}px`,
        color: ["#22d3ee", "#fbbf24", "#f59e0b", "#a78bfa"][i % 4],
        size: i % 3 === 0 ? 7 : 5,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((c, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: c.left,
              animationDelay: c.delay,
              backgroundColor: c.color,
              width: c.size,
              height: c.size * 1.4,
              "--cx": c.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Aba do hub: cada assunto abre em tela cheia por cima, sem rolar a página. */
type HubTab = "planos" | "vantagens" | "email" | "detalhes";

/**
 * Hub de assinatura em uma tela só.
 *
 * A página não rola: mostra o estado do plano e quatro atalhos. Cada assunto
 * abre num painel de tela cheia por cima (Sheet), que rola por dentro — o
 * operador nunca precisa arrastar a página para achar o botão de assinar.
 */
function SubscriptionPage() {
  const { user, session, profile, loading: authLoading } = useAuth();
  const accountPhone = normalizePhone((user?.user_metadata?.phone as string) || user?.phone || "");
  // E-mail real (opcional): é o que o Mercado Pago usa para casar o pagamento
  // quando o webhook chega sem o external_reference. Nunca exibimos o
  // pseudo-e-mail interno (`...@menufacil.local`) — ele não serve para nada
  // para o dono e só confundia.
  const metaEmail = (user?.user_metadata?.email as string) || "";
  const accountEmail =
    (profile?.email as string | undefined) || (isRealEmail(metaEmail) ? metaEmail : "");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [rewards, setRewards] = useState<RewardProgress[]>([]);
  const [preapprovalId, setPreapprovalId] = useState<string | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Comemoração visual: dispara no instante em que o Premium é liberado e some
  // sozinha — o confete não deve ficar pendurado na tela.
  const [justActivated, setJustActivated] = useState(false);
  const retryRef = useRef(0);

  // E-mail para o Mercado Pago (opcional, editável aqui mesmo).
  const [currentEmail, setCurrentEmail] = useState(accountEmail);
  const [emailDraft, setEmailDraft] = useState(accountEmail);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // Aba de tela cheia aberta sobre o hub (null = hub).
  const [tab, setTab] = useState<HubTab | null>(null);

  useEffect(() => {
    setCurrentEmail(accountEmail);
    setEmailDraft(accountEmail);
  }, [accountEmail]);

  async function handleSaveEmail() {
    setSavingEmail(true);
    setEmailMsg(null);
    const res = await updateProfileEmail(emailDraft);
    setSavingEmail(false);
    if (!res.ok) {
      setEmailMsg({ type: "err", text: res.error ?? "Erro ao salvar." });
      return;
    }
    const clean = emailDraft.trim().toLowerCase();
    setCurrentEmail(clean);
    setEmailDraft(clean);
    setEmailMsg({ type: "ok", text: clean ? "E-mail salvo!" : "E-mail removido." });
    setTimeout(() => setEmailMsg(null), 3000);
  }

  useEffect(() => {
    if (!justActivated) return;
    const t = window.setTimeout(() => setJustActivated(false), 2600);
    return () => window.clearTimeout(t);
  }, [justActivated]);

  const loadStatus = useCallback(async (storeId: string) => {
    const s = await checkSubscriptionStatus(storeId);
    setStatus(s);
    setPreapprovalId(await getPreapprovalId(storeId));
    setRewards(await fetchRewards(storeId));
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
        setJustActivated(true);
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
    const url = paymentLink || PAYMENT_LINK;
    if (!url) {
      toast.error("Gere o link novamente para copiá-lo.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente o link.");
    }
  }

  async function openPayment() {
    if (!activeId) return;
    // Só registra o e-mail quando é um endereço real. Gravar o pseudo-e-mail
    // interno (`...@menufacil.local`) como `admin_email` não ajuda o webhook e
    // ainda o expunha na tela; sem e-mail, o `external_reference` do link já
    // vincula o pagamento ao restaurante.
    if (currentEmail) void registerPendingSubscription(activeId, currentEmail);

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

      // Guarda o link dinâmico (com external_reference) para o modal de
      // fallback — o link estático não vincula o pagamento ao restaurante.
      setPaymentLink(data.initPoint);

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
      // O endpoint busca o preapproval na API do Mercado Pago pelo e-mail da
      // conta e aplica o resultado. Antes esta função só relia o status local,
      // então "Conferir agora" nunca destravava o Premium quando o webhook
      // atrasava — parecia que o pagamento não havia sido reconhecido.
      const res = await fetch("/api/subscription/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storeId: activeId }),
      });

      if (res.status === 403) return "error";
      if (!res.ok) return "error";

      const data = (await res.json().catch(() => ({}))) as { status?: string };
      // Recarrega o status local (o sync já aplicou no banco).
      await loadStatus(activeId);

      if (data.status === "premium") return "premium";
      if (data.status === "free") return "none";
      if (data.status === "none") return "none";
      return "pending";
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
      setJustActivated(true);
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
  const bonus = status?.bonusOrders ?? 0;
  const limit = status?.monthlyLimit ?? MONTHLY_FREE_LIMIT;
  const remaining = status?.remainingOrders ?? 0;
  const priceShort = ANNUAL_PRICE.replace(/\/ano$/, "");
  const usagePct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  return (
    <div className="mx-auto max-w-md space-y-3">
      <PageHeader title="Assinatura Premium" subtitle="Pedidos ilimitados por 1 ano." />

      {restaurants.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
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

      {isPremium ? (
        /* Passe ativo: estado + as duas ações. Nada mais na tela. */
        <section className="premium-pass animate-slide-up relative overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.14] via-white/[0.03] to-transparent p-4">
          {justActivated && <CelebrationBurst />}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 size-52 rounded-full bg-amber-500/25 blur-3xl"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/90">
              <Sparkles className="size-3.5" /> Passe Premium
            </span>
            <p className="mt-2 flex items-center gap-2 text-xl font-black tracking-tight text-white">
              <Crown className="size-5 shrink-0 text-amber-300" /> Pedidos ilimitados
            </p>
            <p className="mt-1 text-xs text-gray-300">
              {status?.premiumExpiresAt
                ? `Ativo até ${new Date(status.premiumExpiresAt).toLocaleDateString("pt-BR")}.`
                : "Assinatura ativa."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
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
                className="tap rounded-full bg-white/[0.07] text-white hover:bg-white/[0.13]"
              >
                <ExternalLink className="size-4" /> Gerenciar
              </Button>
              <Button
                variant="outline"
                onClick={() => setCancelOpen(true)}
                className="tap rounded-full border-white/10 bg-transparent text-gray-400 hover:bg-white/[0.06] hover:text-white"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </section>
      ) : (
        /* Convite: preço e o botão. Só isso — sem parágrafo de venda. */
        <section className="animate-slide-up relative overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-b from-white/[0.055] to-white/[0.01] p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-28 size-64 rounded-full bg-cyan-500/15 blur-3xl"
          />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-500">
                Plano gratuito
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-gray-300">
                <AnimatedCount value={used} />/{limit} pedidos
              </span>
            </div>

            <p className="mt-3 flex items-baseline gap-1.5 text-white">
              <span className="text-[clamp(2rem,10vw,2.5rem)] font-black leading-none tracking-tight">
                {priceShort}
              </span>
              <span className="text-sm font-semibold text-gray-500">/ano</span>
            </p>
            <p className="mt-1 text-[11px] text-gray-500">pedidos ilimitados por 1 ano</p>

            <Button
              onClick={openPayment}
              size="lg"
              className="sheen tap mt-3.5 h-12 w-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-500 text-base font-black text-black shadow-[0_10px_34px_rgba(6,182,212,0.35)] transition-transform hover:scale-[1.01] hover:from-cyan-300 hover:to-cyan-400"
            >
              <Crown className="size-5" /> Assinar agora
            </Button>
            <p className="mt-2 text-center text-[11px] text-gray-500">
              Pix, cartão ou boleto · cancele quando quiser
            </p>

            {awaitingPayment && (
              <p className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold text-cyan-300">
                <Loader2 className="size-3.5 animate-spin" /> Confirmando pagamento…
              </p>
            )}
          </div>
        </section>
      )}

      {/* Atalhos: cada um abre uma aba de tela cheia por cima. */}
      <div className="space-y-2">
        <HubTile
          icon={Sparkles}
          tone="cyan"
          title="O que muda"
          hint="Benefícios e comparativo"
          onClick={() => setTab("vantagens")}
        />
        <HubTile
          icon={Mail}
          tone={currentEmail ? "violet" : "amber"}
          title="E-mail do Mercado Pago"
          hint={currentEmail || "Toque para informar"}
          badge={
            currentEmail ? undefined : (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                pendente
              </span>
            )
          }
          onClick={() => setTab("email")}
        />
        <HubTile
          icon={Gift}
          tone="emerald"
          title="Pedidos e detalhes"
          hint={
            isPremium
              ? "Premium ativo"
              : `${used} de ${limit} usados${bonus > 0 ? ` · +${bonus} bônus` : ""}`
          }
          badge={
            !isPremium ? (
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[10px] font-bold " +
                  (remaining <= 0
                    ? "bg-red-500/15 text-red-300"
                    : remaining <= 2
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-cyan-500/15 text-cyan-300")
                }
              >
                {remaining > 0 ? `${remaining} restantes` : "esgotada"}
              </span>
            ) : undefined
          }
          onClick={() => setTab("detalhes")}
        />
      </div>

      {/* ---- Aba: benefícios e comparativo ---- */}
      <Sheet open={tab === "vantagens"} onOpenChange={(o) => !o && setTab(null)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-white/10 bg-[#0b0b10] p-0 text-white sm:max-w-md"
        >
          <div className="border-b border-white/[0.07] px-4 py-3">
            <TabHeader icon={Sparkles} title="O que muda" />
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <ul className="space-y-2">
              {PREMIUM_BENEFITS.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-cyan-500/12 text-cyan-300">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">{title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">{text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-gray-500">Recurso</span>
                <span className="text-center text-gray-500">Gratuito</span>
                <span className="text-center text-cyan-300">Premium</span>
              </div>
              {PLAN_COMPARISON.map((row, i) => (
                <div
                  key={row.feature}
                  className={
                    "grid grid-cols-[1.4fr_1fr_1fr] items-center px-3 py-2.5 text-[11px] " +
                    (i % 2 ? "bg-white/[0.015]" : "")
                  }
                >
                  <span className="pr-2 font-medium text-gray-300">{row.feature}</span>
                  <span className="flex items-center justify-center gap-1 text-center text-gray-500">
                    {row.free === "—" ? <Minus className="size-3.5" /> : row.free}
                  </span>
                  <span className="flex items-center justify-center gap-1 text-center font-semibold text-white">
                    <Check className="size-3.5 shrink-0 text-emerald-400" />
                    {row.premium}
                  </span>
                </div>
              ))}
            </div>

            {!isPremium && (
              <Button
                onClick={() => {
                  setTab(null);
                  void openPayment();
                }}
                size="lg"
                className="sheen tap h-12 w-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-500 text-base font-black text-black"
              >
                <Crown className="size-5" /> Assinar por {priceShort}/ano
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ---- Aba: e-mail do Mercado Pago ---- */}
      <Sheet open={tab === "email"} onOpenChange={(o) => !o && setTab(null)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-white/10 bg-[#0b0b10] p-0 text-white sm:max-w-md"
        >
          <div className="border-b border-white/[0.07] px-4 py-3">
            <TabHeader icon={Mail} title="E-mail do Mercado Pago" tone="violet" />
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <p className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              Informe o mesmo e-mail da sua conta do Mercado Pago. Se for outro, o Premium pode não
              liberar sozinho.
            </p>

            <div className="flex gap-2">
              <input
                className={field}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="voce@email.com"
              />
              <button
                onClick={handleSaveEmail}
                disabled={savingEmail}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
              >
                {savingEmail ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Salvar
              </button>
            </div>
            {emailMsg && (
              <p className={`text-xs ${emailMsg.type === "ok" ? "text-cyan-300" : "text-red-400"}`}>
                {emailMsg.text}
              </p>
            )}

            <p className="text-[11px] leading-relaxed text-gray-500">
              Opcional. O login continua pelo telefone
              {accountPhone ? ` (${accountPhone})` : ""}.
            </p>

            {!isPremium && (
              <button
                type="button"
                onClick={syncNow}
                disabled={syncing}
                className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
              >
                {syncing ? "Conferindo…" : "Já paguei — conferir agora"}
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ---- Aba: pedidos e detalhes ---- */}
      <Sheet open={tab === "detalhes"} onOpenChange={(o) => !o && setTab(null)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-white/10 bg-[#0b0b10] p-0 text-white sm:max-w-md"
        >
          <div className="border-b border-white/[0.07] px-4 py-3">
            <TabHeader icon={Gift} title="Pedidos e detalhes" tone="emerald" />
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {!isPremium && (
              <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-[11px] font-semibold text-gray-400">
                    Pedidos usados{" "}
                    <span className="font-black text-white">
                      <AnimatedCount value={used} />
                    </span>{" "}
                    de {limit}
                  </p>
                  <p
                    className={
                      "text-[11px] font-bold " +
                      (remaining <= 0
                        ? "text-red-400"
                        : remaining <= 2
                          ? "text-amber-300"
                          : "text-cyan-300")
                    }
                  >
                    {remaining > 0 ? `${remaining} restantes` : "cota esgotada"}
                  </p>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={
                      "h-full rounded-full transition-all duration-700 " +
                      (remaining <= 0
                        ? "bg-red-500"
                        : remaining <= 2
                          ? "bg-amber-500"
                          : "bg-gradient-to-r from-cyan-500 to-cyan-300")
                    }
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                {bonus > 0 && (
                  <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                    <Gift className="size-3.5" /> +{bonus} pedidos bônus neste mês
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-1.5">
              <InfoRow label="Restaurante" value={activeRestaurant?.name ?? "—"} />
              <InfoRow label="Status" value={isPremium ? "Premium" : "Gratuito"} />
              <InfoRow label="Limite gratuito" value={`${MONTHLY_FREE_LIMIT}/mês`} />
              <InfoRow
                label="Renovação"
                value={
                  status?.premiumExpiresAt
                    ? new Date(status.premiumExpiresAt).toLocaleDateString("pt-BR")
                    : "—"
                }
              />
            </div>

            {!isPremium && rewards.length > 0 && <RewardsProgress rewards={rewards} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Fallback: só quando o navegador bloqueia a nova aba do checkout */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="overflow-hidden border-white/10 bg-[#0e0e15] p-0 text-white sm:max-w-sm">
          <div className="relative p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-cyan-500/20 blur-3xl"
            />

            <div className="relative flex flex-col items-center text-center">
              <span className="grid size-14 place-items-center rounded-2xl border border-amber-400/30 bg-amber-500/10 shadow-[0_0_28px_rgba(251,191,36,0.25)]">
                <Crown className="size-7 text-amber-300" />
              </span>
              <DialogTitle className="mt-3 text-lg font-black tracking-tight text-white">
                Finalizar assinatura
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-gray-400">
                {ANNUAL_PRICE} · pedidos ilimitados por 1 ano.
              </DialogDescription>
            </div>

            <div className="relative mt-4 flex items-start gap-2.5 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] px-3.5 py-3 text-left">
              <QrCode className="mt-0.5 size-4 shrink-0 text-cyan-300" />
              <p className="text-[11px] leading-relaxed text-cyan-100/80">
                Seu navegador bloqueou a nova aba. Abra o Mercado Pago no botão abaixo ou copie o
                link e pague pelo celular.
              </p>
            </div>

            <div className="relative mt-4 flex flex-col gap-2">
              <Button
                onClick={() => {
                  const url = paymentLink || PAYMENT_LINK;
                  if (!url) {
                    toast.error("Gere o link novamente para abrir o checkout.");
                    return;
                  }
                  window.open(url, "_blank", "noopener,noreferrer");
                  setPaymentOpen(false);
                }}
                className="h-11 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-500 font-black text-black shadow-[0_10px_30px_rgba(6,182,212,0.3)] hover:from-cyan-300 hover:to-cyan-400"
              >
                <ExternalLink className="size-4" /> Abrir Mercado Pago
              </Button>
              <Button
                variant="outline"
                onClick={copyLink}
                className="h-11 rounded-full border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
              >
                <Copy className="size-4" /> Copiar link de pagamento
              </Button>
            </div>

            {currentEmail && (
              <p className="relative mt-4 flex items-center justify-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200/90">
                <ShieldCheck className="size-3.5 shrink-0" />
                Use o e-mail {currentEmail} no Mercado Pago.
              </p>
            )}
          </div>
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
