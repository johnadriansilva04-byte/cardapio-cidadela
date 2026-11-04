import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Bike,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChefHat,
  Clock,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Minus,
  Palette,
  Plus,
  QrCode,
  ReceiptText,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  User,
  Users,
  UtensilsCrossed,
  X,
  BookOpen,
} from "lucide-react";
import { PREMIUM_PRICE_VALUE, DAY_PASS_PRICE_LABEL, DAY_PASS_PRICE_VALUE } from "@/lib/pricing";

import { brl, cn } from "@/lib/utils";
import { COMPANY, VARIANT, hasSupportContact } from "@/lib/company";
import { useAuth } from "@/components/AuthProvider";
import { switchAccount } from "@/modules/supabase/auth";
import {
  getLandingDemoStore,
  type DemoMenuItem,
  type DemoStoreMenu,
} from "@/modules/supabase/landing-demo";
import { SmartImage } from "@/components/ui/SmartImage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlanCards } from "@/modules/ui/PlanCards";
import { GuidePanel, GuideTile } from "@/modules/ui/GuidePanel";

/** Painéis do hub da landing. `null` = nenhum aberto. */
type LandingPanel = "calc" | "recursos" | "marca" | "pracinha" | "preco" | "variant" | "faq" | null;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cardápio Cidadela — Cardápio digital para micro-restaurantes" },
      {
        name: "description",
        content:
          "Cardápio digital com link próprio, QR Code e pedidos em tempo real. O cliente pede sozinho pelo celular — você só recebe. Sem comissão por pedido.",
      },
      { property: "og:title", content: "Cardápio Cidadela — Seu cardápio no ar em minutos" },
      {
        property: "og:description",
        content:
          "Feito para micro-restaurantes: link próprio, PIX e pedidos em tempo real. Sem comissão, sem app para instalar.",
      },
    ],
  }),
  component: LandingPage,
});

/* ============================================================
   Demo viva — o visitante monta um pedido de verdade na landing
   ============================================================ */

/**
 * Vitrine da landing = o cardápio REAL da loja da Variant.
 *
 * Os dados abaixo são só o SNAPSHOT da primeira pintura (evita tela vazia e
 * flash enquanto o banco responde). Em seguida o componente carrega a loja de
 * verdade e substitui tudo — trocar a foto, o preço ou um item no painel muda a
 * home sozinho. Se o banco falhar, o snapshot segura a página.
 */

const DEMO_SNAPSHOT: DemoStoreMenu = {
  name: "Variant",
  logoUrl:
    "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/logo_1789410322493_v0yxrp.jpg",
  categories: [
    { id: "lanches", name: "Lanches" },
    { id: "combos", name: "Combos" },
    { id: "bebidas", name: "Bebidas" },
  ],
  items: [
    {
      id: "s-xburger",
      categoryId: "lanches",
      name: "X-Burger",
      description: "Pão, hambúrguer, queijo, alface e tomate",
      price: 29.99,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1789411917034_401lra.jpg",
      tag: "Mais pedido",
    },
    {
      id: "s-xbacon",
      categoryId: "lanches",
      name: "X-Bacon",
      description: "Pão, hambúrguer, queijo, bacon crocante",
      price: 21.9,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1790975930471_3o9b3b.webp",
    },
    {
      id: "s-xtudo",
      categoryId: "lanches",
      name: "X-Tudo",
      description: "Hambúrguer duplo, queijo, bacon, ovo, presunto",
      price: 28.9,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1790976043341_1g2r69.webp",
    },
    {
      id: "s-frango",
      categoryId: "lanches",
      name: "Frango Grelhado",
      description: "Peito de frango grelhado com salada",
      price: 22.9,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1790976105381_3uc1ei.webp",
    },
    {
      id: "s-hotdog",
      categoryId: "lanches",
      name: "Hot Dog Especial",
      description: "Salsicha, purê, milho, batata palha",
      price: 16.9,
      imageUrl:
        "https://images.pracinha.online/8956f83c-f65e-41a1-b524-56c4434aa9a1/product_1790976129745_cf78jp.webp",
    },
    {
      id: "s-comboburger",
      categoryId: "combos",
      name: "Combo Burger + Refri",
      description: "X-Burger + Coca-Cola Lata",
      price: 22.9,
      emoji: "🍔",
    },
    {
      id: "s-combofome",
      categoryId: "combos",
      name: "Combo Fome Zero",
      description: "X-Bacon + Batata + Refri",
      price: 32.9,
      emoji: "🍔",
    },
    {
      id: "s-combofamilia",
      categoryId: "combos",
      name: "Combo Família",
      description: "2 X-Tudo + 2 Refris + Batata",
      price: 69.9,
      emoji: "🍔",
    },
    {
      id: "s-coca",
      categoryId: "bebidas",
      name: "Coca-Cola Lata",
      description: "350ml gelada",
      price: 5.9,
      emoji: "🥤",
    },
    {
      id: "s-guarana",
      categoryId: "bebidas",
      name: "Guaraná Lata",
      description: "350ml gelada",
      price: 5.9,
      emoji: "🥤",
    },
    {
      id: "s-suco",
      categoryId: "bebidas",
      name: "Suco Natural",
      description: "Laranja ou limão 400ml",
      price: 7.9,
      emoji: "🥤",
    },
    {
      id: "s-cerveja",
      categoryId: "bebidas",
      name: "Cerveja Lata",
      description: "Brahma ou Skol 350ml",
      price: 7.9,
      emoji: "🍺",
    },
    {
      id: "s-agua",
      categoryId: "bebidas",
      name: "Água Mineral",
      description: "500ml sem gás",
      price: 3.9,
      emoji: "💧",
    },
  ],
};

