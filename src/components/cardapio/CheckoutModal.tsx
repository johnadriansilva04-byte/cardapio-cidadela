import { useState } from "react";
import { X } from "lucide-react";
import { brl } from "@/modules/cidadela-core/utils";

export interface CheckoutForm {
  cliente: string;
  telefone: string;
  email: string;
  endereco: string;
  tipo_entrega: "entrega" | "retirada";
  observacoes: string;
  pagamento: "pix" | "dinheiro" | "cartao";
  troco: string;
}

export default function CheckoutModal({
  total,
  onClose,
  onConfirm,
}: {
  total: number;
  onClose: () => void;
  onConfirm: (form: CheckoutForm) => void;
}) {
  const [form, setForm] = useState<CheckoutForm>({
    cliente: "",
    telefone: "",
    email: "",
    endereco: "",
    tipo_entrega: "entrega",
    observacoes: "",
    pagamento: "pix",
    troco: "",
  });
  const [error, setError] = useState("");

  const field =
    "w-full rounded-lg border border-[color:var(--color-brass)]/30 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[color:var(--color-brass)] focus:outline-none";

  function submit() {
    if (!form.cliente.trim() || !form.telefone.trim()) {
      setError("Preencha nome e telefone");
      return;
    }
    if (form.tipo_entrega === "entrega" && !form.endereco.trim()) {
      setError("Informe o endereço de entrega");
      return;
    }
    setError("");
    onConfirm(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[color:var(--color-brass)]/30 bg-black p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Dados do pedido</h2>
          <button onClick={onClose} aria-label="Fechar checkout">
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            className={field}
            placeholder="Nome do cliente *"
            value={form.cliente}
            onChange={(e) => setForm({ ...form, cliente: e.target.value })}
          />
          <input
            className={field}
            placeholder="Telefone *"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
          <input
            className={field}
            placeholder="E-mail (opcional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <div className="flex gap-2">
            {(["entrega", "retirada"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, tipo_entrega: t })}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold uppercase ${
                  form.tipo_entrega === t
                    ? "border-[color:var(--color-brass)] bg-[color:var(--color-brass)]/20 text-[color:var(--color-brass)]"
                    : "border-[color:var(--color-brass)]/30 bg-black/50 text-gray-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {form.tipo_entrega === "entrega" && (
            <input
              className={field}
              placeholder="Endereço de entrega *"
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            />
          )}

          <textarea
            className={field}
            rows={2}
            placeholder="Observações"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />

          <div className="flex gap-2">
            {(["pix", "dinheiro", "cartao"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setForm({ ...form, pagamento: p })}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold uppercase ${
                  form.pagamento === p
                    ? "border-[color:var(--color-brass)] bg-[color:var(--color-brass)]/20 text-[color:var(--color-brass)]"
                    : "border-[color:var(--color-brass)]/30 bg-black/50 text-gray-400"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {form.pagamento === "dinheiro" && (
            <input
              className={field}
              placeholder="Troco para quanto?"
              value={form.troco}
              onChange={(e) => setForm({ ...form, troco: e.target.value })}
            />
          )}

          {error && <p className="text-xs font-semibold text-red-400">{error}</p>}

          <button
            onClick={submit}
            className="ember-glow w-full rounded-full bg-[color:var(--color-brass)] py-3 text-sm font-bold text-black"
          >
            Confirmar pedido • {brl(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
