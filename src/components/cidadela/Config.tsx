import { useEffect } from "react";
import { useStore } from "@/modules/cidadela-core/store";
import { useAdminTrial } from "@/modules/supabase/admin";

const field =
  "w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-ring";

export function ConfigOperacional() {
  const { state, update } = useStore();
  const { trial, updateAdminConfig, loadAdminConfig } = useAdminTrial();

  // Carregar configurações do Supabase quando o trial estiver disponível
  useEffect(() => {
    if (trial?.id) {
      loadAdminConfig(trial.id).then((config) => {
        if (config) {
          update((prev) => ({
            ...prev,
            store: {
              ...prev.store,
              name: config.store_name || prev.store.name,
              slogan: config.store_slogan || prev.store.slogan,
              marquee: config.store_marquee || prev.store.marquee,
            },
            payment: {
              ...prev.payment,
              pixKey: config.pix_key || prev.payment.pixKey,
            },
            whatsapp: config.whatsapp || prev.whatsapp,
          }));
        }
      });
    }
  }, [trial?.id, update, loadAdminConfig]);

  async function handleStoreConfigChange(field: string, value: string) {
    update((prev) => ({ ...prev, store: { ...prev.store, [field]: value } }));
    
    // Salvar no Supabase se tiver trial
    if (trial?.id) {
      await updateAdminConfig(trial.id, {
        [field === 'name' ? 'store_name' : field === 'slogan' ? 'store_slogan' : 'store_marquee']: value,
      });
    }
  }

  async function handlePaymentConfigChange(field: string, value: string) {
    if (field === 'pixKey') {
      update((prev) => ({ ...prev, payment: { pixKey: value } }));
      if (trial?.id) {
        await updateAdminConfig(trial.id, { pix_key: value });
      }
    } else if (field === 'whatsapp') {
      update((prev) => ({ ...prev, whatsapp: value }));
      if (trial?.id) {
        await updateAdminConfig(trial.id, { whatsapp: value });
      }
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="text-tech text-[10px] text-white">Loja</h3>
        <input
          className={field}
          value={state.store.name}
          onChange={(e) => handleStoreConfigChange('name', e.target.value)}
        />
        <input
          className={field}
          value={state.store.slogan}
          onChange={(e) => handleStoreConfigChange('slogan', e.target.value)}
        />
        <textarea
          className={field}
          rows={2}
          value={state.store.marquee}
          onChange={(e) => handleStoreConfigChange('marquee', e.target.value)}
        />
      </section>

      <section className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
        <label className="text-xs text-gray-300">
          Chave PIX
          <input
            className={`${field} mt-1`}
            value={state.payment.pixKey}
            onChange={(e) => handlePaymentConfigChange('pixKey', e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-300">
          WhatsApp
          <input
            className={`${field} mt-1`}
            value={state.whatsapp}
            onChange={(e) => handlePaymentConfigChange('whatsapp', e.target.value)}
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
