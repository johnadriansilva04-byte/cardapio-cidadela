import { Plus, Trash2, Edit2, ArrowLeft, Save } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/modules/cidadela-core/store";

export function GerenciarLanches({ onBack }: { onBack: () => void }) {
  const { state, update } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
  });

  const category = state.categories.find((c) => c.id === selectedCategory);

  function handleAddItem() {
    if (!selectedCategory || !newItem.name.trim() || !newItem.price) return;
    update((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === selectedCategory
          ? {
              ...c,
              items: [
                ...c.items,
                {
                  id: crypto.randomUUID(),
                  name: newItem.name.trim(),
                  description: newItem.description.trim(),
                  price: parseFloat(newItem.price) || 0,
                  available: true,
                },
              ],
            }
          : c
      ),
    }));
    setNewItem({ name: "", description: "", price: "" });
  }

  function handleDeleteItem(itemId: string) {
    update((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === selectedCategory
          ? { ...c, items: c.items.filter((i) => i.id !== itemId) }
          : c
      ),
    }));
  }

  function handleUpdateItem(itemId: string, updates: Partial<typeof newItem>) {
    update((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === selectedCategory
          ? {
              ...c,
              items: c.items.map((i) =>
                i.id === itemId
                  ? {
                      ...i,
                      ...(updates.name && { name: updates.name.trim() }),
                      ...(updates.description !== undefined && { description: updates.description.trim() }),
                      ...(updates.price && { price: parseFloat(updates.price) || 0 }),
                    }
                  : i
              ),
            }
          : c
      ),
    }));
  }

  if (!selectedCategory) {
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
            SELECIONE A CATEGORIA
          </h2>

          <div className="grid gap-2 sm:grid-cols-2">
            {state.categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className="rounded-lg border border-border bg-slate-800 px-4 py-3 text-left hover:border-[color:var(--brass)] hover:bg-slate-700 transition-all"
              >
                <span className="text-sm font-medium text-white">{category.name}</span>
                <span className="block text-xs text-gray-400 mt-1">
                  {category.items.length} itens
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setSelectedCategory(null)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-4" /> Voltar para categorias
      </button>

      <div className="space-y-4">
        <h2 className="text-stencil text-xl text-[color:var(--brass)]">
          {category?.name}
        </h2>

        <div className="rounded-lg border border-border bg-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">Adicionar Lanche</h3>
          <input
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            placeholder="Nome do lanche"
            className="w-full rounded-lg border border-input bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[color:var(--brass)] placeholder:text-gray-500"
          />
          <input
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            placeholder="Descrição (opcional)"
            className="w-full rounded-lg border border-input bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[color:var(--brass)] placeholder:text-gray-500"
          />
          <input
            type="number"
            step="0.01"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            placeholder="Preço"
            className="w-full rounded-lg border border-input bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[color:var(--brass)] placeholder:text-gray-500"
          />
          <button
            onClick={handleAddItem}
            className="w-full rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm font-medium text-[color:var(--matte)] hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Plus className="size-4" /> Adicionar
          </button>
        </div>

        <div className="space-y-2">
          {category?.items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-slate-800 p-4 space-y-3"
            >
              {editingItem === item.id ? (
                <div className="space-y-2">
                  <input
                    defaultValue={item.name}
                    placeholder="Nome"
                    className="w-full rounded border border-input bg-slate-900 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-[color:var(--brass)]"
                  />
                  <input
                    defaultValue={item.description}
                    placeholder="Descrição"
                    className="w-full rounded border border-input bg-slate-900 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-[color:var(--brass)]"
                  />
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={item.price}
                    placeholder="Preço"
                    className="w-full rounded border border-input bg-slate-900 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-[color:var(--brass)]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const inputs = document.querySelectorAll('input');
                        handleUpdateItem(item.id, {
                          name: inputs[0].value,
                          description: inputs[1].value,
                          price: inputs[2].value,
                        });
                        setEditingItem(null);
                      }}
                      className="flex-1 rounded bg-[color:var(--brass)] px-3 py-1 text-xs font-medium text-[color:var(--matte)] hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                    >
                      <Save className="size-3" /> Salvar
                    </button>
                    <button
                      onClick={() => setEditingItem(null)}
                      className="rounded border border-border px-3 py-1 text-xs text-gray-300 hover:bg-slate-700 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-white">{item.name}</span>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                    )}
                    <p className="text-xs text-[color:var(--brass)] mt-1">
                      R$ {item.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingItem(item.id)}
                      className="rounded p-1 text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="rounded p-1 text-gray-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
