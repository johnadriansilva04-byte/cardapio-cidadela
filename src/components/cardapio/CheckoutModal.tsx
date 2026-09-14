import { useState } from "react";
import { X } from "lucide-react";
import { brl, hexToRgba } from "@/lib/utils";

export interface CheckoutForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string;
  customer_complement: string;
  customer_neighborhood: string;
  customer_city: string;
  delivery_type: "entrega" | "retirada";
  observations: string;
  payment_method: "pix" | "dinheiro" | "cartao";
  change_for: string;
  delivery_fee?: number;
}

export default function CheckoutModal({
  total,
  accent = "#06b6d4",
  prefillName,
  prefillPhone,
  submitting = false,
  serverError = "",
  deliveryFee = 0,
  deliveryRadiusKm = 0,
  onClose,
  onConfirm,
}: {
  total: number;
  accent?: string;
  prefillName?: string;
  prefillPhone?: string;
  submitting?: boolean;
  serverError?: string;
  deliveryFee?: number;
  deliveryRadiusKm?: number;
  onClose: () => void;
  onConfirm: (form: CheckoutForm) => void;
}) {
  const [form, setForm] = useState<CheckoutForm>({
    customer_name: prefillName || "",
    customer_phone: prefillPhone || "",
    customer_email: "",
    delivery_address: "",
    customer_complement: "",
    customer_neighborhood: "",
    customer_city: "",
    delivery_type: "retirada",
    observations: "",
    payment_method: "pix",
    change_for: "",
  });
  const [error, setError] = useState("");

  const field =
    "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none";

  const isDelivery = form.delivery_type === "entrega";
  const appliedFee = isDelivery ? deliveryFee : 0;
  const totalWithFee = total + appliedFee;

  function submit() {
    if (submitting) return;
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      setError("Preencha nome e telefone");
      return;
    }
    if (isDelivery && !form.delivery_address.trim()) {
      setError("Informe o endereço de entrega");
      return;
    }
    setError("");
    onConfirm({ ...form, delivery_fee: appliedFee });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0b0b12] p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Dados do pedido</h2>
          <button onClick={onClose} aria-label="Fechar checkout">
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            className={field}
            placeholder="Seu nome *"
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
          />
          <input
            className={field}
            placeholder="Telefone *"
            value={form.customer_phone}
            onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
          />
          <input
            className={field}
            placeholder="E-mail (opcional)"
            value={form.customer_email}
            onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
          />

          <div className="flex gap-2">
            {(["retirada", "entrega"] as const).map((t) => (
              <button
                key={t}
                onClick={() =>
                  setForm({
                    ...form,
                    delivery_type: t,
                    delivery_fee: t === "entrega" ? deliveryFee : 0,
                  })
                }
                className="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold uppercase transition-all"
                style={
                  form.delivery_type === t
                    ? {
                        borderColor: accent,
                        backgroundColor: accent,
                        color: "#fff",
                      }
                    : {
                        borderColor: "rgba(255,255,255,0.15)",
                        backgroundColor: "rgba(255,255,255,0.03)",
                        color: "#9ca3af",
                      }
                }
              >
                {t === "entrega" ? "Entrega" : "Retirada"}
              </button>
            ))}
          </div>

          {form.delivery_type === "entrega" && (
            <>
              <input
                className={field}
                placeholder="Endereço (rua, número) *"
                value={form.delivery_address}
                onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={field}
                  placeholder="Complemento"
                  value={form.customer_complement}
                  onChange={(e) => setForm({ ...form, customer_complement: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Bairro"
                  value={form.customer_neighborhood}
                  onChange={(e) => setForm({ ...form, customer_neighborhood: e.target.value })}
                />
              </div>
              <input
                className={field}
                placeholder="Cidade"
                value={form.customer_city}
                onChange={(e) => setForm({ ...form, customer_city: e.target.value })}
              />
            </>
          )}

          <textarea
            className={field}
            rows={2}
            placeholder="Observações"
            value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })}
          />

          <div className="flex gap-2">
            {(["pix", "dinheiro", "cartao"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setForm({ ...form, payment_method: p })}
                className="flex-1 rounded-lg border px-2 py-2 text-xs font-semibold uppercase transition-all"
                style={
                  form.payment_method === p
                    ? {
                        borderColor: hexToRgba(accent, 0.7),
                        backgroundColor: hexToRgba(accent, 0.18),
                        color: accent,
                      }
                    : {
                        borderColor: "rgba(255,255,255,0.15)",
                        backgroundColor: "rgba(255,255,255,0.03)",
                        color: "#9ca3af",
                      }
                }
              >
                {p === "pix" ? "PIX" : p === "dinheiro" ? "Dinheiro" : "Cartão"}
              </button>
            ))}
          </div>

          {form.payment_method === "dinheiro" && (
            <input
              className={field}
              placeholder="Troco para quanto?"
              value={form.change_for}
              onChange={(e) => setForm({ ...form, change_for: e.target.value })}
            />
          )}

          {(appliedFee > 0 || isDelivery) && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
              <div className="flex items-center justify-between text-gray-400">
                <span>Subtotal</span>
                <span>{brl(total)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>
                  Taxa de entrega{" "}
                  {deliveryRadiusKm > 0 && (
                    <span className="text-gray-600">• até {deliveryRadiusKm} km</span>
                  )}
                </span>
                <span className={isDelivery ? "font-semibold text-white" : "text-gray-500"}>
                  {isDelivery ? brl(appliedFee) : "—"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1.5 font-bold text-white">
                <span>Total</span>
                <span
                  style={{ color: isDelivery ? accent : undefined }}
                  className={!isDelivery ? "text-gray-400" : ""}
                >
                  {brl(totalWithFee)}
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
          {serverError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold leading-relaxed text-red-300">
              {serverError}
            </p>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-full py-3 text-sm font-bold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: accent,
              boxShadow: `0 0 20px ${hexToRgba(accent, 0.4)}`,
            }}
          >
            {submitting ? "Enviando pedido..." : `Confirmar pedido • ${brl(totalWithFee)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
