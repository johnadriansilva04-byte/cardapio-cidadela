import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { SharePanel } from "@/components/admin/SharePanel";
import { PageHeader } from "@/modules/ui/PageHeader";
import { EmptyState, LoadingState } from "@/modules/ui/Feedback";
import { useActiveStore } from "@/modules/store/active-store-context";

export const Route = createFileRoute("/admin/compartilhar")({
  head: () => ({ meta: [{ title: "Compartilhar — Cardápio Cidadela" }] }),
  component: CompartilharPage,
});

function CompartilharPage() {
  const { restaurants, active, loading } = useActiveStore();

  if (loading) {
    return <LoadingState label="Carregando…" />;
  }

  if (restaurants.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title="Crie um restaurante primeiro"
        description="O link público, o QR Code e o compartilhamento por WhatsApp aparecem aqui assim que houver uma loja."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* A loja vem do seletor do cabeçalho; repetir um dropdown aqui era a
          mesma escolha em dois lugares, com risco de divergirem. */}
      <PageHeader title="Compartilhar" subtitle={active?.name} />

      {active && <SharePanel key={active.id} restaurant={active} />}
    </div>
  );
}
