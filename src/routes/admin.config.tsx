import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  User,
  KeyRound,
  LogOut,
  Trash2,
  UserRound,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Camera,
} from "lucide-react";
import {
  updateProfileName,
  updatePassword,
  deleteAccount,
  updateProfileAvatar,
  removeProfileAvatar,
} from "@/modules/supabase/auth";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PageHeader } from "@/modules/ui/PageHeader";
import { ExpandableSection } from "@/modules/ui/ExpandableSection";

export const Route = createFileRoute("/admin/config")({
  head: () => ({ meta: [{ title: "Configurações — Cardápio Cidadela" }] }),
  component: ConfigPage,
});

const field =
  "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";

/**
 * Esta tela é só da conta e do acesso ao painel.
 *
 * Dados da loja (WhatsApp, endereço, PIX, taxa, horários, logo, banner) vivem
 * no cadastro do restaurante, na aba Restaurantes. Instalação do app e alertas
 * ficam na gestão mobile. Nada disso vira atalho aqui: a navegação já está na
 * barra lateral, e repetir na tela só poluía.
 */
function ConfigPage() {
  // O atalho "Editar dados e senha" da gestão mobile chega em #conta.
  const [openAccount] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#conta",
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Configurações" subtitle="Sua conta e o acesso ao painel." />

      <AccountSection defaultOpen={openAccount} />
    </div>
  );
}

function AccountSection({ defaultOpen }: { defaultOpen: boolean }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const displayName = (user?.user_metadata?.name as string) || profile?.name || "";
  const phone = (user?.user_metadata?.phone as string) || profile?.phone || "";
  const avatarUrl = profile?.avatar_url || (user?.user_metadata?.avatar_url as string) || "";

  const [name, setName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initials = displayName
    ? displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
    : "AD";

  useEffect(() => {
    setName((user?.user_metadata?.name as string) || profile?.name || "");
  }, [user, profile]);

  async function handlePickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSavingAvatar(true);
    setAvatarMsg(null);
    const res = await updateProfileAvatar(file);
    if (res.ok) await refreshProfile();
    setSavingAvatar(false);
    setAvatarMsg(
      res.ok
        ? { type: "ok", text: "Foto atualizada!" }
        : { type: "err", text: res.error ?? "Erro ao enviar a foto." },
    );
    if (res.ok) setTimeout(() => setAvatarMsg(null), 3000);
  }

  async function handleRemoveAvatar() {
    setSavingAvatar(true);
    setAvatarMsg(null);
    const res = await removeProfileAvatar();
    if (res.ok) await refreshProfile();
    setSavingAvatar(false);
    setAvatarMsg(
      res.ok
        ? { type: "ok", text: "Foto removida." }
        : { type: "err", text: res.error ?? "Erro ao remover a foto." },
    );
    if (res.ok) setTimeout(() => setAvatarMsg(null), 3000);
  }

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
    <div id="conta" className="scroll-mt-6 space-y-4">
      <ExpandableSection
        icon={<User className="size-5" />}
        title="Dados da conta"
        summary={displayName || "Nome e telefone do acesso"}
        defaultOpen={defaultOpen}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="size-14 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/20 ring-1 ring-white/10">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Foto de perfil" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-base font-bold text-cyan-200">
                {initials}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={savingAvatar}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {savingAvatar ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Camera className="size-3.5" />
                )}
                {avatarUrl ? "Trocar foto" : "Adicionar foto"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={savingAvatar}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" /> Remover
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-600">JPG, PNG ou WebP · até 5 MB</p>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePickAvatar}
          />
        </div>
        {avatarMsg && (
          <p
            className={`mb-3 text-xs ${avatarMsg.type === "ok" ? "text-cyan-300" : "text-red-400"}`}
          >
            {avatarMsg.text}
          </p>
        )}

        <label className="mb-1.5 block text-xs font-medium text-gray-400">Nome</label>
        <div className="flex gap-2">
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
          <button
            onClick={handleSaveName}
            disabled={savingName}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {savingName ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-600">Telefone: {phone || "—"}</p>
        {nameMsg && (
          <p
            className={`mt-1.5 text-xs ${nameMsg.type === "ok" ? "text-cyan-300" : "text-red-400"}`}
          >
            {nameMsg.text}
          </p>
        )}
      </ExpandableSection>

      <ExpandableSection
        icon={<KeyRound className="size-5" />}
        title="Alterar senha"
        summary="Troque a senha de acesso ao painel"
        defaultOpen={defaultOpen}
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">Senha atual</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                className={field + " pr-10"}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
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
        </div>
        {pwdMsg && (
          <p className={`mt-2 text-xs ${pwdMsg.type === "ok" ? "text-cyan-300" : "text-red-400"}`}>
            {pwdMsg.text}
          </p>
        )}
        <button
          onClick={handleSavePwd}
          disabled={savingPwd || !currentPwd || !newPwd}
          className="mt-3 w-full rounded-lg bg-white/5 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          {savingPwd ? "Alterando..." : "Alterar senha"}
        </button>
      </ExpandableSection>

      <ExpandableSection
        icon={<UserRound className="size-5" />}
        tone="red"
        title="Ações da conta"
        summary="Sair ou excluir a conta"
      >
        <div className="space-y-2">
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
      </ExpandableSection>

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
