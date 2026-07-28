import { useState } from "react";

import { useStore } from "@/modules/cidadela-core/store";
import { flushQueue, pendingCount } from "@/modules/fluxos-n8n/webhook";

const field =
  "w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-ring";

export function ConfigOperacional() {
  const { state, update } = useStore();
  const [flushMsg, setFlushMsg] = useState("");

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="text-tech text-[10px] text-white">Integrações</h3>
        <label className="block text-xs text-gray-300">
          GEMINI_API_KEY
          <input
            type="password"
            className={`${field} mt-1`}
            value={state.integrations.geminiApiKey}
            placeholder="AIzaSy..."
            onChange={(e) =>
              update((prev) => ({
                ...prev,
                integrations: { ...prev.integrations, geminiApiKey: e.target.value },
              }))
            }
          />
        </label>
        <label className="block text-xs text-gray-300">
          N8N_WEBHOOK_URL (Pedido)
          <input
            className={`${field} mt-1`}
            value={state.integrations.n8nWebhookUrl}
            placeholder="http://localhost:5678/webhook/cardapio-pedido"
            onChange={(e) =>
              update((prev) => ({
                ...prev,
                integrations: { ...prev.integrations, n8nWebhookUrl: e.target.value },
              }))
            }
          />
        </label>
        <label className="block text-xs text-gray-300">
          CIDADELA_AUTH_URL
          <input
            className={`${field} mt-1`}
            value={state.integrations.cidadelaAuthUrl}
            placeholder="https://58ce753dc20d42.lhr.life/webhook/cidadela"
            onChange={(e) =>
              update((prev) => ({
                ...prev,
                integrations: { ...prev.integrations, cidadelaAuthUrl: e.target.value },
              }))
            }
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              const sent = await flushQueue();
              setFlushMsg(`${sent} pedido(s) sincronizado(s). Fila: ${pendingCount()}`);
            }}
            className="text-tech rounded-md bg-[color:var(--olive)] px-3 py-2 text-[10px]"
          >
            Sincronizar
          </button>
          {flushMsg && <span className="text-[10px] text-white">{flushMsg}</span>}
        </div>
      </section>

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
          Meta da operação (R$)
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
