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
  Gift,
  HeartHandshake,
  LayoutDashboard,
  LayoutTemplate,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Palette,
  PartyPopper,
  Plus,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Snowflake,
  Sparkles,
  Store,
  TreePine,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { PREMIUM_PRICE_VALUE, DAY_PASS_PRICE_LABEL, DAY_PASS_PRICE_VALUE } from "@/lib/pricing";

import { brl, cn } from "@/lib/utils";
import { COMPANY, VARIANT, hasSupportContact } from "@/lib/company";
import { isChristmasSeason } from "@/lib/seasonal";
import { SITE_URL } from "@/lib/site";
import { DEMO_STORE_SLUG } from "@/modules/supabase/landing-demo";
import { useAuth } from "@/components/AuthProvider";
import { switchAccount } from "@/modules/supabase/auth";
import { OutdoorBillboard } from "@/components/landing/OutdoorBillboard";
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
   A conta da perda — isolada para o herói e o painel mostrarem
   o MESMO número. O argumento da página é o número, não o adjetivo.
   ============================================================ */

/** Acima disso, o Premium anual fica mais barato que pagar diária todo dia. */
const DAY_PASS_BREAK_EVEN = Math.ceil(PREMIUM_PRICE_VALUE / 12 / DAY_PASS_PRICE_VALUE);

const LOSS_DEFAULT_SPEND = 59;
const LOSS_DEFAULT_DAYS = 8;

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
 * Simulador de economia do herói.
 *
 * Fica na cara, sem clique: o dono informa o que paga hoje e os dias de
 * movimento, e o número da economia aparece na hora. O painel completo
 * (LossCalculator) abre pelo botão "«plano» é o seu plano".
 */
function InlineSimulator({ onOpenFull }: { onOpenFull: () => void }) {
  const [spend, setSpend] = useState(LOSS_DEFAULT_SPEND);
  const [days, setDays] = useState(LOSS_DEFAULT_DAYS);
  const { plan, yearlySaved, payingNothing } = useMemo(
    () => computeLossPlan(spend, days),
    [spend, days],
  );

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/[0.08] to-transparent p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-rose-300">
        <TrendingUp className="size-3.5" /> Simulador de economia
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-400">Paga hoje (R$)</span>
          <input
            type="number"
            min={0}
            max={5000}
            step={10}
            value={spend}
            onChange={(e) => setSpend(Math.max(0, Number(e.target.value) || 0))}
            aria-label="Quanto você paga hoje por mês"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-display text-lg font-black text-white outline-none focus:border-rose-400/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between text-[11px] font-semibold text-gray-400">
            Dias abertos{" "}
            <span className="font-display text-sm font-black text-cyan-300">{days}</span>
          </span>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Dias de movimento por mês"
            className="mt-3 w-full accent-cyan-400"
          />
        </label>
      </div>

      <div className="mt-3 flex items-baseline justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
          Economia estimada
        </span>
        <span className="font-display text-lg font-black text-emerald-300">
          {payingNothing ? "—" : `${brl(yearlySaved)}/ano`}
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenFull}
        className="group mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.09]"
      >
        {plan.name} é o seu plano
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

/** Calculadora completa — abre no painel por cima, com o número já calculado. */
function LossCalculator() {
  const [spend, setSpend] = useState(LOSS_DEFAULT_SPEND);
  const [days, setDays] = useState(LOSS_DEFAULT_DAYS);
  const { plan, monthlySaved, yearlySaved, payingNothing } = useMemo(
    () => computeLossPlan(spend, days),
    [spend, days],
  );

  return (
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
              onChange={(e) => setSpend(Math.max(0, Number(e.target.value) || 0))}
              className="w-full bg-transparent font-display text-2xl font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Quanto você paga por mês no seu cardápio atual"
            />
          </div>
          <span className="mt-2 block text-xs text-gray-500">
            Pode ser app de entrega, sistema de PDV, planilha — o que você usa hoje.
          </span>
        </label>

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
            onChange={(e) => setDays(Number(e.target.value))}
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
  );
}

/* ============================================================
   Monte a loja conversando (chat + IA) — SEÇÃO VISÍVEL
   O wizard de criação e o garçom digital são o que vende o produto.
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
    <section id="chat" className="scroll-mt-20">
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

      <div className="mt-10 grid items-center gap-8 lg:grid-cols-2">
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

      <div className="mt-14 grid items-center gap-8 lg:grid-cols-2">
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
   está confiando.
   ============================================================ */

