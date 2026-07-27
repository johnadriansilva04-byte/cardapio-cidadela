import { Printer } from "lucide-react";
import { useState } from "react";

import { useStore } from "@/modules/cidadela-core/store";
import { STATUS_LABEL, brl, buildThermalTicket, printTicket } from "@/modules/cidadela-core/utils";
import type { OrderStatus } from "@/lib/types";

const FILTERS: { id: OrderStatus | "todos"; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "pendente", label: "Pendentes" },
  { id: "andamento", label: "Em andamento" },
  { id: "entregue", label: "Entregues" },
];

export function GerenciadorPedidos() {
  const { state, update } = useStore();
  const [filter, setFilter] = useState<OrderStatus | "todos">("todos");

  const orders =
    filter === "todos" ? state.orders : state.orders.filter((o) => o.status === filter);

  function setStatus(comanda: string, status: OrderStatus) {
    update((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.comanda === comanda ? { ...o, status } : o)),
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`text-tech rounded-md px-3 py-2 text-[10px] ${
              filter === f.id
                ? "bg-[color:var(--olive)] text-[color:var(--sand)]"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {orders.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma comanda neste filtro.</p>
      )}

      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.comanda} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-tech text-[11px] text-[color:var(--brass)]">{o.comanda}</p>
                <p className="text-sm font-semibold">{o.cliente}</p>
                <p className="text-xs text-muted-foreground">
                  {o.telefone} · {o.tipo_entrega} · {o.pagamento.toUpperCase()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{brl(o.total)}</p>
                <span className="text-tech text-[9px] text-muted-foreground">
                  {STATUS_LABEL[o.status]}
                  {!o.synced && " · NÃO SINCRONIZADO"}
                </span>
              </div>
            </div>

            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {o.itens.map((i) => (
                <li key={i.id}>
                  {i.quantity}x {i.name} — {brl(i.total)}
                </li>
              ))}
            </ul>
            {o.observacoes && <p className="mt-2 text-xs italic">Obs: {o.observacoes}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {(["pendente", "andamento", "entregue"] as OrderStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(o.comanda, s)}
                  className={`text-tech rounded-md px-3 py-1.5 text-[9px] ${
                    o.status === s
                      ? "bg-[color:var(--brass)] text-[color:var(--matte)]"
                      : "bg-secondary"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => printTicket(buildThermalTicket(o, state.store.name))}
                className="text-tech flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[9px]"
              >
                <Printer className="size-3" /> Comanda 32c
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
