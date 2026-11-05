import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Bike,
  BookOpen,
  Bot,
  Check,
  ChefHat,
  ChevronDown,
  Clock,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  MessageCircle,
  Palette,
  Plus,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { PREMIUM_PRICE_VALUE, DAY_PASS_PRICE_LABEL, DAY_PASS_PRICE_VALUE } from "@/lib/pricing";

import { brl, cn } from "@/lib/utils";
import { COMPANY, VARIANT, hasSupportContact } from "@/lib/company";
import { SITE_URL } from "@/lib/site";
import { DEMO_STORE_SLUG } from "@/modules/supabase/landing-demo";
import { useAuth } from "@/components/AuthProvider";
import { switchAccount } from "@/modules/supabase/auth";
import { SmartImage } from "@/components/ui/SmartImage";
import { DEMO_SNAPSHOT } from "@/components/landing/landing-data";
import { LiveStoreDemo } from "@/components/landing/LiveStoreDemo";
import { WaiterChat } from "@/components/landing/WaiterChat";
import { WizardChat } from "@/components/landing/WizardChat";
import { TemplateGallery } from "@/components/landing/TemplateGallery";
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
import { GuidePanel } from "@/modules/ui/GuidePanel";
import { VariantMark } from "@/components/brand/VariantMark";

/** Painéis do hub da landing. `null` = nenhum aberto. */
type LandingPanel = "calc" | "preco" | "faq" | "features" | null;

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
   Cardápio real — link direto
   Nada de mockup na página. O botão manda o visitante para o
   cardápio de verdade (a mesma URL que o cliente da loja abre).
   ============================================================ */

