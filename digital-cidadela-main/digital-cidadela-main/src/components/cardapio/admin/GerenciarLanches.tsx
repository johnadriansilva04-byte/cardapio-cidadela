import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { useStore } from "@/modules/core/store";
import { brl } from "@/modules/core/utils";

export default function GerenciarLanches() {
  const categories = useStore((s) => s.categories);
  const update = useStore((s) => s.update);
  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");

  const field =
    "w-full rounded-lg border border-red-500/30 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-red-500 focus:outline-none";

  const current = categories.find((c) => c.id === catId);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatId(c.id)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              catId === c.id
                ? "border-[color:var(--color-brass)] bg-[color:var(--color-brass)]/20 text-[color:var(--color-brass)]"
                : "border-red-500/30 bg-black/50 text-gray-400"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {current && (
        <>
          <input
            className={field}
            placeholder="Nome do lanche"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={field}
            placeholder="Descrição (opcional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <input
            className={field}
            placeholder="Preço"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <button
            onClick={() => {
              const value = Number(price.replace(",", "."));
              if (!name.trim() || !value) return;
              update((s) => {
                const cat = s.categories.find((c) => c.id === catId);
                cat?.items.push({
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  desc: desc.trim(),
                  price: value,
                  img: "",
                });
              });
              setName("");
              setDesc("");
              setPrice("");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--color-brass)] py-2 text-sm font-bold text-black"
          >
            <Plus className="size-4" /> Adicionar lanche
          </button>

          {current.items.map((i) => (
            <div
              key={i.id}
              className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-black/40 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{i.name}</p>
                <p className="truncate text-xs text-gray-400">{i.desc}</p>
              </div>
              <span className="text-sm font-bold text-[color:var(--color-brass)]">
                {brl(i.price)}
              </span>
              <button
                onClick={() =>
                  update((s) => {
                    const cat = s.categories.find((c) => c.id === catId);
                    if (cat) cat.items = cat.items.filter((x) => x.id !== i.id);
                  })
                }
                aria-label="Excluir lanche"
              >
                <Trash2 className="size-4 text-red-500" />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
