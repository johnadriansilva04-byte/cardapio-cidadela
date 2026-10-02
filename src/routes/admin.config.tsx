import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import {
  User,
  KeyRound,
  LogOut,
  Trash2,
  UserRound,
  Smartphone,
  Share2,
  Save,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { updateProfileName, updatePassword, deleteAccount } from "@/modules/supabase/auth";
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

/** Atalho compacto e quadrado — navega sem ocupar a tela. */
function Shortcut({
  to,
  icon,
  title,
  hint,
  tone,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  hint: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="group flex aspect-square flex-col justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 transition-colors hover:border-cyan-500/25 hover:bg-white/[0.045]"
    >
      <span className={`grid size-9 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-white">{title}</span>
        <span className="block truncate text-[10px] text-gray-500">{hint}</span>
      </span>
    </Link>
  );
}

/**
 * Esta tela é da conta e do app — não do restaurante.
 *
 * Dados da loja (WhatsApp, endereço, PIX, taxa, horários, logo, banner) vivem
 * no cadastro do restaurante, acessível pelo card em Restaurantes → Config.
 * Aqui não repetimos um atalho para lá: a própria aba Restaurantes já é o
 * caminho, e o subtítulo diz onde os dados ficam. A instalação do app vive na
 * gestão mobile, junto dos alertas que ela ativa.
 */
function ConfigPage() {
  // O atalho "Editar dados e senha" da gestão mobile chega em #conta.
  const [openAccount] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#conta",
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Configurações" subtitle="Sua conta e o acesso ao painel." />

      <div className="grid grid-cols-2 gap-2.5">
        <Shortcut
          to="/mobile"
          icon={<Smartphone className="size-4.5 text-emerald-300" />}
          title="Gestão mobile"
          hint="Balcão, alertas e instalação"
          tone="bg-emerald-500/15"
        />
        <Shortcut
          to="/admin/compartilhar"
          icon={<Share2 className="size-4.5 text-violet-300" />}
          title="Compartilhar"
          hint="Link e QR"
          tone="bg-violet-500/15"
        />
      </div>

      <AccountSection defaultOpen={openAccount} />
    </div>
  );
}

function AccountSection({ defaultOpen }: { defaultOpen: boolean }) {
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
    <div id="conta" className="scroll-mt-6 space-y-4">
      <ExpandableSection
        icon={<User className="size-5" />}
        title="Dados da conta"
        summary={displayName || "Nome e telefone do acesso"}
        defaultOpen={defaultOpen}
      >
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
