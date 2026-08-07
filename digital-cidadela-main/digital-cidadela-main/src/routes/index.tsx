import { createFileRoute } from "@tanstack/react-router";
import Cardapio from "@/components/cardapio/Cardapio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cantina do Pracinha — Cardápio Digital" },
      {
        name: "description",
        content:
          "Peça lanches, porções e bebidas pelo cardápio digital da Cantina do Pracinha. Pagamento por PIX e pontos de Soberania a cada pedido.",
      },
      { property: "og:title", content: "Cantina do Pracinha — Cardápio Digital" },
      {
        property: "og:description",
        content: "Cardápio digital com pedido online, PIX e pontos de Soberania.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cardapio,
});
