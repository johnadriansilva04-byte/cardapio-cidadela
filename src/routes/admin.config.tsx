import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Store,
  AlertCircle,
  RefreshCw,
  User,
  Pencil,
  KeyRound,
  LogOut,
  Trash2,
  UserRound,
  Smartphone,
  Save,
  Loader2,
  Download,
  X,
} from "lucide-react";
import {
  getRestaurantsByOwner,
  ensureRestaurantsForUser,
  updateRestaurant,
} from "@/modules/supabase/restaurants";
import { updateProfileName, updatePassword, deleteAccount } from "@/modules/supabase/auth";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { Restaurant } from "@/lib/types";
import OperatingHoursConfig from "@/components/admin/OperatingHoursConfig";
import {
  DEFAULT_OPERATING_HOURS,
  normalizeOperatingHours,
  serializeHours,
  type OperatingHours,
} from "@/lib/operatingHours";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/config")({
  head: () => ({ meta: [{ title: "Configurações — Cardápio Cidadela" }] }),
  component: ConfigPage,
});

const field =
  "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";

function ConfigPage() {
  const { user, loading: authLoading } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [hours, setHours] = useState<OperatingHours>({ ...DEFAULT_OPERATING_HOURS });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installing, setInstalling] = useState(false);

  const retryRef = useRef(0);

  // Scroll automático ao abrir com #conta (vindo do menu da conta na sidebar)
  useEffect(() => {
    if (window.location.hash === "#conta") {
      requestAnimationFrame(() => {
        document.getElementById("conta")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setShowInstallPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setRestaurants([]);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        await ensureRestaurantsForUser(user!);
        if (cancelled) return;
        const data = await getRestaurantsByOwner(user!.id);
        if (cancelled) return;
        setRestaurants(data);
        if (data.length > 0) {
          retryRef.current = 0;
          const pick = data[0];
          setSelectedId((prev) => prev || pick.id);
          fillFields(pick);
        } else if (retryRef.current < 3) {
          retryRef.current++;
          await new Promise((r) => setTimeout(r, retryRef.current * 400));
          if (cancelled) return;
          const retry = await getRestaurantsByOwner(user!.id);
          if (!cancelled) {
            setRestaurants(retry);
            if (retry.length > 0) {
              setSelectedId((prev) => prev || retry[0].id);
              fillFields(retry[0]);
            }
          }
        }
      } catch (e) {
        console.error("[config] load", e);
        if (!cancelled) setError("Falha ao carregar restaurantes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  function fillFields(r: Restaurant) {
    setWhatsapp(r.whatsapp ?? "");
    setPhone(r.phone ?? "");
    setAddress(r.address ?? "");
    setPixKey(r.pix_key ?? "");
    setHours(normalizeOperatingHours(r.operating_hours as unknown));
  }

  const selected = restaurants.find((r) => r.id === selectedId) ?? restaurants[0] ?? null;

  async function handleSelect(id: string) {
    setSelectedId(id);
    const r = restaurants.find((r) => r.id === id);
    if (r) fillFields(r);
    setMessage("");
  }

  useEffect(() => {
    if (!selectedId && restaurants.length > 0) {
      setSelectedId(restaurants[0].id);
      fillFields(restaurants[0]);
    }
  }, [restaurants, selectedId]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const serialized = serializeHours(hours);
    const ok = await updateRestaurant(selected.id, {
      whatsapp,
      phone,
      address,
      pix_key: pixKey,
      operating_hours: serialized as unknown as never,
    });
    setSaving(false);
    if (ok) {
      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === selected.id ? { ...r, whatsapp, phone, address, pix_key: pixKey, operating_hours: serialized } : r,
        ),
      );
      setMessage("Configurações salvas com sucesso!");
      toast.success("Configurações salvas!");
      setTimeout(() => setMessage(""), 3000);
    } else {
      setMessage("Erro ao salvar. Tente novamente.");
      toast.error("Erro ao salvar.");
    }
  }

  async function handleInstall() {
    setInstalling(true);
    const promptEvent = (window as any).deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        setShowInstallPrompt(false);
      }
      (window as any).deferredPrompt = null;
    }
    setInstalling(false);
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertCircle className="mx-auto size-8 text-red-400" />
        <p className="mt-3 text-sm text-red-300">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"
        >
          <RefreshCw className="size-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
        <Store className="mx-auto size-12 text-gray-700" />
        <p className="mt-4 text-sm text-gray-400">Crie um restaurante primeiro</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500">
          WhatsApp, telefone, endereço, chave PIX e horário de funcionamento
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {restaurants.map((r) => (
          <button
            key={r.id}
            onClick={() => handleSelect(r.id)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              selectedId === r.id
                ? "bg-cyan-500 text-black"
                : "border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* Mobile App Install Banner */}
      {showInstallPrompt && (
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.08] to-violet-500/[0.05] p-5">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-cyan-500/20">
              <Smartphone className="size-6 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-cyan-300">Instalar App Mobile</h3>
              <p className="text-xs text-gray-400 mt-1">
                Baixe o aplicativo de gestão mobile para receber pedidos e gerenciar seu restaurante diretamente do celular.
              </p>
            </div>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="shrink-0 grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-black transition-all hover:bg-cyan-400 disabled:opacity-50"
            >
              {installing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {installing ? "Instalando..." : "Instalar Agora"}
            </button>
            <a
              href="/mobile"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
            >
              <Smartphone className="size-4" />
              Abrir Versão Mobile
            </a>
          </div>
        </div>
      )}

      {selected && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Dados do restaurante</h2>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">WhatsApp do restaurante</label>
              <input
                className={field}
                placeholder="5511999999999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-gray-600">Usado para receber pedidos e compartilhar o link.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Telefone</label>
              <input
                className={field}
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Endereço</label>
              <input
                className={field}
                placeholder="Rua X, 123 - Bairro"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Chave PIX do restaurante</label>
              <input
                className={field}
                placeholder="CPF, telefone, e-mail ou chave aleatória"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-gray-600">Exibida no QR Code ao finalizar pagamento via PIX.</p>
            </div>

            {message && (
              <p className={`text-xs ${message.includes("Erro") ? "text-red-400" : "text-cyan-300"}`}>{message}</p>
            )}

            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50 transition-colors"
            >
              {saving ? "Salvando..." : "Salvar configurações"}
            </button>
          </div>

          <div>
            <OperatingHoursConfig value={hours} onChange={setHours} />
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90">
              💡 Configure como <strong>17:00 — 00:00</strong> e clique em &ldquo;Aplicar em toda a semana&rdquo;. Depois ajuste dias pontuais
              (ex: fechar domingo) sem refazer tudo.
            </p>
          </div>
        </div>
      )}

      {/* Mobile App Section */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/10">
            <Smartphone className="size-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Aplicativo Mobile</h3>
            <p className="text-xs text-gray-400">Gestão de pedidos no celular</p>
          </div>
        </div>
        <div className="space-y-3">
          <a
            href="/mobile"
            target="_blank"
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span>Abrir versão mobile</span>
            <Smartphone className="size-4" />
          </a>
          {!showInstallPrompt && (
            <button
              onClick={() => setShowInstallPrompt(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
            >
              <Download className="size-4" />
              Instalar aplicativo
            </button>
          )}
        </div>
      </div>

      <div className="py-2">
        <div className="my-6 h-px bg-white/[0.06]" />
      </div>

      <AccountSection />
    </div>
  );
}

function AccountSection() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = (user?.user_metadata?.name as string) || profile?.name || "";
  const phone = (user?.user_metadata?.phone as string) || profile?.phone || "";

  const [name, setName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName((user?.user_metadata?.name as string) || profile?.name || "");
  }, [user, profile]);

  async function handleSaveName() {
    setSavingName(true);
    setNameMsg(null);
    const res = await updateProfileName(name);
    setSavingName(false);
    if (!res.ok) {
      setNameMsg({ type: "err", text: res.error ?? "Erro ao salvar." });
      return;
    }
    setNameMsg({ type: "ok", text: "Perfil atualizado!" });
    setTimeout(() => setNameMsg(null), 3000);
  }

  async function handleSavePwd() {
    setSavingPwd(true);
    setPwdMsg(null);
    const res = await updatePassword(currentPwd, newPwd);
    setSavingPwd(false);
    if (!res.ok) {
      setPwdMsg({ type: "err", text: res.error ?? "Erro ao alterar a senha." });
      return;
    }
    setPwdMsg({ type: "ok", text: "Senha alterada com sucesso!" });
    setCurrentPwd("");
    setNewPwd("");
    setTimeout(() => setPwdMsg(null), 3000);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteAccount();
    setDeleting(false);
    if (!res.ok) {
      setPwdMsg({ type: "err", text: res.error ?? "Erro ao excluir a conta." });
      setConfirmDeleteOpen(false);
      return;
    }
    navigate({ to: "/login", replace: true });
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div id="conta" className="max-w-lg space-y-5 scroll-mt-6">
      <div>
        <h2 className="text-lg font-bold text-white">Minha conta</h2>
        <p className="mt-0.5 text-sm text-gray-500">Edite seus dados de acesso, altere a senha ou exclua a conta.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
          <User className="size-3.5" /> Dados da conta
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Nome</label>
          <div className="flex gap-2">
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
            >
              {savingName ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </button>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
            <Smartphone className="size-3" /> Telefone: {phone || "—"}
          </p>
          {nameMsg && (
            <p className={`mt-1.5 text-xs ${nameMsg.type === "ok" ? "text-cyan-300" : "text-red-400"}`}>{nameMsg.text}</p>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
          <KeyRound className="size-3.5" /> Alterar senha
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Senha atual</label>
          <input
            type={showPwd ? "text" : "password"}
            className={field}
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Nova senha</label>
          <input
            type={showPwd ? "text" : "password"}
            className={field}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={showPwd}
            onChange={(e) => setShowPwd(e.target.checked)}
            className="size-3.5 rounded border-white/20 bg-white/10"
          />
          Mostrar senhas
        </label>
        {pwdMsg && <p className={`text-xs ${pwdMsg.type === "ok" ? "text-cyan-300" : "text-red-400"}`}>{pwdMsg.text}</p>}
        <button
          onClick={handleSavePwd}
          disabled={savingPwd || !currentPwd || !newPwd}
          className="w-full rounded-lg bg-white/5 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          {savingPwd ? "Alterando..." : "Alterar senha"}
        </button>
      </div>

      <div className="space-y-2 rounded-2xl border border-red-500/10 bg-red-500/[0.02] p-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-400/80">
          <UserRound className="size-3.5" /> Ações da conta
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <span className="flex items-center gap-2">
            <LogOut className="size-4" /> Sair da conta
          </span>
        </button>
        <button
          onClick={() => setConfirmDeleteOpen(true)}
          className="flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="size-4" /> Excluir conta
          </span>
          <span className="text-[11px] text-gray-600">Apaga tudo</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir conta?"
        description={`Tem certeza? Todos os seus restaurantes, cardápios e pedidos serão apagados permanentemente. Não há como desfazer.`}
        confirmLabel="Sim, excluir"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
