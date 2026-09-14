import { useState, useMemo } from "react";
import { X, Plus, Minus, Sparkles, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { brl, hexToRgba } from "@/lib/utils";
import type { Product, ProductAddon, SelectedAddon } from "@/lib/types";

export default function ProductAddonsModal({
  product,
  addons,
  accent = "#06b6d4",
  onClose,
  onConfirm,
}: {
  product: Product;
  addons: ProductAddon[];
  accent?: string;
  onClose: () => void;
  onConfirm: (selected: SelectedAddon[], notes: string) => void;
}) {
  const available = useMemo(() => addons.filter((a) => a.available), [addons]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  const selectedTotal = useMemo(() => {
    let s = 0;
    for (const a of available) if (selected.has(a.id)) s += Number(a.price);
    return s;
  }, [selected, available]);

  const unitTotal = Number(product.price) + selectedTotal;

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function confirm() {
    const list: SelectedAddon[] = available
      .filter((a) => selected.has(a.id))
      .map((a) => ({ addon_id: a.id, name: a.name, price: Number(a.price) }));
    onConfirm(list, notes.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-end sm:justify-end sm:p-4">
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-t-[20px] border border-white/10 bg-[#0b0b12] shadow-[0_20px_60px_rgba(0,0,0,0.6)] sm:rounded-[20px] sm:max-w-xs">
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#0b0b12]">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" style={{ color: accent }} />
            <h3 className="text-sm font-bold text-white">Adicionais</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-7 place-items-center rounded-full border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-xs text-gray-400 mb-3">Escolha os adicionais para {product.name}:</p>

          {available.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center">
              <p className="text-xs font-semibold text-gray-400">Sem adicionais disponíveis</p>
            </div>
          ) : (
            <div className="space-y-2">
              {available.map((a) => {
                const active = selected.has(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                      active
                        ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                        : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06] text-white"
                    }`}
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        active ? "border-cyan-500 bg-cyan-500 text-white" : "border-white/20 bg-transparent text-transparent"
                      }`}
                    >
                      {active ? <Plus className="size-3" /> : <Minus className="size-2.5 opacity-0" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold">{a.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold" style={{ color: active ? accent : undefined }}>
                      +{brl(Number(a.price))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-semibold text-gray-400">Obs (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem cebola..."
              rows={1}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none"
            />
          </div>

          {/* resumo compacto */}
          {selected.size > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>Base: {brl(Number(product.price))}</span>
                <span>Adicionais: {brl(selectedTotal)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-1">
                <span className="text-[10px] font-bold text-gray-300">Total</span>
                <span className="text-xs font-black text-white" style={{ color: accent }}>
                  {brl(unitTotal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="shrink-0 border-t border-white/10 bg-[#0b0b12] px-4 py-3">
          <button
            onClick={confirm}
            className="w-full rounded-lg py-2.5 text-xs font-black text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: accent }}
          >
            {selected.size === 0 ? "Confirmar sem adicionais" : `Confirmar • ${brl(unitTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
