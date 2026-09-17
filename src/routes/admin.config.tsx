import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Store,
  User,
  KeyRound,
  LogOut,
  Trash2,
  UserRound,
  Smartphone,
  Save,
  Loader2,
} from "lucide-react";
import { updateProfileName, updatePassword, deleteAccount } from "@/modules/supabase/auth";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { InstallCard } from "@/components/pwa/InstallCard";
import { ExpandableSection } from "@/modules/ui/ExpandableSection";

export const Route = createFileRoute("/admin/config")({
  head: () => ({ meta: [{ title: "Configurações — Cardápio Cidadela" }] }),
  component: ConfigPage,
});

const field =
  "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";

function ConfigPage() {
  // Esta tela é da conta, não do restaurante: dados da loja (contato, endereço,
  // PIX, horários, logo, banner) vivem no cadastro/edição do restaurante.
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sua conta, preferências do app e ações de segurança.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-gray-400">
          <Store className="mt-0.5 size-4 shrink-0 text-gray-500" />
          <span>
            Procurando WhatsApp, endereço, chave PIX, taxa de entrega ou horário de funcionamento?
            Tudo isso fica em{" "}
            <Link
              to="/admin/restaurantes"
              className="font-semibold text-cyan-400 hover:text-cyan-300"
            >
              Restaurantes
            </Link>
            , dentro do cadastro de cada loja.
          </span>
        </p>
      </div>

      <InstallCard />

      <ExpandableSection
        icon={<Smartphone className="size-5" />}
        tone="violet"
        title="Gestão pelo celular"
        summary="Formato compacto de pedidos, feito para usar no balcão"
      >
        <p className="text-xs leading-relaxed text-gray-400">
          A versão mobile mostra os pedidos com resumo recolhido, avança o status em um toque e
          transforma sua tela em um painel de operação.
        </p>
        <Link
          to="/mobile"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Smartphone className="size-3.5" />
          <span>Abrir gestão mobile</span>
        </Link>
      </ExpandableSection>

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
        <p className="mt-0.5 text-sm text-gray-500">
          Edite seus dados de acesso, altere a senha ou exclua a conta.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
          <User className="size-3.5" /> Dados da conta
        </div>

        <div>
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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
            >
              {savingName ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar
            </button>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
            <Smartphone className="size-3" /> Telefone: {phone || "—"}
          </p>
          {nameMsg && (
            <p
              className={`mt-1.5 text-xs ${nameMsg.type === "ok" ? "text-cyan-300" : "text-red-400"}`}
            >
              {nameMsg.text}
            </p>
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
        {pwdMsg && (
          <p className={`text-xs ${pwdMsg.type === "ok" ? "text-cyan-300" : "text-red-400"}`}>
            {pwdMsg.text}
          </p>
        )}
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