function MenuReveal() {
  const realMenuUrl = `${SITE_URL}/cardapio/${DEMO_STORE_SLUG}`;
  return (
    <div className="mx-auto w-full max-w-md text-center">
      <a
        href={realMenuUrl}
        target="_blank"
        rel="noreferrer"
        className="sheen group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-6 py-4 text-base font-black text-black shadow-[0_20px_50px_-20px_rgba(34,211,238,0.7)] transition-all hover:-translate-y-0.5 hover:bg-cyan-400"
      >
        Abrir o cardápio real
        <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
      </a>
      <p className="mt-3 text-[11px] text-gray-500">
        Abre em outra aba — é o cardápio de verdade, do lado de cá.
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

/** Valores iniciais do simulador — R$ 59,00 como solicitado. */
const LOSS_DEFAULT_SPEND = 59;
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

/**
 * Simulador compacto do herói — OCULTO POR PADRÃO.
 *
 * O visitante primeiro entende o produto. Depois, se quiser, calcula economia.
 */
function InlineSimulator({ onOpenFull }: { onOpenFull: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [spend, setSpend] = useState(LOSS_DEFAULT_SPEND);
  const [days, setDays] = useState(LOSS_DEFAULT_DAYS);
  const { plan, yearlySaved, payingNothing } = useMemo(
    () => computeLossPlan(spend, days),
    [spend, days],
  );

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="group inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/[0.06] px-4 py-2 text-xs font-bold text-rose-200 transition-all hover:bg-rose-500/15 hover:text-white"
      >
        <TrendingUp className="size-3.5" />
        Calcular minha economia
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300">
          <TrendingUp className="size-3" /> Simulador de economia
        </span>
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="text-[10px] text-gray-500 hover:text-white"
        >
          <X className="size-3" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex-1">
          <span className="block text-[10px] text-gray-400">Paga hoje (R$/mês)</span>
          <div className="mt-1 flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 focus-within:border-rose-400/60">
            <span className="text-xs font-bold text-gray-500">R$</span>
            <input
              type="number"
              min={0}
              max={5000}
              step={10}
              value={spend}
              onChange={(e) => setSpend(Math.max(0, Number(e.target.value) || 0))}
              aria-label="Quanto você paga por mês hoje"
              className="w-full bg-transparent font-display text-sm font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </label>
        <label className="flex-1">
          <span className="flex items-center justify-between text-[10px] text-gray-400">
            Abre por mês <b className="text-cyan-300">{days} dias</b>
          </span>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Quantos dias por mês você abre"
            className="mt-2 w-full accent-cyan-400"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">
            {payingNothing ? "Sua economia" : "Economia estimada"}
          </p>
          <p className="font-display text-lg font-black leading-none text-emerald-300">
            {brl(yearlySaved)}
            <span className="text-[11px] font-bold text-gray-500">/ano</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFull}
          className="rounded-full border border-rose-400/40 px-3 py-1.5 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-500/15 hover:text-white"
        >
          {plan.name} é o seu plano →
        </button>
      </div>
    </div>
  );
}

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

            <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <div className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <div className="px-4 py-3">Por que sai mais barato</div>
                <div className="flex items-center gap-1.5 px-4 py-3 text-cyan-300">
                  <UtensilsCrossed className="size-3.5" /> Cidadela
                </div>
                <div className="px-4 py-3">App de entrega</div>
              </div>
              {COMPARISON.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-white/[0.05] text-sm last:border-0"
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
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Monte a loja conversando (chat + IA) — SEÇÃO VISÍVEL
   O wizard de criação e o garçom digital são o que vende o produto.
   Antes viviam em abas ("Montagem"/"Pracinha") que ninguém abria.
   ============================================================ */

const CHAT_HIGHLIGHTS = [
  "Uma pergunta por vez, do jeito que o dono fala",
  "Monta itens, preços e categorias enquanto você responde",
  "Importa o cardápio antigo por foto",
  "Funciona no celular, na correria do balcão",
];

const WAITER_HIGHLIGHTS = [
  "Responde na hora, dentro do próprio painel",
  "Vai com o contexto da sua tela — sem print",
  "Se for técnico, cai direto na engenharia da Variant",
  "Avisa por e-mail para o time não perder nenhum caso",
];

function ChatAiSection() {
  return (
    <section id="chat" className="mt-14 scroll-mt-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-violet-300">
          <MessageCircle className="size-3.5" /> Monte a loja conversando
        </span>
        <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Você não preenche formulário. <span className="text-violet-300">Você conversa.</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-400 sm:text-base">
          A Pracinha pergunta o nome, o WhatsApp e o endereço — e o cardápio se monta sozinho.
          Depois ela fica no painel como seu garçom digital, respondendo na hora.
        </p>
      </div>

      <div className="mt-8 grid items-center gap-8 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <h3 className="font-display text-lg font-extrabold sm:text-xl">
            Seu cardápio nasce <span className="text-violet-300">numa conversa.</span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            Sem formulário de 20 campos. Quer mais rápido? Tire uma foto do cardápio antigo.
          </p>
          <ul className="mt-4 space-y-2">
            {CHAT_HIGHLIGHTS.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-gray-300">
                <Check className="mt-0.5 size-4 shrink-0 text-violet-400" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <WizardChat />
        </div>
      </div>

      <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
        <div className="order-1">
          <WaiterChat />
        </div>
        <div className="order-2">
          <h3 className="font-display text-lg font-extrabold sm:text-xl">
            Um garçom que nunca <span className="text-cyan-300">sai do salão.</span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            O Pracinha atende na hora, dentro do seu painel. Se for coisa técnica, ele leva o caso
            pro time com o contexto da sua tela.
          </p>
          <ul className="mt-4 space-y-2">
            {WAITER_HIGHLIGHTS.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-gray-300">
                <Check className="mt-0.5 size-4 shrink-0 text-cyan-400" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Variant — quem está por trás (SEÇÃO VISÍVEL)
   A identidade é parte da venda: o dono precisa saber em quem
   está confiando. Antes ficava só no painel "Quem faz".
   ============================================================ */

function VariantBand() {
  return (
    <section id="variant" className="mt-14 scroll-mt-20">
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
          <div className="mx-auto lg:mx-0">
            <VariantMark variant="full" className="size-24" />
          </div>
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-violet-300">
              <Store className="size-3.5" /> Quem faz
            </span>
            <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {VARIANT.name} existe por um motivo.
            </h2>
            <p className="mt-2 font-display text-base font-bold text-violet-300">
              {VARIANT.tagline}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">{VARIANT.mission}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {VARIANT.pillars.map((p) => (
            <div
              key={p.title}
              className="card-lift rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-300">
                <Check className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-white">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{p.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm leading-relaxed text-gray-400">
          Cada loja que continua aberta é um fornecedor, um funcionário e uma família que não perdem
          a renda.{" "}
          <strong className="font-bold text-white">
            Reduzir a mortalidade das pequenas empresas não é slogan — é a razão de existir da{" "}
            {VARIANT.name}.
          </strong>
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   OUTDOOR - apresentação dinâmica das features
   Textos alternantes mostrando benefícios no canto direito
   ============================================================ */

const OUTDOOR_SCENES = [
  {
    type: "mortalidade",
    title: "Variant existe por um motivo",
    subtitle: "Comissão de 23-30% quebra pequenos negócios",
    steps: [
      { bot: "� Eu sou o Pracinha. A Variant existe porque 80% dos restaurantes fecham em 3 anos." },
      { bot: "� Não é falta de cliente. É comissão de 23-30% nos apps que come sua margem." },
      { bot: "📉 Pizza de R$ 50: você recebe R$ 30. Margem líquida de 3-5% é prejuízo silencioso." },
      { bot: "🛡️ Zero comissão por pedido. Só paga R$ 1,99 quando tiver movimento. Sua margem volta pra você." },
      { bot: "🏢 Cada loja que sobe é um fornecedor, um funcionário, uma família que não perde renda." },
    ],
  },
  {
    type: "montagem",
    title: "Monte conversando",
    subtitle: "Sem formulário de 20 campos",
    steps: [
      { bot: "🚀 Vamos começar! Qual é o nome do seu restaurante?" },
      { user: "Variant Burger" },
      { bot: "✨ Legal! E qual é o WhatsApp para receber pedidos?" },
      { user: "(48) 99999-9999" },
      { bot: "📍 Perfeito. Qual é o endereço?" },
      { user: "Rua das Flores, 123 - Centro" },
      { bot: "🎉 Cardápio pronto! Criei 3 categorias com 8 itens." },
    ],
  },
  {
    type: "pedido",
    title: "Garçom digital IA",
    subtitle: "Responde na hora no seu painel",
    steps: [
      { user: "Quanto custa o X-Burger?" },
      { bot: "💰 R$ 29,00 com cheddar fresco." },
      { user: "Tem batata?" },
      { bot: "🍟 Sim! Batata rústica por R$ 18,00." },
      { user: "Quero um com cebola" },
      { bot: "🧅 Anotei: X-Burger com cebola. Algo mais?" },
      { user: "Só isso" },
      { bot: "✅ Pedido anotado! Total: R$ 47,00. Já chega pra cozinha." },
    ],
  },
  {
    type: "precos",
    title: "Só paga quando usar",
    subtitle: "Diária, Mensal ou Anual",
    steps: [
      { bot: "💡 Vou explicar os planos quando você precisar." },
      { user: "Diária é só quando usar?" },
      { bot: "⏰ Sim! R$ 1,99 libera 24h. Só quando tiver pedido." },
      { user: "E Premium?" },
      { bot: "♾️ R$ 28,99/mês é ilimitado. Tem movimento constante?" },
      { user: "Tem foto por IA?" },
      { bot: "📸 Anual R$ 199,99/ano inclui foto por IA! Leve o cardápio antigo, eu leio." },
    ],
  },
];

function OutdoorDisplay() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const currentScene = OUTDOOR_SCENES[sceneIndex];
  const currentStep = currentScene.steps[stepIndex];

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setStepIndex((prev) => {
          const next = prev + 1;
          if (next >= currentScene.steps.length) {
            setSceneIndex((s) => (s + 1) % OUTDOOR_SCENES.length);
            return 0;
          }
          return next;
        });
        setVisible(true);
      }, 300);
    }, 8000);

    return () => clearInterval(stepInterval);
  }, [currentScene.steps.length]);

  return (
    <div className="relative w-full max-w-2xl">
      {/* Estrutura do outdoor - parece tela/gravação */}
      <div className="relative rounded-lg border-4 border-gray-800 bg-gradient-to-b from-gray-900 to-black p-1 shadow-2xl">
        {/* Moldura de tela */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>

        {/* Conteúdo do outdoor - gravação de tela simulada */}
        <div className="relative overflow-hidden rounded bg-gradient-to-br from-gray-800 to-gray-900 aspect-video">
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"
          />
          
          {/* Simulação de tela */}
          <div className="relative p-4 sm:p-6 h-full flex flex-col">
            {/* Header da tela */}
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
              <span className="grid size-6 place-items-center rounded bg-cyan-500 text-black relative">
                <Bot className="size-3" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </span>
              <span className="text-xs font-bold text-gray-300">Pracinha - Assistente IA</span>
            </div>

            {/* Área de chat */}
            <div className="flex-1 space-y-3 overflow-hidden">
              <div
                className={cn(
                  "space-y-3 transition-all duration-500",
                  visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4",
                )}
              >
                {/* Histórico de mensagens anteriores */}
                {stepIndex > 0 && currentScene.steps.slice(0, stepIndex).map((msg, i) => (
                  <div key={i} className="opacity-50">
                    {msg.user && (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5">
                          <p className="text-xs text-white">{msg.user}</p>
                        </div>
                      </div>
                    )}
                    {msg.bot && (
                      <div className="flex justify-start">
                        <div className="flex items-start gap-2 max-w-[80%]">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-500 text-black">
                            <Bot className="size-3" />
                          </span>
                          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-1.5">
                            <p className="text-xs text-gray-300">{msg.bot}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Mensagem atual aparecendo */}
                {currentStep.user && (
                  <div className="flex justify-end animate-pop-in">
                    <div className="max-w-[80%] rounded-xl bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5">
                      <p className="text-xs text-white">{currentStep.user}</p>
                    </div>
                  </div>
                )}
                {currentStep.bot && (
                  <div className="flex justify-start animate-pop-in">
                    <div className="flex items-start gap-2 max-w-[80%]">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-500 text-black">
                        <Bot className="size-3" />
                      </span>
                      <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-1.5">
                        <p className="text-xs text-gray-200">{currentStep.bot}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* POSTE do outdoor */}
      <div className="relative mx-auto w-2 h-32 bg-gradient-to-b from-gray-700 via-gray-600 to-gray-800 shadow-xl mt-2">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gray-500/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-gray-500/50 to-transparent" />
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
  {
    icon: ChefHat,
    title: "Modo Cozinha",
    desc: "A fila de pedidos em tela cheia, um por vez, na letra grande da bancada.",
  },
];

const COMPARISON = [
  { label: "Comissão por pedido", us: "0%", them: "15–30%" },
  { label: "Seu cliente baixa um app", us: "Não, é só um link", them: "Sim, o app deles" },
  { label: "Link e marca próprios", us: "Sim, é seu", them: "Não, fica no app" },
  { label: "Pra começar", us: "Grátis, sem cartão", them: "Cadastro e contrato" },
  { label: "Você fica com os dados", us: "Sim, é seu cliente", them: "Não, é deles" },
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
    content:
      "Converse com a Pracinha: ela pergunta o nome, o WhatsApp, o endereço e monta o cardápio com você. Ou tire uma foto do cardápio antigo.",
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

const TABS = [
  { key: "cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
  { key: "recursos", label: "Recursos", icon: ChefHat },
] as const;

type LandingView = (typeof TABS)[number]["key"];

/**
 * COCKPIT SEM SCROLL - aba única
 * Fundo galáxia animado com estrelas, cometas e planetas
 * Canto esquerdo: botões de ação
 * Meio: slogan principal
 * Canto direito: outdoor animado no poste
 * Tudo abre em painéis
 */
function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [panel, setPanel] = useState<LandingPanel>(null);

  function openPanel(p: NonNullable<LandingPanel>) {
    setMenuOpen(false);
    setPanel(p);
  }
  const closePanel = () => setPanel(null);

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden text-white selection:bg-cyan-400/30">
      {/* Fundo galáxia animado com estrelas, cometas e planetas */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-[#0a0a1a] via-[#0f0f2a] to-[#070714]">
        {/* Estrelas estáticas */}
        <div className="absolute inset-0">
          {[...Array(100)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 2 + 1}px`,
                height: `${Math.random() * 2 + 1}px`,
                opacity: Math.random() * 0.5 + 0.2,
                animation: `twinkle ${Math.random() * 3 + 2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Cometa animado */}
        <div className="absolute top-20 right-10 w-32 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full opacity-60 animate-comet">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-300 rounded-full blur-sm" />
        </div>

        {/* Planeta animado */}
        <div className="absolute bottom-20 left-10 w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 opacity-40 animate-planet">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-2 bg-violet-400/30 rounded-full -rotate-12" />
        </div>

        {/* Nebulosa */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 rounded-full blur-3xl animate-aurora" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl animate-aurora [animation-delay:2s]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-40 shrink-0 border-b border-white/[0.07] bg-[#07070c]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <VariantMark className="size-8 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-transform group-hover:scale-105" />
            <span className="font-display text-sm font-extrabold tracking-tight sm:text-base">
              Cardápio <span className="text-cyan-400">Cidadela</span>
            </span>
          </Link>

          <div className="hidden items-center gap-5 md:flex">
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
              onClick={() => openPanel("features")}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Recursos
            </button>
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
          <div className="grid grid-cols-2 gap-1 border-t border-white/10 px-4 py-3 md:hidden">
            {(
              [
                ["preco", "Preços"],
                ["calc", "Economia"],
                ["features", "Recursos"],
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
            <button
              onClick={() => {
                setMenuOpen(false);
                setTutorialOpen(true);
              }}
              className="col-span-2 flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white"
            >
              <BookOpen className="size-4" /> Tutorial
            </button>
          </div>
        )}
      </nav>

      {/* COCKPIT - tela única sem scroll */}
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid w-full grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* CANTO ESQUERDO - Botões de ação */}
          <div className="flex flex-col justify-center lg:col-span-4">
            <div className="space-y-4">
              <p className="animate-reveal inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                <Sparkles className="size-3" /> Para micro-restaurantes
              </p>

              <h1 className="animate-reveal font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                Seu cardápio no ar{" "}
                <span className="text-shine bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
                  em minutos.
                </span>
              </h1>

              <p className="animate-reveal text-sm leading-relaxed text-gray-300">
                Link próprio, QR Code e pedidos na hora —{" "}
                <strong className="font-bold text-white">sem comissão por pedido</strong>.
              </p>

              <div className="space-y-3 pt-4">
                <Link
                  to="/login"
                  search={{ mode: "register" }}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.08] p-4 transition-all hover:border-cyan-400/50 hover:bg-cyan-500/[0.12]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/20 text-cyan-300">
                    <Store className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Crie seu cardápio</p>
                    <p className="text-[11px] text-gray-400">Monte grátis em minutos</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-cyan-300 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    const realMenuUrl = `${SITE_URL}/cardapio/${DEMO_STORE_SLUG}`;
                    window.open(realMenuUrl, "_blank");
                  }}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-gray-300">
                    <UtensilsCrossed className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Ver cardápio</p>
                    <p className="text-[11px] text-gray-400">Cardápio real funcionando</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                </button>

                <InlineSimulator onOpenFull={() => openPanel("calc")} />
              </div>
            </div>
          </div>

          {/* CANTO DIREITO SUPERIOR - Outdoor animado */}
          <div className="lg:col-span-8 lg:col-start-5 flex justify-end">
            <div className="relative w-full max-w-xl">
              <OutdoorDisplay />
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé compacto */}
      <footer className="relative z-10 shrink-0 border-t border-white/[0.07] py-3">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <VariantMark className="size-6" />
            <span className="font-display text-xs font-extrabold text-gray-300">
              Cardápio <span className="text-cyan-400">Cidadela</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <button
              onClick={() => openPanel("faq")}
              className="transition-colors hover:text-gray-300"
            >
              Dúvidas
            </button>
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
            © {new Date().getFullYear()} {COMPANY.brandName} · CNPJ {COMPANY.cnpj}
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

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <div className="px-4 py-3">Por que sai mais barato</div>
              <div className="flex items-center gap-1.5 px-4 py-3 text-cyan-300">
                <UtensilsCrossed className="size-3.5" /> Cidadela
              </div>
              <div className="px-4 py-3">App de entrega</div>
            </div>
            {COMPARISON.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-white/[0.05] text-sm last:border-0"
              >
                <div className="px-4 py-3 text-gray-300">{row.label}</div>
                <div className="flex items-center gap-1.5 px-4 py-3 font-bold text-emerald-300">
                  <Check className="size-4 shrink-0" /> {row.us}
                </div>
                <div className="px-4 py-3 text-gray-500">{row.them}</div>
              </div>
            ))}
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
                  preço, endereço e nome. Não trava venda, não perde cliente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </GuidePanel>

      <GuidePanel
        open={panel === "features"}
        onOpenChange={(o) => !o && closePanel()}
        title="Recursos"
        icon={<ChefHat className="size-4" />}
        tone="violet"
        width="xl"
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-cyan-500/20 text-cyan-300">
                <Bot className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Garçom Digital</h3>
                <p className="text-[11px] text-gray-400">
                  Assistente IA que responde na hora dentro do seu painel
                </p>
              </div>
            </div>
            <WaiterChat />
          </div>

          <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-violet-500/20 text-violet-300">
                <MessageCircle className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Monte conversando</h3>
                <p className="text-[11px] text-gray-400">
                  Uma pergunta por vez, sem formulário de 20 campos
                </p>
              </div>
            </div>
            <WizardChat />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
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
