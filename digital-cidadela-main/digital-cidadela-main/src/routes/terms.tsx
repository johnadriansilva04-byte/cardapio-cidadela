import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Cantina do Pracinha" },
      {
        name: "description",
        content:
          "Condições de uso do cardápio digital: pedidos, pagamentos por PIX, pontos de Soberania e códigos da Cidadela.",
      },
      { property: "og:title", content: "Termos de Uso — Cantina do Pracinha" },
      {
        property: "og:description",
        content: "Regras de pedidos, pagamentos e programa de pontos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="mx-auto max-w-xl space-y-4">
        <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">
          ← Voltar ao cardápio
        </Link>
        <h1 className="text-2xl font-black text-white">Termos de Uso</h1>
        <p className="text-sm text-gray-400">
          Os pedidos são confirmados após a validação do pagamento. Pagamentos por PIX passam por
          conferência do estabelecimento antes do preparo.
        </p>
        <p className="text-sm text-gray-400">
          A cada R$ 30 em pedidos você acumula 1 ponto de Soberania. Pontos podem gerar descontos
          conforme as faixas configuradas pela loja.
        </p>
        <p className="text-sm text-gray-400">
          Códigos da Cidadela têm validade de 15 minutos, ou 15 dias em pedidos a partir de R$ 200,
          e são de uso pessoal e intransferível.
        </p>
      </div>
    </div>
  );
}
