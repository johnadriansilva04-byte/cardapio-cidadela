import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Cardapio } from "@/components/cardapio/Cardapio";
import { AdminModal } from "@/components/cardapio/AdminModal";
import { StoreProvider } from "@/modules/cidadela-core/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cantina do Pracinha — Cardápio Digital & Cidadela" },
      {
        name: "description",
        content:
          "Peça lanches artesanais em segundos: cardápio digital rápido, PIX com QR Code e comandas em tempo real. Painel Cidadela para a operação.",
      },
      { property: "og:title", content: "Cantina do Pracinha — Cardápio Digital" },
      {
        property: "og:description",
        content:
          "Cardápio digital instalável, pagamento por PIX e gestão de comandas no painel Cidadela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <StoreProvider>
      <Cardapio onOpenAdmin={() => setAdminOpen(true)} />
      {adminOpen && <AdminModal onClose={() => setAdminOpen(false)} />}
    </StoreProvider>
  );
}
