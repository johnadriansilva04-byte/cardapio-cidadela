import { Store, Utensils, Settings, Receipt } from "lucide-react";

export function MenuPrincipal({ onSelectModule }: { onSelectModule: (module: string) => void }) {
  const modules = [
    { id: "config", label: "Configurações da Loja", icon: Settings, color: "text-[color:var(--brass)]" },
    { id: "categorias", label: "Gerenciar Categorias", icon: Store, color: "text-[color:var(--olive)]" },
    { id: "lanches", label: "Gerenciar Lanches", icon: Utensils, color: "text-[color:var(--brass)]" },
    { id: "pedidos", label: "Pedidos / Comandas", icon: Receipt, color: "text-gray-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-stencil text-2xl text-white">PAINEL ADMINISTRATIVO</h2>
        <p className="text-tech text-xs text-gray-400">Selecione o módulo desejado</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => onSelectModule(module.id)}
            className="group relative rounded-xl border border-border bg-slate-800 p-6 text-left hover:border-[color:var(--brass)] hover:bg-slate-700 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className={`rounded-lg bg-slate-900 p-3 ${module.color}`}>
                <module.icon className="size-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white group-hover:text-[color:var(--brass)] transition-colors">
                  {module.label}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {module.id === "config" && "Nome, slogan, PIX, WhatsApp"}
                  {module.id === "categorias" && "Adicionar, editar, remover categorias"}
                  {module.id === "lanches" && "Adicionar, editar, remover produtos"}
                  {module.id === "pedidos" && "Visualizar e gerenciar pedidos"}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
