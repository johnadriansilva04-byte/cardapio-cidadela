import { useState } from "react";
import { X } from "lucide-react";
import { brl } from "@/lib/utils";

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
}

export default function CheckoutModal({
  total,
  prefillName,
  prefillPhone,
  submitting = false,
  onClose,
  onConfirm,
}: {
  total: number;
  prefillName?: string;
  prefillPhone?: string;
  submitting?: boolean;
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
    "w-full rounded-lg border border-cyan-500/30 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none";

  function submit() {
    if (submitting) return;
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      setError("Preencha nome e telefone");
      return;
    }
    if (form.delivery_type === "entrega" && !form.delivery_address.trim()) {
      setError("Informe o endereço de entrega");
      return;
    }
    setError("");
    onConfirm(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-cyan-500/30 bg-black p-5 sm:rounded-2xl">
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
            onChange={(e) =>
              setForm({ ...form, customer_name: e.target.value })
            }
          />
          <input
            className={field}
            placeholder="Telefone *"
            value={form.customer_phone}
            onChange={(e) =>
              setForm({ ...form, customer_phone: e.target.value })
            }
          />
          <input
            className={field}
            placeholder="E-mail (opcional)"
            value={form.customer_email}
            onChange={(e) =>
              setForm({ ...form, customer_email: e.target.value })
            }
          />

          <div className="flex gap-2">
            {(["retirada", "entrega"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, delivery_type: t })}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold uppercase ${
                  form.delivery_type === t
                    ? "border-cyan-500 bg-cyan-600 text-white"
                    : "border-cyan-500/30 bg-black/50 text-gray-400"
                }`}
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
                onChange={(e) =>
                  setForm({ ...form, delivery_address: e.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={field}
                  placeholder="Complemento"
                  value={form.customer_complement}
                  onChange={(e) =>
                    setForm({ ...form, customer_complement: e.target.value })
                  }
                />
                <input
                  className={field}
                  placeholder="Bairro"
                  value={form.customer_neighborhood}
                  onChange={(e) =>
                    setForm({ ...form, customer_neighborhood: e.target.value })
                  }
                />
              </div>
              <input
                className={field}
                placeholder="Cidade"
                value={form.customer_city}
                onChange={(e) =>
                  setForm({ ...form, customer_city: e.target.value })
                }
              />
            </>
          )}

          <textarea
            className={field}
            rows={2}
            placeholder="Observações"
            value={form.observations}
            onChange={(e) =>
              setForm({ ...form, observations: e.target.value })
            }
          />

          <div className="flex gap-2">
            {(["pix", "dinheiro", "cartao"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setForm({ ...form, payment_method: p })}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold uppercase ${
                  form.payment_method === p
                    ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                    : "border-cyan-500/30 bg-black/50 text-gray-400"
                }`}
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
              onChange={(e) =>
                setForm({ ...form, change_for: e.target.value })
              }
            />
          )}

          {error && (
            <p className="text-xs font-semibold text-red-400">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-full bg-cyan-600 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Enviando pedido..." : `Confirmar pedido • ${brl(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
