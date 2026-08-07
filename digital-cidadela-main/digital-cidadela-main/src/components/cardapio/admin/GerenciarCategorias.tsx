import { useState } from "react";
import { Trash2, Pencil, Plus, Check } from "lucide-react";
import { useStore } from "@/modules/core/store";

export default function GerenciarCategorias() {
  const categories = useStore((s) => s.categories);
  const update = useStore((s) => s.update);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const field =
    "w-full rounded-lg border border-red-500/30 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-red-500 focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className={field}
          placeholder="Nova categoria"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={() => {
            if (!name.trim()) return;
            update((s) => {
              s.categories.push({ id: crypto.randomUUID(), name: name.trim(), items: [] });
            });
            setName("");
          }}
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color:var(--color-brass)] text-black"
          aria-label="Adicionar categoria"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {categories.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-black/40 p-3"
        >
          {editing === c.id ? (
            <>
              <input
                className={field}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <button
                onClick={() => {
                  update((s) => {
                    const cat = s.categories.find((x) => x.id === c.id);
                    if (cat) cat.name = editName;
                  });
                  setEditing(null);
                }}
                aria-label="Salvar categoria"
              >
                <Check className="size-4 text-green-400" />
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm font-semibold text-white">{c.name}</span>
              <button
                onClick={() => {
                  setEditing(c.id);
                  setEditName(c.name);
                }}
                aria-label="Editar categoria"
              >
                <Pencil className="size-4 text-gray-400" />
              </button>
              <button
                onClick={() =>
                  update((s) => {
                    s.categories = s.categories.filter((x) => x.id !== c.id);
                  })
                }
                aria-label="Excluir categoria"
              >
                <Trash2 className="size-4 text-red-500" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
