import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/types";
import { brl, hexToRgba } from "@/lib/utils";

interface CartLine {
  item: Product;
  qty: number;
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
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onClose: () => void;
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0b0b12] p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <ShoppingBag className="size-5" style={{ color: accent }} /> Seu pedido
          </h2>
          <button onClick={onClose} aria-label="Fechar carrinho">
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            Carrinho vazio
          </p>
        ) : (
          <div className="space-y-3">
            {lines.map(({ item, qty }) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400">{brl(item.price)}</p>
                </div>
                <div
                  className="flex items-center gap-2 rounded-lg border p-1"
                  style={{
                    borderColor: hexToRgba(accent, 0.4),
                    backgroundColor: hexToRgba(accent, 0.14),
                  }}
                >
                  <button
                    onClick={() => onDec(item.id)}
                    className="grid size-6 place-items-center rounded-full bg-black/50 hover:bg-black/70"
                    aria-label="Diminuir"
                  >
                    <Minus className="size-3 text-white" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold text-white">
                    {qty}
                  </span>
                  <button
                    onClick={() => onInc(item.id)}
                    className="grid size-6 place-items-center rounded-full transition-colors hover:brightness-110"
                    style={{ backgroundColor: accent }}
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

            <div
              className="border-t pt-3 text-sm"
              style={{ borderColor: hexToRgba(accent, 0.2) }}
            >
              <div className="flex justify-between text-base font-bold text-white">
                <span>Total</span>
                <span>{brl(subtotal)}</span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              className="mt-2 w-full rounded-full py-3 text-sm font-bold text-white transition-all hover:brightness-110"
              style={{
                backgroundColor: accent,
                boxShadow: `0 0 20px ${hexToRgba(accent, 0.45)}`,
              }}
            >
              Finalizar pedido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
