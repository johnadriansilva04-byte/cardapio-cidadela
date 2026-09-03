import { createFileRoute } from "@tanstack/react-router";
import PublicMenu from "@/components/cardapio/Cardapio";

export const Route = createFileRoute("/cardapio/$slug")({
  head: () => ({
    meta: [
      { title: "Cardápio Digital" },
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
  return <PublicMenu slug={slug} />;
}
