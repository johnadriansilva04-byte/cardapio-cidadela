import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { useStore } from "@/modules/core/store";

export default function DescontosConfig() {
  const tiers = useStore((s) => s.admin.discountTiers ?? []);
  const update = useStore((s) => s.update);
  const [points, setPoints] = useState("");
  const [percentage, setPercentage] = useState("");

  const field =
    "w-full rounded-lg border border-red-500/30 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-red-500 focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className={field}
          placeholder="Pontos necessários"
          inputMode="numeric"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
        />
        <input
          className={field}
          placeholder="Desconto (%)"
          inputMode="numeric"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
        />
        <button
          onClick={() => {
            const p = Number(points);
            const pct = Number(percentage);
            if (!p || !pct) return;
            update((s) => {
              s.admin.discountTiers = [...(s.admin.discountTiers ?? []), { points: p, percentage: pct }].sort(
                (a, b) => a.points - b.points,
              );
            });
            setPoints("");
            setPercentage("");
          }}
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color:var(--color-brass)] text-black"
          aria-label="Adicionar tier"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {tiers.map((t, idx) => (
        <div
          key={`${t.points}-${idx}`}
          className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-black/40 p-3"
        >
          <span className="flex-1 text-sm text-white">
            {t.points} pontos = {t.percentage}%
          </span>
          <button
            onClick={() =>
              update((s) => {
                s.admin.discountTiers = (s.admin.discountTiers ?? []).filter((_, i) => i !== idx);
              })
            }
            aria-label="Excluir tier"
          >
            <Trash2 className="size-4 text-red-500" />
          </button>
        </div>
      ))}
    </div>
  );
}
