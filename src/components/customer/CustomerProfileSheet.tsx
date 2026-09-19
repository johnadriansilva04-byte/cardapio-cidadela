import { useEffect, useState } from "react";
import {
  X,
  User,
  Phone,
  Lock,
  LogOut,
  Loader2,
  Star,
  Gift,
  Check,
  Pencil,
  LoaderCircle,
  ShoppingBag,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCustomerProfile } from "@/modules/customer/useCustomerProfile";
import {
  isSupabaseConfigured,
  signInWithPhone,
  signUpWithPhone,
  signOut as authSignOut,
  updateProfileName,
} from "@/modules/supabase/auth";
import {
  claimGuestData,
  getRestaurantPromotions,
  redeemPromotion,
} from "@/modules/supabase/customer";
import { describePromotion, isRedeemable, type Promotion } from "@/lib/loyalty";
import { brl, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/types";

interface CustomerProfileSheetProps {
  accent: string;
  /** Slug do restaurante aberto — usado para listar as promoções dele. */
  slug: string;
  onClose: () => void;
  /** Abre a lista completa de pedidos (rota /meus-pedidos). */
  onOpenOrders: () => void;
  /** Notifica o cardápio que o usuário entrou ou saiu, para recarregar. */
  onAuthChange?: () => void;
}

type Mode = "login" | "register";

export default function CustomerProfileSheet({
  accent,
  slug,
  onClose,
  onOpenOrders,
  onAuthChange,
}: CustomerProfileSheetProps) {
  const { user, profile, isAuthenticated } = useAuth();
  const { orders, totalPoints, totalOrders, totalSpent, pointsToNext, reload } =
    useCustomerProfile();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const displayName = profile?.name || user?.email?.split("@")[0] || "Cliente";

  useEffect(() => {
    let alive = true;
    void (async () => {
      const list = await getRestaurantPromotions(slug);
      if (alive) setPromotions(list);
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  function notifyAuthChanged() {
    onAuthChange?.();
    void reload();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const digits = phone.replace(/\D/g, "");

    if (digits.length < 10) {
      setFormError("Informe um telefone válido com DDD");
      return;
    }
    if (password.length < 6) {
      setFormError("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setFormError("Informe seu nome");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { session, error } = await signInWithPhone(digits, password);
        if (error || !session) {
          setFormError(
            error?.message?.includes("Invalid login")
              ? "Telefone ou senha incorretos"
              : "Não foi possível entrar. Tente novamente.",
          );
          return;
        }
      } else {
        const { user: created, error } = await signUpWithPhone(digits, password, name.trim());
        if (error || !created) {
          setFormError(
            error?.message?.includes("already registered")
              ? "Este telefone já está cadastrado. Faça login."
              : "Não foi possível criar a conta.",
          );
          return;
        }
        const { session } = await signInWithPhone(digits, password);
        if (!session) {
          setMode("login");
          setFormError("Conta criada! Entre com sua senha.");
          return;
        }
      }

      // Traz pontos e pedidos feitos como convidado neste aparelho.
      const claimed = await claimGuestData();
      notifyAuthChanged();
      setFeedback(
        claimed.orders > 0 || claimed.points > 0
          ? {
              kind: "ok",
              text: `Bem-vindo! Trouxemos ${claimed.orders} pedido(s) e ${claimed.points} lançamento(s) do seu histórico.`,
            }
          : { kind: "ok", text: "Tudo certo! Sua conta está sincronizada." },
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await authSignOut();
    notifyAuthChanged();
    setFeedback({ kind: "ok", text: "Você saiu da conta. Seus pedidos continuam no histórico." });
  }

  async function handleSaveName() {
    const result = await updateProfileName(nameDraft);
    if (result.ok) {
      setEditingName(false);
      setFeedback({ kind: "ok", text: "Nome atualizado." });
      void reload();
    } else {
      setFeedback({ kind: "err", text: result.error ?? "Erro ao salvar." });
    }
  }

  async function handleRedeem(promo: Promotion) {
    setRedeeming(promo.id);
    setFeedback(null);
    const result = await redeemPromotion(promo.id);
    setRedeeming(null);
    if (result.ok) {
      setFeedback({
        kind: "ok",
        text: `Resgate feito! Você agora tem ${result.balance} SOV.`,
      });
      void reload();
    } else {
      setFeedback({ kind: "err", text: result.error ?? "Não foi possível resgatar." });
    }
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-white/30 focus:outline-none";

  if (!isSupabaseConfigured()) {
    return (
      <Sheet accent={accent} onClose={onClose} title="Sua conta">
        <p className="text-sm text-gray-400">
          A conta do cliente ainda não está disponível nesta instalação.
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet accent={accent} onClose={onClose} title={isAuthenticated ? "Seu perfil" : "Entrar"}>
      {feedback && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
            feedback.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
          role="status"
        >
          {feedback.kind === "ok" ? (
            <Check className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <X className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {isAuthenticated ? (
        <>
          {/* Cartão de identidade */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div
                className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-black text-white"
                style={{ backgroundColor: accent }}
              >
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <div className="flex gap-2">
                    <input
                      className={field}
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      autoFocus
                      aria-label="Nome"
                    />
                    <button
                      onClick={handleSaveName}
                      className="shrink-0 rounded-xl px-3 text-xs font-bold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      Salvar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-white">{displayName}</p>
                    <button
                      onClick={() => {
                        setNameDraft(profile?.name ?? "");
                        setEditingName(true);
                      }}
                      aria-label="Editar nome"
                      className="text-gray-500 transition-colors hover:text-white"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                )}
                <p className="truncate text-xs text-gray-500">{profile?.phone || user?.phone}</p>
              </div>
            </div>
          </div>

          {/* Resumo: SOV e pedidos */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat icon={Star} label="SOV" value={String(totalPoints)} accent={accent} />
            <Stat icon={ShoppingBag} label="Pedidos" value={String(totalOrders)} accent={accent} />
            <Stat icon={Gift} label="Gasto" value={brl(totalSpent)} accent={accent} />
          </div>

          <p className="mt-2 text-center text-[11px] text-gray-500">
            +{pointsToNext} reais e você ganha mais 1 ponto de soberania
          </p>

          {/* Promoções do restaurante */}
          {promotions.length > 0 && (
            <section className="mt-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
                <Sparkles className="size-3.5" style={{ color: accent }} />
                Promoções de {slug}
              </h3>
              <div className="space-y-2">
                {promotions.map((promo) => (
                  <div
                    key={promo.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{promo.title}</p>
                      <p className="text-[11px] text-gray-500">{describePromotion(promo)}</p>
                      {promo.description && (
                        <p className="mt-0.5 text-[11px] text-gray-500">{promo.description}</p>
                      )}
                    </div>
                    {isRedeemable(promo) && (
                      <button
                        onClick={() => handleRedeem(promo)}
                        disabled={redeeming === promo.id || totalPoints < promo.value}
                        aria-label={`Resgatar ${promo.title}`}
                        className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ backgroundColor: accent }}
                      >
                        {redeeming === promo.id ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          "Resgatar"
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Último pedido */}
          {orders[0] && (
            <section className="mt-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                Último pedido
              </h3>
              <button
                onClick={onOpenOrders}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:bg-white/[0.05]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {orders[0].comanda || "Pedido"} · {brl(orders[0].total)}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {ORDER_STATUS_LABELS[orders[0].status]} · {formatDate(orders[0].created_at)}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-gray-500" />
              </button>
            </section>
          )}

          {/* Ações de conta */}
          <div className="mt-5 space-y-2">
            <button
              onClick={onOpenOrders}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/5"
            >
              <ShoppingBag className="size-4" /> Ver todos os pedidos
            </button>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/10"
            >
              <LogOut className="size-4" /> Sair da conta
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Quem não quer conta continua pedindo como convidado */}
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-white">
              <User className="size-3.5" style={{ color: accent }} /> Entrar como convidado
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
              Você pode pedir sem criar conta. O histórico fica neste aparelho — entre na conta
              depois para levar tudo com você.
            </p>
            <button
              onClick={onClose}
              className="mt-2.5 w-full rounded-xl border border-white/10 py-2 text-xs font-bold text-white transition-colors hover:bg-white/5"
            >
              Continuar como convidado
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-400">Nome</span>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                  <input
                    className={`${field} pl-9`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                    autoComplete="name"
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-400">
                WhatsApp / Telefone
              </span>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                <input
                  className={`${field} pl-9`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-400">Senha</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                <input
                  className={`${field} pl-9`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </label>

            {formError && (
              <p className="text-xs text-red-300" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "login" ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setFormError("");
            }}
            className="mt-3 w-full text-center text-xs font-semibold text-gray-400 transition-colors hover:text-white"
          >
            {mode === "login" ? "Não tem conta? Criar agora" : "Já tenho conta"}
          </button>
        </>
      )}
    </Sheet>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Star;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-center">
      <Icon className="mx-auto size-4" style={{ color: accent }} />
      <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

/** Casca do painel: sobe como folha inferior no celular e centraliza no desktop. */
function Sheet({
  accent,
  title,
  onClose,
  children,
}: {
  accent: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0b0b12] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:rounded-3xl sm:border"
      >
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full"
          style={{ backgroundColor: `${accent}66` }}
        />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-8 place-items-center rounded-full text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
