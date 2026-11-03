import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Bike,
  Check,
  ChefHat,
  Menu,
  QrCode,
  Send,
  ShieldCheck,
  Smartphone,
  UtensilsCrossed,
  X,
  Zap,
  Play,
  Clock,
  DollarSign,
  Palette,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  BookOpen,
  Infinity as InfinityIcon,
} from "lucide-react";
import {
  MONTHLY_PRICE_LABEL,
  PREMIUM_PRICE_LABEL,
  PREMIUM_PRICE_VALUE,
  DAY_PASS_PRICE_LABEL,
  formatMonthlyEquivalent,
} from "@/lib/pricing";

import { brl } from "@/lib/utils";
import { COMPANY, hasSupportContact } from "@/lib/company";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

const DEMO_ITEMS = [
  { id: "p1", emoji: "🍕", name: "Pizza da casa", price: 32, tag: "Mais pedido" },
  { id: "p2", emoji: "🍔", name: "Burger artesanal", price: 26 },
  { id: "p3", emoji: "🥤", name: "Refri lata", price: 6 },
];

/** Demo viva: o visitante monta um pedido de verdade na própria landing. */
function LiveMenuDemo() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);

  const { count, total } = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const item of DEMO_ITEMS) {
      const qty = cart[item.id] ?? 0;
      count += qty;
      total += qty * item.price;
    }
    return { count, total };
  }, [cart]);

  function add(id: string) {
    setSent(false);
    setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function send() {
    if (count === 0) return;
    setSent(true);
    setCart({});
  }

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="relative rounded-[2rem] border border-white/10 bg-[#0b0b12] p-3 shadow-[0_30px_80px_-20px_rgba(6,182,212,0.35)]">
        <div className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/10" />

        <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-lg">
            🍽️
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">Cantina da Praça</p>
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-300">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Aberto agora
            </p>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          {DEMO_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => add(item.id)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-left transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/[0.05]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-xl">
                {item.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-white">{item.name}</span>
                <span className="text-[11px] font-bold text-cyan-300">{brl(item.price)}</span>
                {item.tag && (
                  <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                    {item.tag}
                  </span>
                )}
              </span>
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-cyan-500 text-sm font-black text-black transition-transform group-hover:scale-110">
                +
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/30 p-3">
          {sent ? (
            <div className="animate-pop-in flex items-center gap-2.5 py-1">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
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
                <span className="text-sm font-black text-white">{brl(total)}</span>
              </div>
              <button
                type="button"
                onClick={send}
                disabled={count === 0}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-black transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="size-3.5" /> Enviar pedido
              </button>
            </>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-500">
        É isto que seu cliente vê. Experimente.
      </p>
    </div>
  );
}

const PROOF = [
  { icon: Zap, label: "Pedido em tempo real", hint: "alerta sonoro no painel" },
  { icon: QrCode, label: "Link e QR próprios", hint: "bio, salão e mesa" },
  { icon: Bike, label: "Entrega ou retirada", hint: "taxa e endereço no pedido" },
  { icon: ShieldCheck, label: "Paga só quando usar", hint: "sem comissão, sem contrato" },
];

const STEPS = [
  {
    icon: Smartphone,
    title: "Monte o cardápio",
    desc: "Fotos, preços e categorias em minutos, direto do celular.",
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

const TUTORIAL_STEPS = [
  {
    title: "Comece grátis",
    content: "Crie sua conta sem cartão. 5 pedidos por mês de graça. Se não tiver movimento, não paga nada.",
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
    content: "Depois de 5 pedidos grátis, usa diária de R$ 1,49/24h só quando cair pedido. Ou assina Premium se tiver movimento constante.",
  },
  {
    title: "Personalize tudo",
    content: "Logo, banner, cores da marca. Seu cardápio, 100% à sua cara.",
  },
];

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <UtensilsCrossed className="size-6 text-cyan-400" />
            <span className="text-base font-bold tracking-tight">
              Cardápio <span className="text-cyan-400">Cidadela</span>
            </span>
          </Link>

          <div className="hidden items-center gap-5 md:flex">
            <a
              href="/cardapio/cidadela"
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

          <div className="flex items-center gap-1 md:hidden">
            {/* Entrar fica visível no celular: dentro do hambúrguer ele não é
                descoberto, e era por isso que a home só mostrava "Criar". */}
            <Link
              to="/login"
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-gray-300 transition-colors hover:text-white"
            >
              Entrar
            </Link>
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
          <div className="space-y-1 border-t border-white/10 px-4 py-4 md:hidden">
            <a
              href="/cardapio/cidadela"
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
            >
              Ver cardápio real
            </a>
            <button
              onClick={() => {
                setMenuOpen(false);
                setTutorialOpen(true);
              }}
              className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
            >
              <BookOpen className="size-4" /> Tutorial
            </button>
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
            >
              Entrar
            </Link>
            <Link
              to="/login"
              search={{ mode: "register" }}
              className="mt-2 block rounded-full bg-cyan-500 px-5 py-3 text-center text-sm font-bold text-black"
            >
              Criar meu cardápio grátis
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[480px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="animate-float absolute right-4 top-1/3 h-[320px] w-[320px] rounded-full bg-violet-500/[0.06] blur-[100px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:py-28">
          <div className="text-center lg:text-left">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
              Para micro-restaurantes
            </p>

            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Pague só quando tiver pedido.
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Cardápio nunca trava.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-gray-300 sm:text-lg lg:mx-0">
              Comece grátis. Depois, R$ 1,49/24h só quando tiver pedido. Ou Premium ilimitado. Concursos cobram 15-30% em cada pedido — aqui você paga só quando usa.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start">
              <Link
                to="/login"
                search={{ mode: "register" }}
                className="sheen group flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 py-3.5 text-sm font-bold text-black transition-all hover:-translate-y-0.5 hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] sm:w-auto"
              >
                Criar meu cardápio grátis
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/login"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-gray-300 transition-all hover:border-white/30 hover:text-white sm:w-auto"
              >
                Já tenho conta · Entrar
              </Link>
              <a
                href="/cardapio/cidadela"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-gray-300 transition-all hover:border-white/30 hover:text-white sm:w-auto"
              >
                Ver cardápio real
              </a>
            </div>

            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-gray-500 lg:justify-start">
              <Check className="size-3.5 text-emerald-400" /> Comece grátis · 5 pedidos por mês
              <span className="text-gray-700">•</span>
              <Check className="size-3.5 text-emerald-400" /> Sem cartão
            </p>
          </div>

          <LiveMenuDemo />
        </div>
      </section>

      {/* Prova rápida — uma linha, sem parágrafos */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="mx-auto grid max-w-6xl gap-px px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {PROOF.map((p) => (
            <div key={p.label} className="flex items-center gap-3 py-5 sm:px-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
                <p.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{p.label}</p>
                <p className="truncate text-xs text-gray-500">{p.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona — 3 passos, direto */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300">
              <ChefHat className="size-3.5" /> Do zero ao primeiro pedido
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Três passos. Nenhum tutorial.
            </h2>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title}>
                <span className="text-5xl font-black text-white/[0.07]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="mt-2 flex items-center gap-2 text-cyan-300">
                  <s.icon className="size-5" />
                  <h3 className="text-base font-bold text-white">{s.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona o pagamento - explicação detalhada */}
      <section className="border-t border-white/5 bg-white/[0.015] py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Pague só quando tiver pedido.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Concursos cobram 15-30% em CADA pedido. Aqui você começa grátis e paga só quando usar.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <Check className="size-5" />
                </span>
                <h3 className="text-lg font-bold text-white">Comece grátis</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                5 pedidos por mês sem pagar nada. Monte seu cardápio, coloque o QR Code e comece a receber pedidos. Se não tiver movimento, não paga nada.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
                  <Clock className="size-5" />
                </span>
                <h3 className="text-lg font-bold text-white">Diária quando precisar</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                {DAY_PASS_PRICE_LABEL} por 24h. Paga só quando cair pedido. Abre só no final de semana? Usa diária só nesses dias. Empilhável: se usar 2 dias, paga 2x.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
                  <InfinityIcon className="size-5" />
                </span>
                <h3 className="text-lg font-bold text-white">Premium ilimitado</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Quando o movimento for constante, assine Premium por {MONTHLY_PRICE_LABEL} ou {PREMIUM_PRICE_LABEL}. Pedidos ilimitados, detalhes liberados, sem se preocupar.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-300 mt-0.5">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h4 className="text-base font-bold text-white mb-2">Cardápio nunca trava</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Mesmo com 0 pedidos grátis, seu cliente SEMPRE consegue pedir. O pedido chega para você com preço, endereço e nome do cliente. Se quiser ver os itens, usa a diária. Não trava venda, não perde cliente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Personalização */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Seu cardápio, 100% à sua cara.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Logo, banner, cores da marca. O cliente sabe que está no seu negócio, não num app de terceiro.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
                  <Palette className="size-5" />
                </span>
                <h3 className="text-lg font-bold text-white">Cores da marca</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Escolha a cor primária (botões, preços) e secundária (efeitos visuais). Seu cardápio com a identidade visual do seu negócio.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
                  <QrCode className="size-5" />
                </span>
                <h3 className="text-lg font-bold text-white">Logo e banner</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Upload do logo da sua hamburgueria, açai, pizza. Banner personalizado para o topo do cardápio. Profissional do começo ao fim.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Preço */}
      <section id="preco" className="border-t border-white/5 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Escolha como pagar.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-400">
              Comece grátis. Pague só quando tiver pedido. Ou assine Premium quando o movimento for constante.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Grátis</p>
              <p className="mt-3 text-4xl font-black text-white">R$ 0</p>
              <p className="mt-1 text-sm text-gray-400">para sempre</p>
              <ul className="mt-6 space-y-2.5 text-sm text-gray-300">
                {[
                  "Cardápio completo",
                  "5 pedidos por mês",
                  "Link e QR Code",
                  "Pedidos em tempo real",
                  "Paga nada se não tiver pedido",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-emerald-400" /> {t}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                search={{ mode: "register" }}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-full border border-white/15 py-3 text-sm font-bold text-white transition-colors hover:bg-white/[0.06]"
              >
                Começar grátis
              </Link>
            </div>

            <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/[0.10] to-transparent p-7">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full bg-amber-500/20 blur-3xl"
              />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                  Diária
                </p>
                <p className="mt-3 text-4xl font-black text-white">{DAY_PASS_PRICE_LABEL}</p>
                <p className="mt-1 text-sm text-gray-400">por 24h · paga só quando usar</p>
                <ul className="mt-6 space-y-2.5 text-sm text-gray-200">
                  {[
                    "Libera tudo por 24h",
                    "Empilhável (usa quantas vezes quiser)",
                    "Paga DEPOIS que cair pedido",
                    "Perfeito pra quem abre só no fim de semana",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-amber-300" /> {t}
                    </li>
                  ))}
                </ul>
                <a
                  href="/login?returnTo=/admin/assinatura"
                  className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 py-3 text-sm font-bold text-black transition-all hover:bg-amber-400 hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
                >
                  Usar diária <ArrowRight className="size-4" />
                </a>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.10] to-transparent p-7">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full bg-cyan-500/20 blur-3xl"
              />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                    Premium
                  </p>
                  <span className="rounded-full bg-cyan-500 px-2.5 py-1 text-[10px] font-black text-black">
                    ANUAL
                  </span>
                </div>
                <p className="mt-3 text-4xl font-black text-white">{PREMIUM_PRICE_LABEL}</p>
                <p className="mt-1 text-sm text-gray-400">
                  ou {MONTHLY_PRICE_LABEL} · equivale a{" "}
                  {formatMonthlyEquivalent(PREMIUM_PRICE_VALUE)} por mês no anual
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-gray-200">
                  {[
                    "Pedidos ilimitados",
                    "Detalhes e itens liberados",
                    "Todos os restaurantes da conta",
                    "Cancele quando quiser",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-cyan-300" /> {t}
                    </li>
                  ))}
                </ul>
                <a
                  href="/login?returnTo=/admin/assinatura"
                  className="sheen mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 py-3 text-sm font-bold text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
                >
                  Assinar Premium <ArrowRight className="size-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-white/5 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Seu próximo pedido pode chegar sozinho.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-gray-400">
            Crie seu cardápio agora e mande o link no status. Leva menos tempo que tirar uma foto do
            prato.
          </p>
          <div className="mt-8">
            <Link
              to="/login"
              search={{ mode: "register" }}
              className="sheen inline-flex items-center gap-2 rounded-full bg-cyan-500 px-9 py-4 text-base font-bold text-black transition-all hover:-translate-y-0.5 hover:bg-cyan-400 hover:shadow-[0_0_40px_rgba(34,211,238,0.4)]"
            >
              Criar meu cardápio grátis <ArrowRight className="size-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="size-5 text-cyan-400" />
            <span className="text-sm font-semibold text-gray-400">
              Cardápio <span className="text-cyan-400">Cidadela</span>
            </span>
          </div>
          <div className="flex gap-6 text-xs text-gray-500">
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
        </div>
        <p className="mt-6 text-center text-[11px] text-gray-600">
          © {new Date().getFullYear()} {COMPANY.brandName} · Feito para quem vive da cozinha.
        </p>
        <p className="mt-1 text-center text-[11px] text-gray-600">
          {COMPANY.legalName} · CNPJ {COMPANY.cnpj} · {COMPANY.city}/{COMPANY.state}
        </p>
      </footer>

      {/* Tutorial Modal */}
      <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <BookOpen className="size-5 text-cyan-400" />
            Como funciona
          </DialogTitle>
          <div className="mt-4">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2">
                Passo {tutorialStep + 1} de {TUTORIAL_STEPS.length}
              </p>
              <h3 className="text-xl font-bold text-white mb-2">
                {TUTORIAL_STEPS[tutorialStep].title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {TUTORIAL_STEPS[tutorialStep].content}
              </p>
            </div>

            <div className="flex gap-2 mt-6">
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

            <div className="flex justify-center gap-1 mt-4">
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
