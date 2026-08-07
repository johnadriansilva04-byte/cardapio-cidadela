import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import type { MenuItem } from "@/lib/types";
import { brl } from "@/modules/cidadela-core/utils";

interface CartLine {
  item: MenuItem;
  qty: number;
}

export default function CartSheet({
  lines,
  subtotal,
  discountPercentage,
  discountAmount,
  total,
  onInc,
  onDec,
  onClose,
  onCheckout,
}: {
  lines: CartLine[];
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  total: number;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onClose: () => void;
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-red-500/30 bg-black p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <ShoppingBag className="size-5 text-red-500" /> Seu pedido
          </h2>
          <button onClick={onClose} aria-label="Fechar carrinho">
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Carrinho vazio</p>
        ) : (
          <div className="space-y-3">
            {lines.map(({ item, qty }) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-red-500/20 bg-black/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{item.name}</p>
                  <p className="text-xs text-gray-400">{brl(item.price)}</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/20 p-1">
                  <button
                    onClick={() => onDec(item.id)}
                    className="grid size-6 place-items-center rounded-full bg-black/50 hover:bg-black/70"
                    aria-label="Diminuir"
                  >
                    <Minus className="size-3 text-white" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold text-white">{qty}</span>
                  <button
                    onClick={() => onInc(item.id)}
                    className="grid size-6 place-items-center rounded-full bg-red-600 hover:bg-red-500"
                    aria-label="Aumentar"
                  >
                    <Plus className="size-3 text-white" />
                  </button>
                </div>
                <span className="ml-3 w-20 text-right text-sm font-bold text-white">
                  {brl(item.price * qty)}
                </span>
              </div>
            ))}

            <div className="space-y-1 border-t border-red-500/20 pt-3 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>{brl(subtotal)}</span>
              </div>
              {discountPercentage > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Desconto ({discountPercentage}%)</span>
                  <span>-{brl(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white">
                <span>Total</span>
                <span>{brl(total)}</span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              className="ember-glow mt-2 w-full rounded-full bg-red-600 py-3 text-sm font-bold text-white"
            >
              Finalizar pedido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