function LiveMenuDemo() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);
  // Começa no snapshot (pinta na hora) e é trocado pelo cardápio real assim que
  // o banco responde. A primeira aba é sempre a primeira categoria da loja.
  const [store, setStore] = useState<DemoStoreMenu>(DEMO_SNAPSHOT);
  const [activeCat, setActiveCat] = useState<string>(DEMO_SNAPSHOT.categories[0].id);

  useEffect(() => {
    let alive = true;
    getLandingDemoStore().then((real) => {
      if (!alive || !real) return;
      setStore(real);
      setActiveCat((prev) =>
        real.categories.some((c) => c.id === prev) ? prev : real.categories[0].id,
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  const items: DemoMenuItem[] = store.items;
  const visibleItems = useMemo(
    () => items.filter((i) => i.categoryId === activeCat),
    [items, activeCat],
  );

  const { count, total } = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const item of items) {
      const qty = cart[item.id] ?? 0;
      count += qty;
      total += qty * item.price;
    }
    return { count, total };
  }, [cart, items]);

  function add(id: string) {
    setSent(false);
    setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function remove(id: string) {
    setSent(false);
    setCart((prev) => {
      const next = { ...prev };
      if ((next[id] ?? 0) <= 1) delete next[id];
      else next[id] -= 1;
      return next;
    });
  }

  function send() {
    if (count === 0) return;
    setSent(true);
    setCart({});
  }

  return (
    <div className="relative mx-auto w-full max-w-[350px]">
      {/* Halo atrás do aparelho */}
      <div
        aria-hidden
        className="animate-aurora absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-cyan-500/25 via-blue-500/10 to-violet-500/20 blur-3xl"
      />

      <div className="relative rounded-[2.4rem] border border-white/10 bg-gradient-to-b from-[#14141d] to-[#0a0a10] p-2.5 shadow-[0_40px_90px_-25px_rgba(6,182,212,0.45)]">
        <div className="relative overflow-hidden rounded-[1.9rem] border border-white/[0.06] bg-[#0b0b12]">
          {/* Barra de status */}
          <div className="flex items-center justify-between px-4 pt-3 text-[10px] font-semibold text-gray-500">
            <span>9:41</span>
            <span className="h-1.5 w-16 rounded-full bg-white/10" />
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-400" /> 5G
            </span>
          </div>

          {/* Cabeçalho da loja */}
          <div className="relative mt-2 px-3">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/25 via-blue-500/10 to-violet-500/20 p-3">
              <div
                aria-hidden
                className="absolute -right-6 -top-8 size-24 rounded-full bg-cyan-400/30 blur-2xl"
              />
              <div className="relative flex items-center gap-2.5">
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#0b0b12] text-xl ring-1 ring-white/10">
                  {store.logoUrl ? (
                    <SmartImage
                      src={store.logoUrl}
                      alt={store.name}
                      width={88}
                      height={88}
                      className="size-full"
                      imgClassName="size-full object-cover"
                      eager
                      fallback={<span>🍔</span>}
                    />
                  ) : (
                    <span>🍔</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-black text-white">
                    {store.name} <BadgeCheck className="size-3.5 shrink-0 text-cyan-300" />
                  </p>
                  <p className="flex items-center gap-1.5 text-[10px] text-gray-300">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Aberto
                    agora
                    <span className="text-gray-600">•</span>
                    <Star className="size-3 fill-amber-300 text-amber-300" /> 4,9
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Categorias */}
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {store.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-colors",
                  activeCat === cat.id
                    ? "bg-cyan-500 text-black"
                    : "bg-white/[0.06] text-gray-400 hover:text-white",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Itens — área com altura fixa: o telefone não cresce com a
              categoria (o hub da landing precisa caber na tela). */}
          <div className="mt-2.5 max-h-[142px] space-y-2 overflow-y-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleItems.map((item) => {
              const qty = cart[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl border p-2 transition-all",
                    qty > 0
                      ? "border-cyan-500/40 bg-cyan-500/[0.07]"
                      : "border-white/[0.06] bg-white/[0.02]",
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.05] text-xl">
                    {item.imageUrl ? (
                      <SmartImage
                        src={item.imageUrl}
                        alt={item.name}
                        width={88}
                        height={88}
                        resize="cover"
                        className="size-full"
                        imgClassName="size-full object-cover"
                        fallback={<span>{item.emoji ?? "🍽️"}</span>}
                      />
                    ) : (
                      <span>{item.emoji ?? "🍽️"}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-xs font-bold text-white">
                      {item.name}
                      {item.tag && (
                        <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-300">
                          {item.tag}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[10px] text-gray-500">{item.description}</p>
                    <p className="text-[11px] font-black text-cyan-300">{brl(item.price)}</p>
                  </div>
                  {qty > 0 ? (
                    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => remove(item.id)}
                        className="grid size-6 place-items-center rounded-md text-gray-300 transition-colors hover:bg-white/10"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-black text-white">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Adicionar ${item.name}`}
                        onClick={() => add(item.id)}
                        className="grid size-6 place-items-center rounded-md bg-cyan-500 text-black transition-colors hover:bg-cyan-400"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Adicionar ${item.name}`}
                      onClick={() => add(item.id)}
                      className="grid size-8 shrink-0 place-items-center rounded-xl bg-cyan-500 text-black transition-transform hover:scale-110"
                    >
                      <Plus className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Carrinho */}
          <div className="mt-3 border-t border-white/[0.06] bg-black/40 px-3 pb-4 pt-3">
            {sent ? (
              <div className="animate-pop-in flex items-center gap-2.5 py-1">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <Check className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Pedido enviado!</p>
                  <p className="text-[11px] text-gray-400">
                    Chegou no painel do restaurante na hora.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>{count === 0 ? "Toque nos itens acima" : `${count} item(ns)`}</span>
                  <span className="text-base font-black text-white">{brl(total)}</span>
                </div>
                <button
                  type="button"
                  onClick={send}
                  disabled={count === 0}
                  className="sheen mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-500 py-2.5 text-xs font-black text-black transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="size-3.5" /> Enviar pedido
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-gray-500">
        É isto que seu cliente vê. Experimente. 👆
      </p>
    </div>
  );
}

/* ============================================================
   Simulador "quanto você está perdendo?"
   Uma pergunta provocadora, o dono informa o que paga hoje e o
   sistema recomenda o melhor plano + a economia no ano.
   ============================================================ */

/** Acima disso, o Premium anual fica mais barato que pagar diária todo dia. */
const DAY_PASS_BREAK_EVEN = Math.ceil(PREMIUM_PRICE_VALUE / 12 / DAY_PASS_PRICE_VALUE);

/** Valores iniciais do simulador — e do número que aparece no herói. */
const LOSS_DEFAULT_SPEND = 149;
const LOSS_DEFAULT_DAYS = 8;

/**
 * A conta da perda, isolada para o herói e o painel mostrarem o MESMO número.
 * O argumento da página é o número, não o adjetivo.
 */
function computeLossPlan(spend: number, days: number) {
  const monthlyPremium = PREMIUM_PRICE_VALUE / 12;
  const monthlyDayPass = days * DAY_PASS_PRICE_VALUE;
  const plan =
    days <= DAY_PASS_BREAK_EVEN
      ? {
          name: "Diária",
          cost: monthlyDayPass,
          why: `Você abre ~${days} dia(s) por mês. Na diária você paga só os dias que usar — ${DAY_PASS_PRICE_LABEL} por 24h.`,
          cta: "Comece grátis e ative a diária quando cair pedido",
        }
      : {
          name: "Premium anual",
          cost: monthlyPremium,
          why: `Com ${days} dias de movimento, o Premium ilimitado sai mais barato que pagar diária todo dia. Equivale a ${brl(monthlyPremium)}/mês.`,
          cta: "Comece grátis e assine o Premium quando quiser",
        };
  const monthlySaved = Math.max(0, spend - plan.cost);
  return { plan, monthlySaved, yearlySaved: monthlySaved * 12, payingNothing: spend <= 0 };
}

/** A conta do exemplo padrão, mostrada no herói antes de qualquer clique. */
const HERO_LOSS = computeLossPlan(LOSS_DEFAULT_SPEND, LOSS_DEFAULT_DAYS);

function LossCalculator() {
  const [spend, setSpend] = useState(LOSS_DEFAULT_SPEND);
  const [days, setDays] = useState(LOSS_DEFAULT_DAYS);
  const { plan, monthlySaved, yearlySaved, payingNothing } = useMemo(
    () => computeLossPlan(spend, days),
    [spend, days],
  );

  return (
    <div className="relative">
      <div className="relative">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-rose-300">
            <TrendingUp className="size-3.5" /> Faça a conta
          </span>
          <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Quer ver quanto de dinheiro você está perdendo?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-400">
            Diz quanto você paga por mês no cardápio de hoje. Em 5 segundos eu mostro o melhor plano
            pra você — e quanto sobra no seu bolso.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-[#0b0b12]/80 p-6 sm:p-8">
          {/* Pergunta 1 — a provocação */}
          <label className="block">
            <span className="text-sm font-bold text-white">
              Quanto você paga por mês no seu cardápio atual?
            </span>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 focus-within:border-cyan-400/60">
              <span className="font-display text-xl font-black text-gray-500">R$</span>
              <input
                type="number"
                min={0}
                max={5000}
                step={10}
                value={spend}
                onChange={(e) => {
                  setSpend(Math.max(0, Number(e.target.value) || 0));
                }}
                className="w-full bg-transparent font-display text-2xl font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Quanto você paga por mês no seu cardápio atual"
              />
            </div>
            <span className="mt-2 block text-xs text-gray-500">
              Pode ser app de entrega, sistema de PDV, planilha — o que você usa hoje.
            </span>
          </label>

          {/* Pergunta 2 — dias de movimento */}
          <label className="mt-7 block">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-white">
                Quantos dias por mês você abre a loja?
              </span>
              <span className="font-display text-xl font-black text-cyan-300">
                {days} {days === 1 ? "dia" : "dias"}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={days}
              onChange={(e) => {
                setDays(Number(e.target.value));
              }}
              className="mt-3 w-full accent-cyan-400"
              aria-label="Quantos dias por mês você abre a loja"
            />
          </label>

          <div className="animate-pop-in mt-7">
            {payingNothing ? (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-6 text-center">
                <p className="font-display text-xl font-black text-emerald-300">
                  Você já não paga nada hoje. 🎉
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  Então comece pelo plano grátis: 5 pedidos por mês, sem cartão. Quando o movimento
                  crescer, a diária ou o Premium entram sozinhos.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                      Você paga hoje
                    </p>
                    <p className="mt-2 font-display text-3xl font-black text-rose-300">
                      {brl(spend)}
                      <span className="text-sm font-bold text-gray-500"> /mês</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.08] p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                      Melhor plano pra você
                    </p>
                    <p className="mt-2 font-display text-3xl font-black text-white">{plan.name}</p>
                    <p className="text-sm font-bold text-gray-400">{brl(plan.cost)}/mês</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-6 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                    Você economiza
                  </p>
                  <p className="mt-1 font-display text-4xl font-black text-emerald-300">
                    {brl(yearlySaved)}
                    <span className="text-base font-bold text-gray-500"> /ano</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    {brl(monthlySaved)} por mês no seu bolso.
                  </p>
                </div>

                <p className="mt-4 text-center text-sm text-gray-400">{plan.why}</p>
              </>
            )}

            <Link
              to="/login"
              search={{ mode: "register" }}
              className="sheen mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 py-4 text-base font-black text-black transition-all hover:-translate-y-0.5 hover:bg-cyan-400 hover:shadow-[0_0_40px_rgba(34,211,238,0.45)]"
            >
              {plan.cta} <ArrowRight className="size-5" />
            </Link>
            <p className="mt-3 text-center text-xs text-gray-500">
              Comece já — abra sua conta grátis, sem cartão. Leva menos de 2 minutos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Variant — quem está por trás e por quê
   ============================================================ */

function VariantSection() {
  return (
    <div className="relative">
      <div className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-violet-300">
            <Store className="size-3.5" /> Quem faz
          </span>
          <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {VARIANT.name} existe por um motivo.
          </h2>
          <p className="mt-3 font-display text-lg font-bold text-violet-300">{VARIANT.tagline}</p>
          <p className="mt-5 text-sm leading-relaxed text-gray-400 sm:text-base">
            {VARIANT.mission}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {VARIANT.pillars.map((p) => (
            <div
              key={p.title}
              className="card-lift rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-300">
                <Check className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-white">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{p.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center">
          <p className="text-sm leading-relaxed text-gray-400">
            Cada loja que continua aberta é um fornecedor, um funcionário e uma família que não
            perdem a renda.{" "}
            <strong className="font-bold text-white">
              Reduzir a mortalidade das pequenas empresas não é slogan — é a razão de existir da{" "}
              {VARIANT.name}.
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Conteúdo da página
   ============================================================ */

const STEPS = [
  {
    icon: Smartphone,
    title: "Monte o cardápio",
    desc: "Itens, preços e categorias em minutos, direto do celular.",
  },
  {
    icon: QrCode,
    title: "Publique o link",
    desc: "Um endereço próprio e um QR Code para o salão e o status.",
  },
  {
    icon: BellRing,
    title: "Receba os pedidos",
    desc: "O cliente monta sozinho. A comanda chega pronta pra cozinha.",
  },
];

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Painel de gestão",
    desc: "Veja pedidos, faturamento e ticket médio do dia em uma tela só.",
  },
  {
    icon: BellRing,
    title: "Alerta de novo pedido",
    desc: "Som e notificação no celular na hora que o pedido cai. Não perde venda.",
  },
  {
    icon: Palette,
    title: "Sua identidade",
    desc: "Logo, banner e cores da sua marca. Nada de cara de app de terceiro.",
  },
  {
    icon: Bike,
    title: "Entrega com taxa",
    desc: "Taxa por bairro ou fixa. Endereço e troco direto na comanda.",
  },
  {
    icon: Clock,
    title: "Horário de funcionamento",
    desc: "Abre e fecha sozinho pelo seu horário. O cliente sabe na hora.",
  },
  {
    icon: ShieldCheck,
    title: "Sem comissão",
    desc: "O que o cliente paga é seu. Aqui não tem 15–30% por pedido.",
  },
  {
    icon: MessageCircle,
    title: "Suporte Pracinha",
    desc: "Assistente do time da Variant que responde na hora e leva o problema pro dev.",
  },
];

const COMPARISON = [
  { label: "Comissão por pedido", us: "0%", them: "15–30%" },
  { label: "Mensalidade fixa", us: "Começa grátis", them: "Alta e obrigatória" },
  { label: "Paga só quando vender", us: "Sim, na diária", them: "Não" },
  { label: "Link e marca próprios", us: "Sim", them: "Fica no app deles" },
  { label: "Precisa instalar app", us: "Não", them: "Cliente baixa o app" },
];

const FAQ = [
  {
    q: "Preciso pagar para começar?",
    a: "Não. Você começa grátis, com 5 pedidos por mês. Sem cartão, sem contrato. Só paga quando o movimento pedir.",
  },
  {
    q: "Como funciona a diária?",
    a: "Você compra 24h de acesso liberado. Abre só no fim de semana? Usa a diária só nesses dias e paga menos. E é empilhável: compra quantas quiser.",
  },
  {
    q: "O cardápio trava se eu não pagar?",
    a: "Nunca. Mesmo sem pedidos grátis, seu cliente sempre consegue pedir. O pedido chega com nome, preço e endereço — a venda não se perde.",
  },
  {
    q: "Preciso de app ou site próprio?",
    a: "Não. Seu cardápio ganha um link próprio e um QR Code. Coloca no status, na bio ou no balcão e já está no ar.",
  },
  {
    q: "Se der problema, com quem eu falo?",
    a: "Com o Pracinha, o suporte do time da Variant, dentro do próprio painel. Ele responde na hora e, se for algo técnico, leva o caso direto para a engenharia com o contexto da sua tela — você não precisa explicar o erro.",
  },
];

const TUTORIAL_STEPS = [
  {
    title: "Comece grátis",
    content:
      "Crie sua conta sem cartão. 5 pedidos por mês de graça. Se não tiver movimento, não paga nada.",
  },
  {
    title: "Monte seu cardápio",
    content: "Adicione fotos, preços e categorias. Do celular mesmo, igual postar no Instagram.",
  },
  {
    title: "Publique o link",
    content: "Um link só seu e um QR Code. Coloca no status, na bio, no balcão.",
  },
  {
    title: "Pague só quando usar",
    content:
      "Depois de 5 pedidos grátis, usa diária de " +
      DAY_PASS_PRICE_LABEL +
      " por 24h só quando cair pedido. Ou assina Premium se tiver movimento constante.",
  },
  {
    title: "Personalize tudo",
    content: "Logo, banner, cores da marca. Seu cardápio, 100% à sua cara.",
  },
];

/* ============================================================
   Demo do Pracinha — o suporte que responde e resolve
   Respostas pré-escritas: é vitrine, não chama a IA nem o backend.
   ============================================================ */

const PRACINHA_SCRIPT: { q: string; a: string }[] = [
  {
    q: "Como coloco meu cardápio no ar?",
    a: "Você cria a conta grátis, adiciona os itens com foto e preço e publica. Sai um link só seu e um QR Code pra pôr no status e no balcão. Leva uns 5 minutos.",
  },
  {
    q: "Meus pedidos não estão chegando",
    a: "Já entendi. Vou verificar o alerta e a conexão da sua loja e, se não resolver, passo direto pro time de engenharia da Variant com o contexto da sua tela.",
  },
  {
    q: "Quanto custa?",
    a: "Você começa grátis com 5 pedidos por mês. Depois é a diária de R$ 1,99 por 24h, só quando cair pedido, ou o Premium ilimitado por R$ 28,99/mês (R$ 199,99/ano).",
  },
  {
    q: "Deu erro na tela de pedidos",
    a: "Obrigado por avisar. Capturei o erro com a página e o horário e enviei pro time com tudo que o dev precisa pra corrigir. Fico te avisando por aqui.",
  },
];

function PracinhaDemo() {
  const [asked, setAsked] = useState<number[]>([]);
  const active = asked[asked.length - 1];

  return (
    <div className="relative mx-auto w-full max-w-[350px]">
      <div
        aria-hidden
        className="animate-aurora absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-cyan-500/25 via-blue-500/10 to-violet-500/20 blur-3xl"
      />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#14141d] to-[#0a0a10] p-2.5 shadow-[0_40px_90px_-25px_rgba(6,182,212,0.45)]">
        <div className="overflow-hidden rounded-[1.6rem] border border-white/[0.06] bg-[#0b0b12]">
          {/* Cabeçalho */}
          <div className="relative border-b border-white/[0.07] px-4 py-3.5">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-cyan-500/20 blur-3xl"
            />
            <div className="relative flex items-center gap-2.5">
              <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-black shadow-[0_8px_24px_rgba(6,182,212,0.35)]">
                <MessageCircle className="size-4" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#0b0b12] bg-emerald-400" />
              </span>
              <div>
                <p className="text-xs font-bold text-white">
                  Pracinha <span className="font-normal text-gray-500">· Variant</span>
                </p>
                <p className="flex items-center gap-1 text-[10px] text-cyan-300/80">
                  <ShieldCheck className="size-2.5" /> Suporte oficial · resposta na hora
                </p>
              </div>
            </div>
          </div>

          {/* Conversa */}
          <div className="space-y-2.5 px-3 py-3.5">
            {active === undefined ? (
              <p className="text-xs leading-relaxed text-gray-400">
                Oi! Sou o Pracinha, do time da Variant. Toca numa pergunta que eu mostro como
                respondo.
              </p>
            ) : (
              <>
                <div className="flex flex-row-reverse items-start gap-2">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-gray-300">
                    <User className="size-3" />
                  </span>
                  <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-cyan-500 px-3 py-2 text-[11px] leading-relaxed text-black">
                    {PRACINHA_SCRIPT[active].q}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-cyan-300">
                    <Bot className="size-3" />
                  </span>
                  <p className="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-[11px] leading-relaxed text-gray-200">
                    {PRACINHA_SCRIPT[active].a}
                  </p>
                </div>
                {active === 1 || active === 3 ? (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-2 text-[10px] text-emerald-200">
                    <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                    <span>Relato enviado para a engenharia da Variant com o contexto da tela.</span>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* Perguntas */}
          <div className="flex flex-wrap gap-1.5 border-t border-white/[0.07] px-3 py-3">
            {PRACINHA_SCRIPT.map((s, i) => (
              <button
                key={s.q}
                type="button"
                onClick={() => setAsked((prev) => [...prev.filter((x) => x !== i), i])}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                  active === i
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-cyan-400/40 hover:text-white",
                )}
              >
                {s.q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return { animationDelay: `${ms}ms` };
}

/**
 * Conta na navbar da landing.
 *
 * Antes a home mostrava "Entrar / Criar grátis" mesmo com sessão ativa, e quem
 * já estava logado (inclusive no PWA instalado) não tinha como sair ou trocar
 * de conta sem fechar o app. Aqui o estado fica explícito.
 */
function NavAccount({ className }: { className?: string }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login", replace: true });
  }

  async function handleSwitch() {
    await switchAccount("/admin");
  }

  if (loading) {
    return <span className={cn("h-9 w-24 animate-pulse rounded-full bg-white/5", className)} />;
  }

  if (!user) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Link to="/login" className="text-sm text-gray-300 transition-colors hover:text-white">
          Entrar
        </Link>
        <Link
          to="/login"
          search={{ mode: "register" }}
          className="sheen rounded-full bg-cyan-500 px-5 py-2 text-sm font-bold text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]"
        >
          Criar grátis
        </Link>
      </div>
    );
  }

  const label = (user.user_metadata?.name as string) || user.email || user.phone || "Minha conta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/[0.08]">
        <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[10px] font-black text-black">
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[110px] truncate">{label}</span>
        <ChevronDown className="size-3.5 text-gray-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[190px] border-white/10 bg-[#14141d] text-gray-200"
      >
        <DropdownMenuItem
          onSelect={() => navigate({ to: "/admin" })}
          className="cursor-pointer gap-2.5 py-2 text-sm focus:bg-white/[0.06] focus:text-white"
        >
          <LayoutDashboard className="size-4 text-cyan-400" /> Meu painel
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => navigate({ to: "/meus-pedidos", search: { from: "" } })}
          className="cursor-pointer gap-2.5 py-2 text-sm focus:bg-white/[0.06] focus:text-white"
        >
          <ReceiptText className="size-4 text-gray-400" /> Meus pedidos
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/[0.08]" />
        <DropdownMenuItem
          onSelect={handleSwitch}
          className="cursor-pointer gap-2.5 py-2 text-sm focus:bg-white/[0.06] focus:text-white"
        >
          <Users className="size-4 text-gray-400" /> Trocar de conta
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleSignOut}
          className="cursor-pointer gap-2.5 py-2 text-sm text-red-400 focus:bg-red-500/10 focus:text-red-300"
        >
          <LogOut className="size-4" /> Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  // Hub de uma tela: cada assunto abre num painel por cima (X para fechar), em
  // vez de empilhar seções numa rolagem longa. A página em si não cresce.
  const [panel, setPanel] = useState<LandingPanel>(null);

  function openPanel(p: NonNullable<LandingPanel>) {
    setMenuOpen(false);
    setPanel(p);
  }
  const closePanel = () => setPanel(null);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#07070c] text-white selection:bg-cyan-400/30">
      {/* Fundo aurora fixo (não conta para o scroll) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/15 blur-[130px]" />
        <div className="animate-aurora absolute -left-24 top-1/3 h-[360px] w-[360px] rounded-full bg-violet-600/10 blur-[110px] [animation-delay:3s]" />
        <div className="animate-aurora absolute -right-24 bottom-0 h-[340px] w-[440px] rounded-full bg-blue-500/10 blur-[120px] [animation-delay:6s]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070c]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-transform group-hover:scale-105">
              <UtensilsCrossed className="size-4 text-black" />
            </span>
            <span className="font-display text-base font-extrabold tracking-tight">
              Cardápio <span className="text-cyan-400">Cidadela</span>
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <button
              onClick={() => openPanel("recursos")}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Recursos
            </button>
            <button
              onClick={() => openPanel("preco")}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Preços
            </button>
            <button
              onClick={() => openPanel("calc")}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Economia
            </button>
            <button
              onClick={() => openPanel("variant")}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Quem faz
            </button>
            <a
              href="/cardapio/dona-da-pensao"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Ver cardápio
            </a>
            <button
              onClick={() => setTutorialOpen(true)}
              className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
            >
              <BookOpen className="size-4" /> Tutorial
            </button>
            <NavAccount />
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <NavAccount />
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-400"
              aria-label="Menu"
            >
              {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="grid grid-cols-2 gap-1 border-t border-white/10 px-4 py-4 md:hidden">
            {(
              [
                ["recursos", "Recursos"],
                ["preco", "Preços"],
                ["calc", "Economia"],
                ["variant", "Quem faz"],
                ["faq", "Dúvidas"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => openPanel(key)}
                className="rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white"
              >
                {label}
              </button>
            ))}
            <a
              href="/cardapio/dona-da-pensao"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white"
            >
              Ver cardápio real
            </a>
            <button
              onClick={() => {
                setMenuOpen(false);
                setTutorialOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white"
            >
              <BookOpen className="size-4" /> Tutorial
            </button>
          </div>
        )}
      </nav>

      {/* Hero + hub — tudo cabe numa tela; o resto abre em painel */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-5 px-4 py-5 sm:px-6">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="text-center lg:text-left">
            <p
              className="animate-reveal mb-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300"
              style={delay(0)}
            >
              <Sparkles className="size-3.5" /> Para micro-restaurantes
            </p>

            <h1
              className="animate-reveal font-display text-[2.1rem] font-extrabold leading-[1.05] tracking-tight sm:text-[2.5rem] lg:text-[2.5rem]"
              style={delay(80)}
            >
              Seu cardápio no ar
              <br />
              em minutos.
              <br />
              <span className="text-shine bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
                Pague só quando vender.
              </span>
            </h1>

            <p
              className="animate-reveal mx-auto mt-4 max-w-lg text-sm leading-relaxed text-gray-300 sm:text-base lg:mx-0"
              style={delay(160)}
            >
              Link próprio, QR Code e pedidos em tempo real. O cliente pede pelo celular, você só
              recebe — <strong className="font-bold text-white">sem comissão por pedido</strong>.
            </p>

            <div
              className="animate-reveal mt-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start"
              style={delay(240)}
            >
              <Link
                to="/login"
                search={{ mode: "register" }}
                className="sheen group flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 py-3.5 text-sm font-bold text-black transition-all hover:-translate-y-0.5 hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] sm:w-auto"
              >
                Criar meu cardápio grátis
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="/cardapio/dona-da-pensao"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-gray-300 transition-all hover:border-white/30 hover:text-white sm:w-auto"
              >
                Ver cardápio real
              </a>
            </div>

            <div
              className="animate-reveal mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-gray-500 lg:justify-start"
              style={delay(320)}
            >
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Comece grátis · 5 pedidos/mês
              </span>
              <span className="hidden text-gray-700 sm:inline">•</span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Sem cartão
              </span>
              <span className="hidden text-gray-700 sm:inline">•</span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Sem comissão
              </span>
            </div>

            {/* O número na cara: a conta do exemplo padrão já aparece aqui, sem
                clique. Quem quiser refinar abre o painel. */}
            <button
              type="button"
              onClick={() => openPanel("calc")}
              className="animate-reveal group mt-5 flex w-full items-center gap-3 rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/[0.14] to-transparent p-4 text-left transition-colors hover:border-rose-400/60 lg:max-w-md"
              style={delay(400)}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
                <TrendingUp className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-widest text-rose-300/80">
                  Quanto você está perdendo? Ex.: pagando {brl(LOSS_DEFAULT_SPEND)}/mês
                </span>
                <span className="mt-0.5 block font-display text-lg font-black leading-tight text-white">
                  {brl(HERO_LOSS.yearlySaved)}
                  <span className="text-xs font-bold text-gray-400"> /ano no seu bolso</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-500 px-3 py-1.5 text-[11px] font-black text-white transition-colors group-hover:bg-rose-400">
                Fazer a conta <ArrowRight className="size-3" />
              </span>
            </button>
          </div>

          <div className="animate-reveal mx-auto w-full max-w-md lg:max-w-none" style={delay(200)}>
            <LiveMenuDemo />
          </div>
        </div>

        {/* Atalhos do hub: cada um abre um painel por cima. */}
        <div
          className="animate-reveal grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          style={delay(320)}
        >
          <GuideTile
            icon={<Sparkles className="size-4" />}
            title="Recursos"
            hint="O que tem dentro"
            tone="cyan"
            onClick={() => openPanel("recursos")}
          />
          <GuideTile
            icon={<Palette className="size-4" />}
            title="Sua marca"
            hint="Logo e cores"
            tone="violet"
            onClick={() => openPanel("marca")}
          />
          <GuideTile
            icon={<MessageCircle className="size-4" />}
            title="Pracinha"
            hint="Suporte na hora"
            tone="cyan"
            onClick={() => openPanel("pracinha")}
          />
          <GuideTile
            icon={<ReceiptText className="size-4" />}
            title="Preços"
            hint="Grátis ou Premium"
            tone="emerald"
            onClick={() => openPanel("preco")}
          />
          <GuideTile
            icon={<Store className="size-4" />}
            title="Quem faz"
            hint="A Variant"
            tone="violet"
            onClick={() => openPanel("variant")}
          />
          <GuideTile
            icon={<BookOpen className="size-4" />}
            title="Dúvidas"
            hint="Perguntas frequentes"
            tone="amber"
            onClick={() => openPanel("faq")}
          />
        </div>
      </main>

      {/* Rodapé compacto */}
      <footer className="relative z-10 border-t border-white/[0.07] py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600">
              <UtensilsCrossed className="size-3.5 text-black" />
            </span>
            <span className="font-display text-sm font-extrabold text-gray-300">
              Cardápio <span className="text-cyan-400">Cidadela</span>
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-500">
            <Link to="/terms" className="transition-colors hover:text-gray-300">
              Termos
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-gray-300">
              Privacidade
            </Link>
            {hasSupportContact && (
              <a
                href={
                  COMPANY.supportEmail
                    ? `mailto:${COMPANY.supportEmail}`
                    : `https://wa.me/${COMPANY.supportPhone}`
                }
                className="transition-colors hover:text-gray-300"
              >
                Suporte
              </a>
            )}
          </div>
          <p className="text-center text-[10px] text-gray-600 sm:text-right">
            © {new Date().getFullYear()} {COMPANY.brandName} · {COMPANY.legalName} · CNPJ{" "}
            {COMPANY.cnpj}
          </p>
        </div>
      </footer>

      {/* ---- Painéis (abrem por cima, com X para fechar) ---- */}

      <GuidePanel
        open={panel === "calc"}
        onOpenChange={(o) => !o && closePanel()}
        title="Quanto você está perdendo?"
        icon={<TrendingUp className="size-4" />}
        tone="amber"
        width="lg"
      >
        <LossCalculator />
      </GuidePanel>

      <GuidePanel
        open={panel === "recursos"}
        onOpenChange={(o) => !o && closePanel()}
        title="Tudo que sua operação precisa"
        icon={<Sparkles className="size-4" />}
        width="lg"
        description="Do zero ao primeiro pedido, sem painel complicado"
      >
        <div className="space-y-7">
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
              >
                <span className="grid size-10 place-items-center rounded-xl border border-cyan-500/25 bg-[#0b0b12] text-cyan-300">
                  <s.icon className="size-5" />
                </span>
                <h3 className="font-display mt-3 text-base font-extrabold text-white">
                  <span className="mr-1.5 text-cyan-400">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
                  <f.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <div className="px-4 py-3">Comparação</div>
              <div className="flex items-center gap-1.5 px-4 py-3 text-cyan-300">
                <UtensilsCrossed className="size-3.5" /> Cidadela
              </div>
              <div className="px-4 py-3">Apps de entrega</div>
            </div>
            {COMPARISON.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-white/[0.05] text-sm last:border-0"
              >
                <div className="px-4 py-3 text-gray-300">{row.label}</div>
                <div className="flex items-center gap-1.5 px-4 py-3 font-bold text-emerald-300">
                  <Check className="size-4 shrink-0" /> {row.us}
                </div>
                <div className="px-4 py-3 text-gray-500">{row.them}</div>
              </div>
            ))}
          </div>
        </div>
      </GuidePanel>

      <GuidePanel
        open={panel === "marca"}
        onOpenChange={(o) => !o && closePanel()}
        title="Sua marca, sua cara"
        icon={<Palette className="size-4" />}
        tone="violet"
        description="Logo, banner e as cores da sua marca"
      >
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-gray-400">
            O cliente sabe que está no seu negócio, não num app de terceiro.
          </p>
          <ul className="space-y-2">
            {[
              "Cor primária e secundária da marca",
              "Logo e banner personalizados",
              "Descrição e preço em cada item",
              "Link próprio com o nome do seu restaurante",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="mt-0.5 size-4 shrink-0 text-cyan-400" /> {t}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: "🍕", name: "Pizza da casa", price: "R$ 42,00", tone: "from-orange-500/20" },
              {
                emoji: "🥗",
                name: "Salada caesar",
                price: "R$ 24,00",
                tone: "from-emerald-500/20",
              },
              { emoji: "🍣", name: "Combinado 20", price: "R$ 58,00", tone: "from-rose-500/20" },
              { emoji: "🍰", name: "Fatia de bolo", price: "R$ 14,00", tone: "from-pink-500/20" },
            ].map((p) => (
              <div
                key={p.name}
                className={cn(
                  "overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b to-transparent",
                  p.tone,
                )}
              >
                <div className="grid h-20 place-items-center text-4xl">{p.emoji}</div>
                <div className="border-t border-white/[0.06] bg-[#0b0b12]/80 px-3 py-2">
                  <p className="truncate text-xs font-bold text-white">{p.name}</p>
                  <p className="text-xs font-black text-cyan-300">{p.price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </GuidePanel>

      <GuidePanel
        open={panel === "pracinha"}
        onOpenChange={(o) => !o && closePanel()}
        title="Conheça o Pracinha"
        icon={<MessageCircle className="size-4" />}
        width="xl"
        description="O suporte do time da Variant, dentro do painel"
      >
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="text-sm leading-relaxed text-gray-400 sm:text-base">
              O nome é uma homenagem aos pracinhas da FEB — brasileiros que foram à Itália em 1945 e
              voltaram com a missão cumprida. É esse o espírito: resolver, não transferir.
            </p>
            <ul className="mt-5 space-y-3">
              {[
                "Responde na hora, dentro do próprio painel",
                "Se o problema for técnico, vai direto para a engenharia da Variant",
                "Vai com o contexto da sua tela — você não precisa explicar o erro",
                "Avisa por e-mail para o time não perder nenhum caso",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <Check className="mt-0.5 size-4 shrink-0 text-cyan-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <PracinhaDemo />
        </div>
      </GuidePanel>

      <GuidePanel
        open={panel === "preco"}
        onOpenChange={(o) => !o && closePanel()}
        title="Escolha como pagar"
        icon={<ReceiptText className="size-4" />}
        tone="emerald"
        width="xl"
        description="Grátis para sempre · pague só quando tiver pedido"
      >
        <div className="space-y-5">
          <PlanCards
            className="grid gap-4 sm:grid-cols-3"
            renderCta={(plan) =>
              plan.key === "free" ? (
                <Link
                  to="/login"
                  search={{ mode: "register" }}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 py-3 text-sm font-bold text-white transition-colors hover:bg-white/[0.06]"
                >
                  {plan.ctaLabel}
                </Link>
              ) : (
                <a
                  href="/login?returnTo=/admin/assinatura"
                  className={
                    "flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold text-black transition-all " +
                    (plan.key === "annual"
                      ? "sheen bg-cyan-500 hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
                      : "bg-white/90 hover:bg-white")
                  }
                >
                  {plan.ctaLabel} <ArrowRight className="size-4" />
                </a>
              )
            }
          />

          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:flex-row">
            <p className="text-sm text-amber-100/90">
              <span className="font-bold text-amber-300">Diária {DAY_PASS_PRICE_LABEL}</span> · abre
              só quando tem movimento? Libera tudo por 24h, paga só os dias que usar e empilha.
            </p>
            <a
              href="/login?returnTo=/admin/assinatura"
              className="shrink-0 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-black transition-all hover:bg-amber-400"
            >
              Usar diária
            </a>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-300">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h4 className="mb-1.5 text-base font-bold text-white">Cardápio nunca trava</h4>
                <p className="text-sm leading-relaxed text-gray-400">
                  Mesmo com 0 pedidos grátis, seu cliente SEMPRE consegue pedir. O pedido chega com
                  preço, endereço e nome. Se quiser ver os itens, usa a diária. Não trava venda, não
                  perde cliente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </GuidePanel>

      <GuidePanel
        open={panel === "variant"}
        onOpenChange={(o) => !o && closePanel()}
        title="Quem faz"
        icon={<Store className="size-4" />}
        tone="violet"
        width="lg"
      >
        <VariantSection />
      </GuidePanel>

      <GuidePanel
        open={panel === "faq"}
        onOpenChange={(o) => !o && closePanel()}
        title="Perguntas frequentes"
        icon={<BookOpen className="size-4" />}
        tone="amber"
        width="md"
      >
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 open:bg-white/[0.04]"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-bold text-white marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus className="size-4 shrink-0 text-cyan-400 transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">{item.a}</p>
            </details>
          ))}
        </div>
      </GuidePanel>

      {/* Tutorial Modal */}
      <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <BookOpen className="size-5 text-cyan-400" />
            Como funciona
          </DialogTitle>
          <div className="mt-4">
            <div className="mb-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">
                Passo {tutorialStep + 1} de {TUTORIAL_STEPS.length}
              </p>
              <h3 className="mb-2 text-xl font-bold text-white">
                {TUTORIAL_STEPS[tutorialStep].title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-400">
                {TUTORIAL_STEPS[tutorialStep].content}
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              {tutorialStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTutorialStep(tutorialStep - 1)}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Anterior
                </Button>
              )}
              {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                <Button
                  onClick={() => setTutorialStep(tutorialStep + 1)}
                  className="flex-1 bg-cyan-500 text-black hover:bg-cyan-400"
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setTutorialOpen(false);
                    setTutorialStep(0);
                  }}
                  className="flex-1 bg-cyan-500 text-black hover:bg-cyan-400"
                >
                  Entendi!
                </Button>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-1">
              {TUTORIAL_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTutorialStep(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === tutorialStep ? "w-6 bg-cyan-400" : "w-1.5 bg-white/20"
                  }`}
                  aria-label={`Ir para passo ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LandingPage;
