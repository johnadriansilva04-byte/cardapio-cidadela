import { Settings, LayoutGrid, Sandwich, ClipboardList, Percent } from "lucide-react";

export type AdminScreen =
  | "menu"
  | "config"
  | "categorias"
  | "lanches"
  | "pedidos"
  | "descontos";

const modules: { id: AdminScreen; label: string; icon: typeof Settings }[] = [
  { id: "config", label: "Configuração Operacional", icon: Settings },
  { id: "categorias", label: "Gerenciar Categorias", icon: LayoutGrid },
  { id: "lanches", label: "Gerenciar Lanches", icon: Sandwich },
  { id: "pedidos", label: "Gerenciar Pedidos", icon: ClipboardList },
  { id: "descontos", label: "Configurar Descontos", icon: Percent },
];

export default function MenuPrincipal({
  onSelect,
  status,
}: {
  onSelect: (screen: AdminScreen) => void;
  status: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-semibold text-[color:var(--color-tech)]">{status}</p>
      {modules.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className="ember-glow flex w-full items-center gap-3 rounded-xl border border-[color:var(--color-brass)]/40 bg-black/60 px-4 py-3 text-left text-sm font-semibold text-white"
        >
          <m.icon className="size-5 text-[color:var(--color-brass)]" />
          {m.label}
        </button>
      ))}
    </div>
  );
}