function VariantBand() {
  return (
    <section id="variant" className="scroll-mt-20">
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
    icon: PartyPopper,
    title: "Cardápio que veste a data",
    desc: "Natal, Carnaval, Festa Junina e mais: no mês do feriado o cardápio se enfeita sozinho com um toque. Exclusivo do plano Anual.",
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
    icon: HeartHandshake,
    title: "MATA FOME",
    desc: "Diferencial opcional: um convite no cardápio para quem tá com pressa ou não tem como pagar. Você adere se quiser — o item é o seu.",
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

/**
 * Conta na navbar da landing.
 *
 * A home mostra o estado real: quem está logado vê "Meu painel / Sair", não
 * "Entrar / Criar grátis".
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
   Painel de abas do herói — o produto na mão do visitante.
   ============================================================ */

const TABS = [
  { key: "cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
  { key: "recursos", label: "Recursos", icon: ChefHat },
] as const;

type LandingView = (typeof TABS)[number]["key"];

function HeroPanel() {
  const [view, setView] = useState<LandingView>("cardapio");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b12]/80 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-sm">
      <div className="relative flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
        <div
          aria-hidden
          className="animate-scan pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-cyan-400/10 to-transparent"
        />
        <span className="relative flex items-center gap-1.5">
          {TABS.map((t) => {
            const on = view === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                  on
                    ? "bg-cyan-500 text-black"
                    : "bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white",
                )}
              >
                <t.icon className="size-3.5" /> {t.label}
              </button>
            );
          })}
        </span>
        <span className="relative ml-auto flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          {TABS.find((t) => t.key === view)?.label} · ao vivo
        </span>
      </div>

      <div key={view} className="animate-panel min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {view === "cardapio" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-300">
              <UtensilsCrossed className="size-6" />
            </span>
            <div>
              <p className="font-display text-lg font-black text-white">
                O cardápio de verdade, aberto agora
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Sem mockup: é o cardápio real que um cliente abre pelo link.
              </p>
            </div>
            <MenuReveal />
          </div>
        )}

        {view === "templates" && <TemplateGallery />}

        {view === "recursos" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.slice(0, 6).map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
                  <f.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">{f.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Enfeite natalino da home.
   Puramente decorativo e só renderiza na janela de Natal.
   ============================================================ */

function ChristmasHero() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${(i * 53 + 7) % 100}%`,
        size: 3 + (i % 3) * 2,
        duration: `${9 + (i % 5) * 2}s`,
        delay: `${(i % 7) * 1.3}s`,
        drift: `${((i % 5) - 2) * 30}px`,
        opacity: 0.4 + (i % 4) * 0.15,
      })),
    [],
  );

  const bulbs = ["#ef4444", "#22c55e", "#facc15"];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {flakes.map((f, i) => (
        <span
          key={i}
          className="snowflake"
          style={
            {
              left: f.left,
              width: f.size,
              height: f.size,
              animationDuration: f.duration,
              animationDelay: f.delay,
              "--snow-drift": f.drift,
              "--snow-o": f.opacity,
            } as React.CSSProperties
          }
        />
      ))}

      <div className="absolute inset-x-0 top-14 flex items-start justify-between px-2 sm:top-16 sm:px-6">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="flex flex-col items-center">
            <span className="h-3 w-px bg-white/25 sm:h-4" />
            <span
              className="fairy-bulb size-2 rounded-full sm:size-2.5"
              style={{
                backgroundColor: bulbs[i % bulbs.length],
                boxShadow: `0 0 8px 1px ${bulbs[i % bulbs.length]}`,
                animationDelay: `${(i % 6) * 0.28}s`,
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Página
   ============================================================ */

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [panel, setPanel] = useState<LandingPanel>(null);

  const christmas = isChristmasSeason();

  function openPanel(p: NonNullable<LandingPanel>) {
    setMenuOpen(false);
    setPanel(p);
  }
  const closePanel = () => setPanel(null);

  function goToVariant() {
    setMenuOpen(false);
    scrollToSection("variant");
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden text-white selection:bg-cyan-400/30">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#0a0a1a] via-[#0f0f2a] to-[#070714]"
      >
        <div className="variant-grid absolute inset-0" />
        <div className="variant-grid-nodes absolute inset-0" />
        <div className="animate-aurora absolute left-1/4 top-1/4 size-96 rounded-full bg-gradient-to-br from-cyan-500/10 to-violet-500/10 blur-3xl" />
        <div className="animate-aurora absolute bottom-1/4 right-1/4 size-80 rounded-full bg-gradient-to-br from-blue-500/10 to-cyan-500/10 blur-3xl [animation-delay:2s]" />
        {christmas && <div className="aurora-christmas absolute inset-0 animate-aurora" />}
      </div>

      {christmas && <ChristmasHero />}

      <nav className="sticky top-0 z-40 shrink-0 border-b border-white/[0.07] bg-[#07070c]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <VariantMark className="size-8 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-transform group-hover:scale-105" />
            <span className="font-display text-sm font-extrabold tracking-tight sm:text-base">
              Cardápio <span className="text-cyan-400">Cidadela</span>
            </span>
          </Link>

          <div className="hidden items-center gap-5 md:flex">
            <button
              onClick={() => openPanel("features")}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Recursos
            </button>
            <button
              onClick={() => openPanel("calc")}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Economia
            </button>
            <button
              onClick={() => openPanel("preco")}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Preços
            </button>
            <button
              onClick={goToVariant}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Quem faz
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
                ["features", "Recursos"],
                ["calc", "Economia"],
                ["preco", "Preços"],
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
              onClick={goToVariant}
              className="rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white"
            >
              Quem faz
            </button>
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

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col justify-center lg:col-span-5">
            <p
              className={cn(
                "animate-reveal inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                christmas
                  ? "border-red-500/30 bg-red-500/[0.1] text-red-200"
                  : "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-300",
              )}
            >
              {christmas ? (
                <>
                  <TreePine className="size-3" /> Campanha de Natal
                </>
              ) : (
                <>
                  <Sparkles className="size-3" /> Para micro-restaurantes
                </>
              )}
            </p>

            <h1 className="animate-reveal font-display mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {christmas ? (
                <>
                  Seu cardápio no ar em minutos{" "}
                  <span className="text-shine bg-gradient-to-r from-red-400 via-emerald-300 to-red-400 bg-clip-text text-transparent">
                    nesse Natal.
                  </span>
                </>
              ) : (
                <>
                  Seu cardápio no ar{" "}
                  <span className="text-shine bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
                    em minutos.
                  </span>
                </>
              )}
            </h1>

            <p className="animate-reveal mt-4 text-sm leading-relaxed text-gray-300 sm:text-base">
              Link próprio, QR Code e pedidos na hora —{" "}
              <strong className="font-bold text-white">sem comissão por pedido</strong>. O cliente
              pede sozinho pelo celular; você só recebe.
            </p>

            <div className="animate-reveal mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/login"
                search={{ mode: "register" }}
                className={cn(
                  "sheen group flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-black text-black transition-all hover:-translate-y-0.5",
                  christmas
                    ? "bg-red-500 hover:bg-red-400 hover:shadow-[0_0_40px_rgba(239,68,68,0.45)]"
                    : "bg-cyan-500 hover:bg-cyan-400 hover:shadow-[0_0_40px_rgba(34,211,238,0.45)]",
                )}
              >
                {christmas ? <Gift className="size-5" /> : <Store className="size-5" />}
                {christmas ? "Crie seu cardápio nesse Natal" : "Criar meu cardápio grátis"}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3.5 text-base font-bold text-white transition-colors hover:bg-white/[0.08]"
              >
                <LogIn className="size-5" /> Entrar
              </Link>
            </div>

            <p className="animate-reveal mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
              <span className="flex items-center gap-1">
                <Check className="size-3 text-emerald-400" /> Sem cartão
              </span>
              <span className="flex items-center gap-1">
                <Check className="size-3 text-emerald-400" /> 5 pedidos grátis/mês
              </span>
              <span className="flex items-center gap-1">
                <Check className="size-3 text-emerald-400" /> No ar em minutos
              </span>
            </p>

            <div className="animate-reveal mt-5">
              <InlineSimulator onOpenFull={() => openPanel("calc")} />
            </div>
          </div>

          <div className="lg:col-span-7">
            <HeroPanel />
          </div>
        </section>

        <section id="outdoor" className="mt-16 scroll-mt-20">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-cyan-300">
                <Bot className="size-3.5" /> Pracinha ao vivo
              </span>
              <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
                O produto funcionando, <span className="text-cyan-300">sem print de app.</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-400 sm:text-base">
                Do problema que fecha a loja ao pedido que chega na cozinha: é o Pracinha
                trabalhando, cena a cena, do lado de cá do balcão.
              </p>
              <ul className="mt-5 space-y-2">
                {[
                  "Zero comissão por pedido — a margem volta pra você",
                  "Cardápio montado por conversa, sem formulário",
                  "Pedido caindo no painel na hora",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="mt-0.5 size-4 shrink-0 text-cyan-400" /> {t}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => openPanel("features")}
                className="group mt-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-300 transition-colors hover:text-cyan-200"
              >
                Ver todos os recursos
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
            <OutdoorBillboard christmas={christmas} />
          </div>
        </section>

        <section className="mt-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Do zero ao pedido em <span className="text-cyan-300">três passos.</span>
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="card-lift relative rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6"
              >
                <span className="absolute right-5 top-5 font-display text-4xl font-black text-white/[0.06]">
                  {i + 1}
                </span>
                <span className="grid size-11 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                  <s.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-bold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-16">
          <ChatAiSection />
        </div>

        <div className="mt-16">
          <VariantBand />
        </div>

        <section id="planos" className="mt-16 scroll-mt-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
              <ReceiptText className="size-3.5" /> Preços
            </span>
            <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Comece grátis. <span className="text-emerald-300">Pague só quando tiver pedido.</span>
            </h2>
          </div>
          <div className="mt-8">
            <PlanCards
              className="grid gap-5 sm:grid-cols-3"
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
          </div>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:flex-row">
            <p className="text-sm text-amber-100/90">
              <span className="font-bold text-amber-300">Diária {DAY_PASS_PRICE_LABEL}</span> — abre
              só quando tem movimento? Libera tudo por 24h, paga só os dias que usar e empilha.
            </p>
            <a
              href="/login?returnTo=/admin/assinatura"
              className="shrink-0 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-black transition-all hover:bg-amber-400"
            >
              Usar diária
            </a>
          </div>
        </section>
      </main>

      <footer className="relative z-10 shrink-0 border-t border-white/[0.07] py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
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
