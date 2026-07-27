import { Settings, X } from "lucide-react";
import { useState } from "react";

import { CobraFumando } from "@/components/CobraFumando";
import { ConfigOperacional } from "@/components/cidadela/Config";
import { useStore } from "@/modules/cidadela-core/store";

type Tab = "config" | "pedidos";

const TABS: { id: Tab; label: string }[] = [
  { id: "config", label: "Operacional" },
  { id: "pedidos", label: "Comandas" },
];

export function AdminModal({ onClose }: { onClose: () => void }) {
  const { state, update } = useStore();
  const [tab, setTab] = useState<Tab>("config");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="mx-auto min-h-screen w-full max-w-4xl bg-slate-900 sm:my-6 sm:min-h-0 sm:rounded-2xl sm:border sm:border-border">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <CobraFumando className="size-9 text-[color:var(--brass)]" />
            <div>
              <h2 className="text-stencil text-xl text-white">PAINEL ADMINISTRATIVO</h2>
              <p className="text-tech text-[9px] text-gray-300">
                Gerenciamento do cardápio e operações
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="text-white hover:text-gray-300"
          >
            <X className="size-5" />
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 bg-slate-800">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`text-tech flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[10px] ${
                tab === id
                  ? "bg-[color:var(--olive)] text-white"
                  : "text-gray-300 hover:bg-slate-700"
              }`}
            >
              <Settings className="size-3.5" /> {label}
            </button>
          ))}
        </nav>

        <div className="px-5 py-6 bg-slate-900">
          {tab === "config" && <ConfigOperacional />}
          {tab === "pedidos" && (
            <div className="text-center text-sm text-gray-300">
              Módulo de comandas em desenvolvimento
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
