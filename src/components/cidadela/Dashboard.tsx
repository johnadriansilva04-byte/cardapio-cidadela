import { useMemo } from "react";

import { useStore } from "@/modules/cidadela-core/store";
import { brl } from "@/modules/cidadela-core/utils";
import { pendingCount } from "@/modules/fluxos-n8n/webhook";

export function CidadelaDashboard() {
  const { state, update, online } = useStore();

  const metrics = useMemo(() => {
    const faturamento = state.orders.reduce((s, o) => s + o.total, 0);
    const ticket = state.orders.length ? faturamento / state.orders.length : 0;
    return {
      pedidos: state.orders.length,
      faturamento,
      ticket,
      pendentes: state.orders.filter((o) => o.status === "pendente").length,
    };
  }, [state.orders]);

  const progresso = Math.min(100, (metrics.faturamento / Math.max(1, state.promo.meta)) * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Comandas" value={String(metrics.pedidos)} />
        <Metric label="Faturamento" value={brl(metrics.faturamento)} />
        <Metric label="Ticket médio" value={brl(metrics.ticket)} />
        <Metric label="Em fila" value={String(metrics.pendentes)} />
      </div>

      <section className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-tech text-[10px] text-muted-foreground">Meta da operação</h3>
          <span className="text-tech text-[10px] text-[color:var(--brass)]">
            {brl(metrics.faturamento)} / {brl(state.promo.meta)}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-[color:var(--brass)] transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Badge label={online ? "OPERACIONAL" : "SEM SINAL"} />
        <Badge label={`FILA WEBHOOK: ${pendingCount()}`} />
        <Badge label={state.integrations.geminiApiKey ? "PRAXINHA ARMADO" : "PRAXINHA OFFLINE"} />
        <Badge label={state.integrations.n8nWebhookUrl ? "N8N LIGADO" : "N8N AUSENTE"} />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-tech text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="text-tech rounded-full border border-border px-3 py-1 text-[9px] text-[color:var(--brass)]">
      {label}
    </span>
  );
}
