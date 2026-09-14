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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0b0b12] shadow-[0_24px_80px_rgba(0,0,0,0.7)] sm:rounded-[24px]">
        {/* header image */}
        <div className="relative h-28 shrink-0 overflow-hidden sm:h-32">
          {product.image_url ? (
            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background: `radial-gradient(600px 220px at 30% 20%, ${hexToRgba(accent, 0.28)} 0%, transparent 60%), linear-gradient(135deg, #0a0a14 0%, #07070b 100%)`,
              }}
            >
              <UtensilsCrossed className="size-8 opacity-40" style={{ color: accent }} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b12] via-[#0b0b12]/40 to-black/10" />
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur hover:bg-black/60"
          >
            <X className="size-4" />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/80 backdrop-blur">
              <Sparkles className="size-3" style={{ color: accent }} /> Adicionais • {product.name}
            </p>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <h2 className="text-base font-black tracking-tight text-white sm:text-lg">Turbinar seu {product.name}?</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Escolha os adicionais — cada um soma ao valor do lanche. Se não quiser, é só confirmar direto.
          </p>

          {available.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
              <p className="text-sm font-semibold text-gray-400">Sem adicionais para este item</p>
              <p className="mt-1 text-xs text-gray-600">O restaurante ainda não configurou adicionais aqui.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {available.map((a) => {
                const active = selected.has(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all sm:px-4 ${
                      active
                        ? "border-white/0 bg-white text-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                        : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        active ? "border-zinc-900 bg-zinc-900 text-white" : "border-white/20 bg-transparent text-transparent"
                      }`}
                    >
                      {active ? <Plus className="size-3.5" /> : <Minus className="size-3 opacity-0" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-bold ${active ? "text-zinc-900" : "text-white"}`}>{a.name}</span>
                      <span className={`block text-xs ${active ? "text-zinc-600" : "text-gray-500"}`}>
                        {active ? "adicionado ✓" : "toque para adicionar"}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                        active ? "bg-zinc-900 text-white" : "border border-white/10 bg-black/20 text-white"
                      }`}
                      style={!active ? { borderColor: hexToRgba(accent, 0.35), color: accent, backgroundColor: hexToRgba(accent, 0.12) } : undefined}
                    >
                      + {brl(Number(a.price))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-semibold text-gray-400">Observação (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem cebola, bem passado, caprichar no molho…"
              rows={2}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
            />
          </div>

          {/* resumo */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{product.name}</span>
              <span>{brl(Number(product.price))}</span>
            </div>
            {selected.size > 0 && (
              <div className="mt-1.5 space-y-1 border-t border-white/5 pt-2 text-xs">
                {available
                  .filter((a) => selected.has(a.id))
                  .map((a) => (
                    <div key={a.id} className="flex justify-between text-gray-300">
                      <span>+ {a.name}</span>
                      <span className="font-semibold">{brl(Number(a.price))}</span>
                    </div>
                  ))}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Total da unidade</span>
              <span className="text-sm font-black text-white" style={{ color: selected.size > 0 ? accent : undefined }}>
                {brl(unitTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="shrink-0 border-t border-white/10 bg-[#0b0b12] p-4 sm:p-5">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-full border border-white/10 bg-white/[0.04] py-3 text-sm font-bold text-gray-300 hover:bg-white/[0.07]"
            >
              Cancelar
            </button>
            <button
              onClick={confirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ backgroundColor: accent, boxShadow: `0 10px 28px ${hexToRgba(accent, 0.4)}` }}
            >
              <ShoppingBag className="size-4" />
              {selected.size === 0 ? "Adicionar sem adicionais" : `Adicionar • ${brl(unitTotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
