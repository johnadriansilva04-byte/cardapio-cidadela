import { useMemo, useState } from "react";
import { Copy, Trash2 } from "lucide-react";

import { useStore } from "@/modules/cidadela-core/store";
import { brl, generatePromoCode } from "@/modules/cidadela-core/utils";
import { pendingCount } from "@/modules/fluxos-n8n/webhook";

export function CidadelaDashboard() {
  const { state, update, online } = useStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

      <section className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-tech text-[10px] text-muted-foreground">Códigos FEB</h3>
          <button
            type="button"
            onClick={() =>
              update((prev) => ({
                ...prev,
                cidadela: { ...prev.cidadela, codes: [generatePromoCode(), ...prev.cidadela.codes] },
              }))
            }
            className="text-tech rounded-md bg-[color:var(--olive)] px-3 py-1.5 text-[10px]"
          >
            Emitir código
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {state.cidadela.codes.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum código emitido ainda.</li>
          )}
          {state.cidadela.codes.map((c) => (
            <li
              key={c.code}
              className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-tech text-[11px] font-semibold">{c.code}</span>
                <span className="text-tech text-[9px] text-muted-foreground">
                  {c.discount}% · {c.used ? "USADO" : "ATIVO"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(c.code);
                    setCopiedCode(c.code);
                    setTimeout(() => setCopiedCode(null), 2000);
                  }}
                  className="grid size-6 place-items-center rounded hover:bg-muted"
                  title="Copiar código"
                >
                  <Copy className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      cidadela: {
                        ...prev.cidadela,
                        codes: prev.cidadela.codes.map((code) =>
                          code.code === c.code ? { ...code, used: !code.used } : code
                        ),
                      },
                    }))
                  }
                  className="text-tech rounded px-2 py-1 text-[9px] hover:bg-muted"
                  title={c.used ? "Marcar como ativo" : "Marcar como usado"}
                >
                  {c.used ? "Reativar" : "Usar"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      cidadela: {
                        ...prev.cidadela,
                        codes: prev.cidadela.codes.filter((code) => code.code !== c.code),
                      },
                    }))
                  }
                  className="grid size-6 place-items-center rounded text-destructive hover:bg-destructive/10"
                  title="Remover código"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {copiedCode && (
          <p className="mt-2 text-[9px] text-green-600">Código {copiedCode} copiado!</p>
        )}
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
