import { useState } from "react";
import { ChevronDown, LogOut, UserRound, ExternalLink, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/components/AuthProvider";
import { deleteAccount } from "@/modules/supabase/auth";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  displayName: string;
  onNavigate?: () => void;
  showDelete?: boolean;
  className?: string;
}

export function AccountMenu({
  displayName,
  onNavigate,
  showDelete = true,
  className,
}: AccountMenuProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initials = displayName
    ? displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
    : "AD";

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login", replace: true });
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteAccount();
    setDeleting(false);
    if (!res.ok) {
      setConfirmDeleteOpen(false);
      return;
    }
    navigate({ to: "/login", replace: true });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] data-[state=open]:bg-white/[0.06] outline-none",
            className,
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/20 text-xs font-bold text-cyan-200 ring-1 ring-white/10">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-gray-200">
              {displayName || "Conta"}
            </span>
            <span className="block truncate text-[10px] text-gray-600">Administrador</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-gray-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={6}
          className="min-w-[200px] border-white/10 bg-[#14141d] text-gray-200 shadow-2xl"
        >
          <DropdownMenuLabel className="text-xs font-semibold text-gray-500">
            Minha conta
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => {
              onNavigate?.();
              navigate({ to: "/admin/config", hash: "conta" });
            }}
            className="cursor-pointer gap-2.5 py-2 text-sm focus:bg-white/[0.06] focus:text-white"
          >
            <UserRound className="size-4 text-cyan-400" /> Editar conta
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              onNavigate?.();
              window.open("/", "_blank");
            }}
            className="cursor-pointer gap-2.5 py-2 text-sm focus:bg-white/[0.06] focus:text-white"
          >
            <ExternalLink className="size-4 text-gray-400" /> Ver site público
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.08]" />
          <DropdownMenuItem
            onSelect={handleSignOut}
            className="cursor-pointer gap-2.5 py-2 text-sm focus:bg-white/[0.06] focus:text-white"
          >
            <LogOut className="size-4 text-gray-400" /> Sair da conta
          </DropdownMenuItem>
          {showDelete && (
            <DropdownMenuItem
              onSelect={() => {
                onNavigate?.();
                setConfirmDeleteOpen(true);
              }}
              className="cursor-pointer gap-2.5 py-2 text-sm text-red-400 focus:bg-red-500/10 focus:text-red-300"
            >
              <Trash2 className="size-4" /> Excluir conta
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir conta?"
        description="Todos os seus restaurantes, cardápios e pedidos serão apagados permanentemente. Não há como desfazer."
        confirmLabel="Sim, excluir"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
