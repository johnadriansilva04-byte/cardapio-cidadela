import { useStore } from "@/modules/cidadela-core/store";

const field =
  "w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-ring";

export function ConfigOperacional() {
  const { state, update } = useStore();

  return (
    <div className="space-y-6">

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="text-tech text-[10px] text-white">Loja</h3>
        <input
          className={field}
          value={state.store.name}
          onChange={(e) =>
            update((prev) => ({ ...prev, store: { ...prev.store, name: e.target.value } }))
          }
        />
        <input
          className={field}
          value={state.store.slogan}
          onChange={(e) =>
            update((prev) => ({ ...prev, store: { ...prev.store, slogan: e.target.value } }))
          }
        />
        <textarea
          className={field}
          rows={2}
          value={state.store.marquee}
          onChange={(e) =>
            update((prev) => ({ ...prev, store: { ...prev.store, marquee: e.target.value } }))
          }
        />
      </section>

      <section className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
        <label className="text-xs text-gray-300">
          Chave PIX
          <input
            className={`${field} mt-1`}
            value={state.payment.pixKey}
            onChange={(e) => update((prev) => ({ ...prev, payment: { pixKey: e.target.value } }))}
          />
        </label>
        <label className="text-xs text-gray-300">
          WhatsApp
          <input
            className={`${field} mt-1`}
            value={state.whatsapp}
            onChange={(e) => update((prev) => ({ ...prev, whatsapp: e.target.value }))}
          />
        </label>
        <label className="text-xs text-gray-300">
          Meta da operaÃ§Ã£o (R$)
          <input
            type="number"
            className={`${field} mt-1`}
            value={state.promo.meta}
            onChange={(e) =>
              update((prev) => ({
                ...prev,
                promo: { ...prev.promo, meta: Number(e.target.value) || 0 },
              }))
            }
          />
        </label>
        <label className="text-xs text-gray-300">
          Chave administrativa
          <input
            className={`${field} mt-1`}
            value={state.admin.accessKey}
            onChange={(e) => update((prev) => ({ ...prev, admin: { accessKey: e.target.value } }))}
          />
        </label>
      </section>
    </div>
  );
}
