import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  UtensilsCrossed,
  Phone,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  Check,
  Zap,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { signInWithPhone, signUpWithPhone, isSupabaseConfigured } from "@/modules/supabase/auth";
import { useAuth } from "@/components/AuthProvider";
import { claimGuestData } from "@/modules/supabase/customer";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar — Cardápio Cidadela" }],
  }),
  component: LoginPage,
});

function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4); // 0–4
}

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Read search params manually to avoid required param enforcement
  const searchParams = useMemo(() => {
    if (typeof window === "undefined") return { returnTo: "/admin", error: "" };
    const params = new URLSearchParams(window.location.search);
    return {
      returnTo: params.get("returnTo") || "/admin",
      error: params.get("error") || "",
    };
  }, []);

  const returnTo = searchParams.returnTo;
  const urlError = searchParams.error;

  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(urlError);
  const [errorKey, setErrorKey] = useState(0); // reinicia a animação de shake

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate({ to: returnTo as "/", replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, returnTo]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^\d()\s-]/g, "");
    setPhone(formatPhone(cleaned));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const digits = phone.replace(/\D/g, "");

    if (digits.length < 10) {
      setErrorMsg("Informe um número de telefone válido com DDD");
      setErrorKey((k) => k + 1);
      return;
    }

    if (password.length < 6) {
      setErrorMsg("A senha deve ter no mínimo 6 caracteres");
      setErrorKey((k) => k + 1);
      return;
    }

    if (mode === "register" && !name.trim()) {
      setErrorMsg("Informe seu nome");
      setErrorKey((k) => k + 1);
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { session, error } = await signInWithPhone(digits, password);
        if (error) {
          setErrorMsg(
            error.message.includes("Invalid login")
              ? "Telefone ou senha incorretos"
              : error.message.includes("Email not confirmed")
                ? "Confirme seu e-mail antes de entrar"
                : error.message.includes("Too many requests")
                  ? "Muitas tentativas. Aguarde alguns minutos"
                  : "Erro ao fazer login. Tente novamente",
          );
          setErrorKey((k) => k + 1);
          setLoading(false);
          return;
        }

        if (session) {
          // Traz para a conta o que foi feito como convidado neste aparelho.
          await claimGuestData();
          navigate({ to: returnTo as "/", replace: true });
        }
      } else {
        const { user, error } = await signUpWithPhone(digits, password, name.trim());
        if (error) {
          setErrorMsg(
            error.message.includes("already registered")
              ? "Este telefone já está cadastrado. Faça login."
              : error.message.includes("Password should")
                ? "A senha deve ter no mínimo 6 caracteres"
                : error.message.includes("Unable to validate email")
                  ? "Formato de telefone inválido"
                  : "Erro ao criar conta. Tente novamente",
          );
          setErrorKey((k) => k + 1);
          setLoading(false);
          return;
        }

        if (user) {
          if (user.identities?.length === 0) {
            setErrorMsg("Este telefone já está cadastrado. Faça login.");
            setErrorKey((k) => k + 1);
            setLoading(false);
            return;
          }

          // Registration successful — try auto-login
          const { session: newSession, error: loginError } = await signInWithPhone(digits, password);
          if (loginError || !newSession) {
            setMode("login");
            setErrorMsg("Conta criada! Tente fazer login.");
            setErrorKey((k) => k + 1);
            setLoading(false);
            return;
          }

          // Traz para a conta o que foi feito como convidado neste aparelho.
          await claimGuestData();
          navigate({ to: returnTo as "/", replace: true });
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setErrorMsg("Erro inesperado. Tente novamente.");
      setErrorKey((k) => k + 1);
      setLoading(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-yellow-500/10">
            <AlertCircle className="size-6 text-yellow-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Supabase não configurado</h1>
          <p className="mt-2 text-sm text-gray-400">
            Configure as variáveis de ambiente{" "}
            <code className="text-cyan-400">VITE_SUPABASE_URL</code> e{" "}
            <code className="text-cyan-400">VITE_SUPABASE_ANON_KEY</code> nas configurações do
            projeto.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 transition-colors"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  const pwScore = mode === "register" ? passwordScore(password) : 0;
  const pwLabel = ["Muito fraca", "Fraca", "Ok", "Forte", "Excelente"][pwScore];
  const pwColor = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#06b6d4"][pwScore];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-12">
      {/* Fundo vivo: orbes de luz */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-1/4 size-72 rounded-full bg-cyan-500/10 blur-[90px] animate-pulse-slow" />
        <div className="absolute -right-16 bottom-1/4 size-64 rounded-full bg-violet-500/10 blur-[80px] animate-float" />
      </div>

      <div className="relative z-10 grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2">
        {/* Lado esquerdo — só desktop: pitch da plataforma */}
        <div className="hidden lg:block animate-slide-up">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3.5 py-1.5">
            <Zap className="size-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-300">Plataforma para restaurantes</span>
          </div>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-white">
            Seu cardápio,
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              vivo a cada pedido.
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-gray-400">
            Pedidos em tempo real, PIX instantâneo e isolamento total entre restaurantes — tudo
            neste painel.
          </p>
          <ul className="mt-8 space-y-3.5">
            {[
              { icon: Zap, text: "Pedidos chegam ao painel em tempo real" },
              { icon: BarChart3, text: "Faturamento e ticket médio calculados dos pedidos reais" },
              { icon: ShieldCheck, text: "Cada restaurante com dados isolados" },
            ].map((f, i) => (
              <li
                key={f.text}
                className="flex items-center gap-3 animate-slide-up"
                style={{ animationDelay: `${120 * (i + 1)}ms` }}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-cyan-500/25 bg-cyan-500/10">
                  <f.icon className="size-4 text-cyan-400" />
                </span>
                <span className="text-sm font-medium text-gray-300">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Lado direito — card de auth */}
        <div className="w-full max-w-md justify-self-center animate-pop-in">
          {/* Logo */}
          <div className="mb-8 text-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="grid size-10 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_18px_rgba(34,211,238,0.25)]">
                <UtensilsCrossed className="size-5 text-cyan-400" />
              </span>
              <span className="text-2xl font-black tracking-tight text-white">
                Cardápio <span className="text-cyan-400">Cidadela</span>
              </span>
            </Link>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8">
            {/* Toggle login/register vivo */}
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-black/30 p-1">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setErrorMsg("");
                  }}
                  className={`rounded-lg py-2 text-sm font-bold transition-all ${
                    mode === m
                      ? "bg-cyan-500 text-black shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {m === "login" ? "Entrar" : "Criar conta"}
                </button>
              ))}
            </div>

            {/* Error message com shake */}
            {errorMsg && (
              <div
                key={errorKey}
                className="mb-4 flex animate-shake items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field (register only) */}
              {mode === "register" && (
                <div className="animate-slide-up">
                  <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-gray-400">
                    Seu nome
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-600" />
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    />
                  </div>
                </div>
              )}

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="mb-1.5 block text-xs font-medium text-gray-400">
                  Telefone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-600" />
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="(11) 99999-9999"
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-medium text-gray-400"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-600" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                {/* Medidor de força da senha (cadastro) */}
                {mode === "register" && password.length > 0 && (
                  <div className="mt-2 animate-slide-up">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor:
                              pwScore > i ? pwColor : "rgba(255,255,255,0.08)",
                            boxShadow: pwScore > i ? `0 0 8px ${pwColor}66` : undefined,
                          }}
                        />
                      ))}
                    </div>
                    <p
                      className="mt-1.5 text-[11px] font-semibold"
                      style={{ color: pwColor }}
                    >
                      {pwLabel}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 py-3 text-sm font-bold text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_24px_rgba(34,211,238,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {mode === "login" ? "Entrando..." : "Criando conta..."}
                  </>
                ) : (
                  <>
                    {mode === "login" ? "Entrar" : "Criar conta"}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Back to home */}
          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-xs text-gray-600 transition-colors hover:text-gray-400"
            >
              ← Voltar ao site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
