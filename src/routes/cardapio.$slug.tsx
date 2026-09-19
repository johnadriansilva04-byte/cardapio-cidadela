import { createFileRoute } from "@tanstack/react-router";
import PublicMenu from "@/components/cardapio/Cardapio";
import { usePageView } from "@/modules/analytics/usePageView";

export const Route = createFileRoute("/cardapio/$slug")({
  head: () => ({
    meta: [
      { title: "Cardápio Digital — Cardápio Cidadela" },
      {
        name: "description",
        content: "Confira o cardápio e faça seu pedido online.",
      },
    ],
  }),
  component: CardapioPublicPage,
});

function CardapioPublicPage() {
  const { slug } = Route.useParams();
  // Analytics de abertura do cardápio — não altera o comportamento do componente.
  usePageView("/cardapio", { slug });
  return <PublicMenu slug={slug} />;
}
