import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Store } from "lucide-react";
import { OrderManager } from "@/components/admin/OrderManager";
import { PageHeader } from "@/modules/ui/PageHeader";
import { EmptyState, LoadingState } from "@/modules/ui/Feedback";
import { useActiveStore } from "@/modules/store/active-store-context";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Cardápio Cidadela" }] }),
  component: PedidosPage,
});

function PedidosPage() {
  const { restaurants, active, loading } = useActiveStore();

  if (loading) {
    return <LoadingState label="Carregando pedidos…" />;
  }

  if (restaurants.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhum restaurante ainda"
        description="Os pedidos aparecem aqui assim que você tiver um restaurante publicado recebendo pedidos."
        action={
          <Link
            to="/admin/restaurantes"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-bold text-black transition-colors hover:bg-cyan-400"
          >
            <Store className="size-3.5" /> Criar restaurante
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        title="Pedidos"
        subtitle={`${active?.name ?? "Sua loja"} • atualização em tempo real`}
      />

      <OrderManager restaurants={restaurants} initialStoreId={active?.id} />
    </div>
  );
}
