import { useState } from "react";
import { ArrowLeft, Gift, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/modules/cidadela-core/store";

type DiscountTier = {
  points: number;
  percentage: number;
};

export function DescontosConfig({ onBack }: { onBack: () => void }) {
  const { state, update } = useStore();
  const [tiers, setTiers] = useState<DiscountTier[]>(
    state.admin.discountTiers || [
      { points: 100, percentage: 5 },
      { points: 500, percentage: 10 },
      { points: 1000, percentage: 15 },
    ]
  );

  function addTier() {
    setTiers([...tiers, { points: 0, percentage: 0 }]);
  }

  function removeTier(index: number) {
    const newTiers = tiers.filter((_, i) => i !== index);
    setTiers(newTiers);
  }

  function updateTier(index: number, field: keyof DiscountTier, value: number) {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  }

  function saveDiscounts() {
    update((prev) => ({
      ...prev,
      admin: {
        ...prev.admin,
        discountTiers: tiers,
      },
    }));
    alert("Configurações de descontos salvas!");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-lg border border-border bg-slate-800 p-2 text-gray-400 hover:border-[color:var(--brass)] hover:text-[color:var(--brass)] transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-stencil text-xl text-white">Configurar Descontos</h2>
          <p className="text-tech text-xs text-gray-400">Defina descontos baseados em pontos de soberania</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-slate-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gift className="size-5 text-green-400" />
              <h3 className="text-sm font-medium text-white">Tiers de Desconto</h3>
            </div>
            <button
              onClick={addTier}
              className="flex items-center gap-2 rounded-lg bg-green-700 px-3 py-2 text-xs font-medium text-white hover:bg-green-600 transition-colors"
            >
              <Plus className="size-4" />
              Adicionar Tier
            </button>
          </div>

          <div className="space-y-3">
            {tiers.map((tier, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg bg-slate-900 p-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Pontos necessários</label>
                  <input
                    type="number"
                    value={tier.points}
                    onChange={(e) => updateTier(index, "points", parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-border bg-slate-800 px-3 py-2 text-sm text-white focus:border-[color:var(--brass)] focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Desconto (%)</label>
                  <input
                    type="number"
                    value={tier.percentage}
                    onChange={(e) => updateTier(index, "percentage", parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-border bg-slate-800 px-3 py-2 text-sm text-white focus:border-[color:var(--brass)] focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => removeTier(index)}
                  className="mt-5 rounded p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={saveDiscounts}
          className="w-full rounded-lg bg-[color:var(--brass)] px-4 py-3 text-sm font-medium text-white hover:bg-[color:var(--olive)] transition-colors"
        >
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}
