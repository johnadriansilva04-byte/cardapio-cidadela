import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { MapPin, MessageCircle, Phone, RefreshCw, Search, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ExpandableSection, StatTile } from "@/modules/ui/ExpandableSection";
import { EmptyState, InlineError } from "@/modules/ui/Feedback";
import { aggregateCustomers } from "@/modules/mobile/orders";
import { useOwnerOrders } from "@/modules/mobile/useOwnerOrders";
import { brl, cn } from "@/lib/utils";

export const Route = createFileRoute("/mobile/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Gestão Mobile" },
      {
        name: "description",
        content: "Quem mais compra, quanto gasta e quando pediu pela última vez.",
      },
    ],
  }),
  component: MobileCustomersPage,
});

type SortKey = "spent" | "recent" | "orders";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "spent", label: "Maior gasto" },
  { key: "orders", label: "Mais pedidos" },
  { key: "recent", label: "Mais recente" },
];

function MobileCustomersPage() {
  const { user } = useAuth();
  const { orders, loading, error, refresh } = useOwnerOrders(user?.id);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("spent");
  const [refreshing, setRefreshing] = useState(false);

  const customers = useMemo(() => aggregateCustomers(orders), [orders]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? customers.filter(
          (customer) => customer.name.toLowerCase().includes(term) || customer.phone.includes(term),
        )
      : customers;

    return [...filtered].sort((a, b) => {
      if (sort === "orders") return b.totalOrders - a.totalOrders;
      if (sort === "recent")
        return new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime();
      return b.totalSpent - a.totalSpent;
    });
  }, [customers, search, sort]);

  const totalRevenue = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);
  const recurring = customers.filter((customer) => customer.totalOrders > 1).length;

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <RefreshCw className="size-7 animate-spin text-cyan-400" />
        <p className="mt-3 text-sm text-gray-400">Carregando clientes…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Clientes</h1>
          <p className="text-xs text-gray-400">
            {customers.length} cliente{customers.length === 1 ? "" : "s"}
            {recurring > 0 && ` · ${recurring} recorrente${recurring === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Atualizar clientes"
          className="grid size-10 place-items-center rounded-xl bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`size-5 ${refreshing && "animate-spin"}`} />
        </button>
      </div>

      {error && <InlineError message={error} onRetry={handleRefresh} retrying={refreshing} />}

      {customers.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Clientes"
            value={customers.length}
            hint={`${recurring} voltaram a pedir`}
            icon={<Users className="size-3.5" />}
            tone="cyan"
          />
          <StatTile
            label="Receita da base"
            value={brl(totalRevenue)}
            hint={`média ${brl(customers.length ? totalRevenue / customers.length : 0)}`}
            icon={<TrendingUp className="size-3.5" />}
            tone="emerald"
          />
        </div>
      )}

      {customers.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>

          <div className="flex gap-2">
            {SORTS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSort(option.key)}
                className={cn(
                  "flex-1 rounded-xl px-2 py-2 text-xs font-bold transition-all",
                  sort === option.key
                    ? "bg-cyan-500 text-black"
                    : "border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={search ? Search : Users}
          title={search ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
          description={
            search
              ? "Tente outro nome ou telefone."
              : "A base é montada a partir dos pedidos: cada cliente que comprar aparece aqui automaticamente."
          }
          action={
            search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10"
              >
                Limpar busca
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((customer) => {
            const whatsapp = customer.phone.replace(/\D/g, "");
            const average = customer.totalSpent / customer.totalOrders;
            return (
              <ExpandableSection
                key={customer.key}
                icon={<Users className="size-4" />}
                title={customer.name}
                summary={`${customer.totalOrders} pedido${
                  customer.totalOrders === 1 ? "" : "s"
                } · ${brl(customer.totalSpent)}`}
                badge={
                  customer.totalOrders > 1 ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                      RECORRENTE
                    </span>
                  ) : undefined
                }
              >
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                    <Row label="Pedidos" value={customer.totalOrders} />
                    <Row label="Total gasto" value={brl(customer.totalSpent)} highlight />
                    <Row label="Ticket médio" value={brl(average)} />
                    <Row
                      label="Último pedido"
                      value={new Date(customer.lastOrder).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    />
                    {customer.phone && (
                      <Row
                        label="Telefone"
                        value={customer.phone}
                        icon={<Phone className="size-3" />}
                      />
                    )}
                    {customer.address && (
                      <Row
                        label="Endereço"
                        value={customer.address}
                        icon={<MapPin className="size-3" />}
                      />
                    )}
                  </div>

                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25"
                    >
                      <MessageCircle className="size-3.5" /> Chamar no WhatsApp
                    </a>
                  )}
                </div>
              </ExpandableSection>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 text-right text-[11px] font-semibold",
          highlight ? "text-cyan-300" : "text-gray-200",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default MobileCustomersPage;
