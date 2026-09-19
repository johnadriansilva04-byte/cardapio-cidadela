import { X, Minus, Plus, ShoppingBag, Sparkles, Pencil } from "lucide-react";
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
  onEditAddons,
  onClose,
  onCheckout,
}: {
  lines: CartLine[];
  subtotal: number;
  accent?: string;
  onInc: (product: Product, addons: SelectedAddon[]) => void;
  onDec: (product: Product, addons: SelectedAddon[]) => void;
  onEditAddons?: (cartIndex: number) => void;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0b0b12] shadow-2xl sm:rounded-[24px]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="flex items-center gap-2.5 text-base font-black tracking-tight text-white">
            <span
              className="grid size-8 place-items-center rounded-xl text-white"
              style={{ backgroundColor: accent }}
            >
              <ShoppingBag className="size-4" />
            </span>
            Seu pedido
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/80">
              {totalQty} {totalQty === 1 ? "item" : "itens"}
            </span>
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar carrinho"
            className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {lines.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/[0.04] text-gray-600">
                <ShoppingBag className="size-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-400">Carrinho vazio</p>
              <p className="mt-1 text-xs text-gray-500">
                Adicione itens do cardápio para continuar
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lines.map((line, idx) => {
                const addonsPrice = line.addons.reduce((s, a) => s + Number(a.price), 0);
                return (
                  <div
                    key={`${line.item.id}-${idx}`}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
                  >
                    <div className="flex items-start gap-3">
                      {line.item.image_url ? (
                        <div className="aspect-square size-12 shrink-0 overflow-hidden rounded-lg">
                          <img
                            src={line.item.image_url}
                            alt=""
                            className="size-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="grid size-12 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-gray-600">
                          🍔
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">{line.item.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {brl(Number(line.item.price))}
                          {addonsPrice > 0 && (
                            <span className="text-violet-300/90">
                              {" "}
                              + {brl(addonsPrice)} adicionais
                            </span>
                          )}{" "}
                          <span className="text-gray-600">/un</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-black text-white">
                        {brl(line.lineTotal)}
                      </span>
                    </div>

                    {(line.addons.length > 0 || line.notes) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {line.addons.map((a) => (
                          <span
                            key={a.addon_id}
                            className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-200"
                          >
                            <Sparkles className="size-2.5" /> {a.name} +{brl(Number(a.price))}
                          </span>
                        ))}
                        {line.notes && (
                          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-amber-200/80">
                            {line.notes}
                          </span>
                        )}
                        {onEditAddons && line.addons.length > 0 && (
                          <button
                            onClick={() => onEditAddons(idx)}
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 transition-colors hover:text-gray-300"
                          >
                            <Pencil className="size-2.5" /> editar
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between">
                      <div
                        className="flex items-center gap-1 rounded-full p-0.5"
                        style={{ backgroundColor: hexToRgba(accent, 0.12) }}
                      >
                        <button
                          onClick={() => onDec(line.item, line.addons)}
                          className="grid size-7 place-items-center rounded-full text-white/80 hover:bg-black/30 hover:text-white"
                          aria-label="Diminuir"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-black text-white">
                          {line.qty}
                        </span>
                        <button
                          onClick={() => onInc(line.item, line.addons)}
                          className="grid size-7 place-items-center rounded-full text-white transition-colors hover:brightness-110"
                          style={{ backgroundColor: accent }}
                          aria-label="Aumentar"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="shrink-0 border-t border-white/[0.07] bg-[#0b0b12] p-5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-300">{brl(subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>Taxa de entrega</span>
              <span className="text-gray-600">calculada na entrega</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-white/[0.07] pt-2 text-base font-black text-white">
              <span>Total</span>
              <span style={{ color: accent }}>{brl(subtotal)}</span>
            </div>

            <button
              onClick={onCheckout}
              className="mt-4 w-full rounded-full py-3.5 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                backgroundColor: accent,
                boxShadow: `0 10px 28px ${hexToRgba(accent, 0.45)}`,
              }}
            >
              Continuar • {brl(subtotal)}
            </button>
            <p className="mt-2 text-center text-[11px] text-gray-600">
              Você escolhe entrega ou retirada no próximo passo
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
