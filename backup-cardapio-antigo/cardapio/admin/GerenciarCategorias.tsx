import { Plus, Trash2, Edit2, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/modules/cidadela-core/store";

export function GerenciarCategorias({ onBack }: { onBack: () => void }) {
  const { state, update } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  function handleAddCategory() {
    if (!newName.trim()) return;
    update((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        { id: crypto.randomUUID(), name: newName.trim(), items: [] },
      ],
    }));
    setNewName("");
  }

  function handleDeleteCategory(id: string) {
    update((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
    }));
  }

  function handleEditCategory(id: string, name: string) {
    update((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === id ? { ...c, name: name.trim() } : c
      ),
    }));
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-4" /> Voltar
      </button>

      <div className="space-y-4">
        <h2 className="text-stencil text-xl text-[color:var(--brass)]">
          GERENCIAR CATEGORIAS
        </h2>

        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nova categoria"
            className="flex-1 rounded-lg border border-input bg-slate-800 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[color:var(--brass)] placeholder:text-gray-500"
          />
          <button
            onClick={handleAddCategory}
            className="rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm font-medium text-[color:var(--matte)] hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <div className="space-y-2">
          {state.categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-slate-800 px-4 py-3"
            >
              {editingId === category.id ? (
                <input
                  defaultValue={category.name}
                  autoFocus
                  onBlur={(e) => handleEditCategory(category.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleEditCategory(category.id, e.currentTarget.value);
                    }
                  }}
                  className="flex-1 rounded border border-input bg-slate-900 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-[color:var(--brass)]"
                />
              ) : (
                <span className="flex-1 text-sm text-white">{category.name}</span>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingId(category.id)}
                  className="rounded p-1 text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <Edit2 className="size-4" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="rounded p-1 text-gray-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
