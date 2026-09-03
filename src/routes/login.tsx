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
} from "lucide-react";
import {
  signInWithPhone,
  signUpWithPhone,
  isSupabaseConfigured,
} from "@/modules/supabase/auth";
import { useAuth } from "@/components/AuthProvider";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar — MenuFácil" }],
  }),
  component: LoginPage,
});

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
    if (digits.length <= 7)
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
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
      return;
    }

    if (password.length < 6) {
      setErrorMsg("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (mode === "register" && !name.trim()) {
      setErrorMsg("Informe seu nome");
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
          setLoading(false);
          return;
        }

        if (session) {
          navigate({ to: returnTo as "/", replace: true });
        }
      } else {
        const { user, error } = await signUpWithPhone(
          digits,
          password,
          name.trim(),
        );
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
          setLoading(false);
          return;
        }

        if (user) {
          if (user.identities?.length === 0) {
            setErrorMsg("Este telefone já está cadastrado. Faça login.");
            setLoading(false);
            return;
          }

          // Registration successful — try auto-login
          const { session: newSession, error: loginError } =
            await signInWithPhone(digits, password);
          if (loginError || !newSession) {
            setMode("login");
            setErrorMsg("Conta criada! Tente fazer login.");
            setLoading(false);
            return;
          }

          navigate({ to: returnTo as "/", replace: true });
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setErrorMsg("Erro inesperado. Tente novamente.");
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
          <h1 className="text-xl font-bold text-white">
            Supabase não configurado
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Configure as variáveis de ambiente{" "}
            <code className="text-cyan-400">VITE_SUPABASE_URL</code> e{" "}
            <code className="text-cyan-400">VITE_SUPABASE_ANON_KEY</code> nas
            configurações do projeto.
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <UtensilsCrossed className="size-8 text-cyan-400" />
            <span className="text-2xl font-bold tracking-tight">
              Menu<span className="text-cyan-400">Fácil</span>
            </span>
          </Link>
          <p className="mt-3 text-sm text-gray-500">
            {mode === "login"
              ? "Entre na sua conta para gerenciar seus restaurantes"
              : "Crie sua conta para começar"}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          {/* Error message */}
          {errorMsg && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field (register only) */}
            {mode === "register" && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-xs font-medium text-gray-400"
                >
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
              <label
                htmlFor="phone"
                className="mb-1.5 block text-xs font-medium text-gray-400"
              >
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
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
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
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 py-3 text-sm font-bold text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Entrar" : "Criar conta"}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle login/register */}
          <div className="mt-6 text-center">
            {mode === "login" ? (
              <p className="text-sm text-gray-500">
                Não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setErrorMsg("");
                  }}
                  className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Cadastre-se
                </button>
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMsg("");
                  }}
                  className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Entrar
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Back to home */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            ← Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
