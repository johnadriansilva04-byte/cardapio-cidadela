import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { MapPin, MessageCircle, Phone, RefreshCw, Search, TrendingUp, Users } from "lucide-react";
import { ExpandableSection, StatTile } from "@/modules/ui/ExpandableSection";
import { EmptyState, InlineError, LoadingState } from "@/modules/ui/Feedback";
import { PageHeader } from "@/modules/ui/PageHeader";
import { HeaderIconButton, SearchField, SegmentedControl } from "@/modules/ui/Controls";
import { aggregateCustomers } from "@/modules/mobile/orders";
import { useMobileStore } from "@/modules/mobile/store-context";
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
  const { orders, loading, error, refresh } = useMobileStore();

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
    return <LoadingState label="Carregando clientes…" className="h-full" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clientes"
        subtitle={`${customers.length} cliente${customers.length === 1 ? "" : "s"}${
          recurring > 0 ? ` · ${recurring} recorrente${recurring === 1 ? "" : "s"}` : ""
        }`}
        actions={
          <HeaderIconButton
            icon={RefreshCw}
            label="Atualizar clientes"
            spinning={refreshing}
            disabled={refreshing}
            onClick={handleRefresh}
          />
        }
      />

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
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome ou telefone"
            ariaLabel="Buscar clientes"
          />

          <SegmentedControl
            ariaLabel="Ordenar clientes"
            value={sort}
            onChange={setSort}
            options={SORTS}
          />
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
