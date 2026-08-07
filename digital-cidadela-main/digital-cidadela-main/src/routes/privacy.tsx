import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Cantina do Pracinha" },
      {
        name: "description",
        content:
          "Saiba como a Cantina do Pracinha coleta e utiliza dados de pedidos, contato e pontos de fidelidade.",
      },
      { property: "og:title", content: "Política de Privacidade — Cantina do Pracinha" },
      {
        property: "og:description",
        content: "Como tratamos os dados dos pedidos feitos pelo cardápio digital.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="mx-auto max-w-xl space-y-4">
        <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">
          ← Voltar ao cardápio
        </Link>
        <h1 className="text-2xl font-black text-white">Política de Privacidade</h1>
        <p className="text-sm text-gray-400">
          Coletamos apenas os dados necessários para processar o seu pedido: nome, telefone,
          e-mail (opcional), endereço de entrega e observações.
        </p>
        <p className="text-sm text-gray-400">
          Esses dados são usados para preparar, entregar e dar suporte ao pedido, além de calcular
          os pontos de Soberania vinculados ao seu contato.
        </p>
        <p className="text-sm text-gray-400">
          Não vendemos dados a terceiros. Para solicitar exclusão das suas informações, entre em
          contato pelo WhatsApp da loja.
        </p>
      </div>
    </div>
  );
}
