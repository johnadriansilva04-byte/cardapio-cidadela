import { createFileRoute, Link } from "@tanstack/react-router";
import {
  UtensilsCrossed,
  QrCode,
  BarChart3,
  Smartphone,
  Zap,
  Shield,
  ChevronRight,
  Star,
  Users,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MenuFácil — Cardápios Digitais para Restaurantes" },
      {
        name: "description",
        content:
          "Crie, gerencie e publique cardápios digitais profissionais para seu restaurante. URLs bonitas, pedidos em tempo real e design premium.",
      },
      { property: "og:title", content: "MenuFácil — Cardápios Digitais" },
      {
        property: "og:description",
        content: "Plataforma SaaS para criação e gerenciamento de cardápios digitais.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <UtensilsCrossed className="size-6 text-cyan-400" />
            <span className="text-lg font-bold tracking-tight">
              Menu<span className="text-cyan-400">Fácil</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Funcionalidades
            </a>
            <a
              href="#about"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Sobre
            </a>
            <a
              href="#how"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Como funciona
            </a>
            <Link
              to="/login"
              className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]"
            >
              Acessar Plataforma
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenu(!mobileMenu)}
            className="md:hidden text-gray-400"
            aria-label="Menu"
          >
            {mobileMenu ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="border-t border-white/10 px-4 py-4 space-y-3 md:hidden">
            <a href="#features" className="block text-sm text-gray-400 hover:text-white">
              Funcionalidades
            </a>
            <a href="#about" className="block text-sm text-gray-400 hover:text-white">
              Sobre
            </a>
            <a href="#how" className="block text-sm text-gray-400 hover:text-white">
              Como funciona
            </a>
            <Link
              to="/login"
              className="block rounded-lg bg-cyan-500 px-5 py-2.5 text-center text-sm font-semibold text-black"
            >
              Acessar Plataforma
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5">
              <Zap className="size-3.5 text-cyan-400" />
              <span className="text-xs font-medium text-cyan-300">
                Plataforma para restaurantes
              </span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Cardápios digitais que{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                encantam
              </span>
              <br />
              seus clientes
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
              Crie um cardápio profissional com URL personalizada, gerencie pedidos
              em tempo real e surpreenda seus clientes com uma experiência mobile premium.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-xl bg-cyan-500 px-8 py-3.5 text-sm font-bold text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
              >
                Criar meu cardápio grátis
                <ChevronRight className="size-4" />
              </Link>
              <a
                href="#how"
                className="flex items-center gap-2 rounded-xl border border-white/15 px-8 py-3.5 text-sm font-medium text-gray-300 transition-all hover:border-white/30 hover:text-white"
              >
                Como funciona
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-16 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="size-8 rounded-full border-2 border-black bg-gradient-to-br from-cyan-400 to-blue-600"
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-400">
                  <strong className="text-white">200+</strong> restaurantes ativos
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    className="size-4 fill-yellow-400 text-yellow-400"
                  />
                ))}
                <span className="ml-1 text-sm text-gray-400">4.9 / 5.0</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Tudo que seu restaurante precisa
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Uma plataforma completa para criar, gerenciar e divulgar seu cardápio digital.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: UtensilsCrossed,
                title: "Cardápio profissional",
                desc: "Crie categorias, adicione produtos com fotos, preços e descrições. Tudo organizado e bonito.",
              },
              {
                icon: QrCode,
                title: "URL personalizada",
                desc: "Seu restaurante ganha um link único como restaurante.menufacil.com. Fácil de compartilhar no WhatsApp.",
              },
              {
                icon: BarChart3,
                title: "Pedidos em tempo real",
                desc: "Receba pedidos instantaneamente no painel. Acompanhe status do preparo até a entrega.",
              },
              {
                icon: Smartphone,
                title: "100% mobile",
                desc: "Experiência mobile-first pensada para clientes que pedem pelo celular.",
              },
              {
                icon: Shield,
                title: "Seguro e isolado",
                desc: "Cada restaurante é um tenant isolado. Seus dados nunca se misturam com outros.",
              },
              {
                icon: Zap,
                title: "Sem complicação",
                desc: "Cadastre seu restaurante em minutos. Sem código, sem instalação, sem trava.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-cyan-500/20 hover:bg-cyan-500/[0.03]"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-cyan-500/10">
                  <f.icon className="size-5 text-cyan-400" />
                </div>
                <h3 className="text-base font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Como funciona</h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Em 4 passos simples, seu restaurante está online.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Crie sua conta",
                desc: "Acesse a plataforma e cadastre seu restaurante com nome e identificador.",
              },
              {
                step: "02",
                title: "Monte o cardápio",
                desc: "Adicione categorias, produtos, preços e fotos. Tudo pelo painel intuitivo.",
              },
              {
                step: "03",
                title: "Publique",
                desc: "Publique seu cardápio. Ele ficará disponível na URL personalizada.",
              },
              {
                step: "04",
                title: "Compartilhe",
                desc: "Envie o link via WhatsApp, gere QR Code e comece a receber pedidos.",
              },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-lg font-bold text-cyan-400">
                  {s.step}
                </div>
                <h3 className="text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Sobre o MenuFácil</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
            O MenuFácil nasceu da necessidade de oferecer uma plataforma simples e
            profissional para restaurantes que querem digitalizar seu cardápio. Acreditamos
            que todo restaurante merece uma presença digital elegante, sem precisar investir
            em desenvolvimento caro.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-gray-400">
            Nossa missão é tornar o acesso ao cardápio do restaurante uma experiência
            moderna, rápida e agradável — tanto para o dono do restaurante quanto para
            o cliente final.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Pronto para começar?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            Crie seu cardápio digital em minutos. Sem cartão de crédito, sem compromisso.
          </p>
          <div className="mt-10">              <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-10 py-4 text-base font-bold text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_40px_rgba(34,211,238,0.4)]"
            >
              Criar meu cardápio agora
              <ChevronRight className="size-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="size-5 text-cyan-400" />
              <span className="text-sm font-semibold text-gray-400">
                Menu<span className="text-cyan-400">Fácil</span>
              </span>
            </div>

            <div className="flex gap-6 text-xs text-gray-500">
              <a href="#about" className="hover:text-gray-300 transition-colors">
                Sobre
              </a>
              <a href="#" className="hover:text-gray-300 transition-colors">
                Termos de Uso
              </a>
              <a href="#" className="hover:text-gray-300 transition-colors">
                Política de Privacidade
              </a>
              <a href="#" className="hover:text-gray-300 transition-colors">
                Contato
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-gray-600">
            © {new Date().getFullYear()} MenuFácil. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
