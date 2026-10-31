import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoadingState } from "@/modules/ui/Feedback";
import { useActiveStore } from "@/modules/store/active-store-context";

export const Route = createFileRoute("/admin/cardapio")({
  head: () => ({ meta: [{ title: "Cardápio — Cardápio Cidadela" }] }),
  component: CardapioPage,
});

/**
 * Rota legada: o gerenciamento de cardápio agora vive dentro de cada
 * restaurante (/admin/restaurante/$id?tab=cardapio). Redireciona para a loja
 * ativa para não quebrar links antigos.
 */
function CardapioPage() {
  const navigate = useNavigate();
  const { active, loading } = useActiveStore();

  useEffect(() => {
    if (loading) return;
    if (active) {
      navigate({
        to: "/admin/restaurante/$id",
        params: { id: active.id },
        search: { tab: "cardapio" },
        replace: true,
      });
      return;
    }
    navigate({ to: "/admin/restaurantes", replace: true });
  }, [active, loading, navigate]);

  return <LoadingState label="Abrindo o cardápio…" />;
}
