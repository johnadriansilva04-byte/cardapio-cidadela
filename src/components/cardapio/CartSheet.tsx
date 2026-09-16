import { X, Minus, Plus, ShoppingBag, Sparkles } from "lucide-react";
import type { Product, SelectedAddon } from "@/lib/types";
import { brl, hexToRgba } from "@/lib/utils";

interface CartLine {
  item: Product;
  qty: number;
  addons: SelectedAddon[];
  notes: string;
  unitPrice: number;
  lineTotal: number;
}

export default function CartSheet({
  lines,
  subtotal,
  accent = "#06b6d4",
  onInc,
  onDec,
  onClose,
  onCheckout,
}: {
  lines: CartLine[];
  subtotal: number;
  accent?: string;
  onInc: (product: Product, addons: SelectedAddon[]) => void;
  onDec: (product: Product, addons: SelectedAddon[]) => void;
  onClose: () => void;
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[24px] border border-white/10 bg-[#0b0b12] sm:rounded-[24px]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0b0b12]/90 px-5 py-4 backdrop-blur">
          <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-white">
            <span className="grid size-8 place-items-center rounded-xl text-white" style={{ backgroundColor: accent }}>
              <ShoppingBag className="size-4" />
            </span>
            Seu pedido
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/80">{lines.reduce((s,l)=>s+l.qty,0)} {lines.reduce((s,l)=>s+l.qty,0)===1?"item":"itens"}</span>
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar carrinho"
            className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5">
          {lines.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/[0.04] text-gray-600">
                <ShoppingBag className="size-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-400">Carrinho vazio</p>
              <p className="mt-1 text-xs text-gray-500">Adicione itens do cardápio para continuar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const key = `${line.item.id}-${line.addons.map(a=>a.addon_id).sort().join(",")}-${idx}`;
                const addonsPrice = line.addons.reduce((s,a)=>s+Number(a.price),0);
                return (
                  <div
                    key={key}
                    className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]"
                  >
                    <div className="flex items-start gap-3 p-3">
                      {line.item.image_url ? (
                        <div className="aspect-square size-14 shrink-0 overflow-hidden rounded-xl">
                          <img src={line.item.image_url} alt="" className="size-full object-cover" />
                        </div>
                      ) : (
                        <div className="grid size-14 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-gray-600">🍔</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{line.item.name}</p>
                        <p className="text-xs text-gray-500">
                          {brl(Number(line.item.price))}{addonsPrice>0 && <span className="text-violet-300"> + {brl(addonsPrice)} adicionais</span>} • <span className="font-bold" style={{color:accent}}>{brl(line.unitPrice)} /un</span>
                        </p>
                        {line.addons.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {line.addons.map((a) => (
                              <span key={a.addon_id} className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-200">
                                <Sparkles className="size-3" /> {a.name} <span className="font-black">+{brl(Number(a.price))}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {line.notes && (
                          <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] leading-relaxed text-amber-200/80">
                            Obs.: {line.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <div
                        className="flex items-center gap-1.5 rounded-full border p-1"
                        style={{
                          borderColor: hexToRgba(accent, 0.35),
                          backgroundColor: hexToRgba(accent, 0.1),
                        }}
                      >
                        <button
                          onClick={() => onDec(line.item, line.addons)}
                          className="grid size-7 place-items-center rounded-full bg-black/50 hover:bg-black/70"
                          aria-label="Diminuir"
                        >
                          <Minus className="size-3.5 text-white" />
                        </button>
                        <span className="w-6 text-center text-sm font-black text-white">{line.qty}</span>
                        <button
                          onClick={() => onInc(line.item, line.addons)}
                          className="grid size-7 place-items-center rounded-full transition-colors hover:brightness-110"
                          style={{ backgroundColor: accent }}
                          aria-label="Aumentar"
                        >
                          <Plus className="size-3.5 text-white" />
                        </button>
                      </div>
                      <span className="text-sm font-black text-white">{brl(line.lineTotal)}</span>
                    </div>
                  </div>
                );
              })}

              <div
                className="rounded-2xl border bg-white/[0.03] px-4 py-3"
                style={{ borderColor: hexToRgba(accent, 0.18) }}
              >
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Subtotal ({lines.reduce((s,l)=>s+l.qty,0)} itens)</span>
                  <span className="font-semibold text-white">{brl(subtotal)}</span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">Taxa de entrega calculada no próximo passo</p>
                <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-sm font-black text-white">
                  <span>Total parcial</span>
                  <span style={{ color: accent }}>{brl(subtotal)}</span>
                </div>
              </div>

              <button
                onClick={onCheckout}
                className="w-full rounded-full py-3.5 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 10px 28px ${hexToRgba(accent, 0.45)}`,
                }}
              >
                Continuar • {brl(subtotal)}
              </button>
              <p className="text-center text-[11px] text-gray-500">Você poderá escolher entrega ou retirada no próximo passo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
