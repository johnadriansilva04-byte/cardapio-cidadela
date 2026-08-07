import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/modules/core/store";

export const Route = createFileRoute("/cidadela")({
  head: () => ({
    meta: [
      { title: "A Cidadela — Cantina do Pracinha" },
      {
        name: "description",
        content:
          "Acesse a Cidadela com o código liberado no seu pedido e acompanhe seus pontos de Soberania.",
      },
      { property: "og:title", content: "A Cidadela — Cantina do Pracinha" },
      {
        property: "og:description",
        content: "Área exclusiva liberada por código a cada pedido concluído.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CidadelaPage,
});

function CidadelaPage() {
  const points = useStore((s) => s.soberania.points);
  const codes = useStore((s) => s.cidadela.codes);

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">
          ← Voltar ao cardápio
        </Link>

        <div className="mt-6 text-center">
          <div className="mx-auto grid size-24 place-items-center rounded-full border-2 border-cyan-400 bg-black/70 shadow-[0_0_30px_rgba(34,211,238,0.7)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="size-9 text-yellow-400"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
          <h1 className="mt-4 text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
            A CIDADELA
          </h1>
          <p className="mt-1 text-sm text-cyan-300">Área liberada por código de pedido</p>
        </div>

        <div className="mt-8 rounded-xl border border-[color:var(--color-brass)]/40 bg-black/50 p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Pontos de Soberania
          </p>
          <p className="text-4xl font-black text-[color:var(--color-brass)]">{points}</p>
        </div>

        <h2 className="mt-8 text-sm font-bold text-white">Seus códigos</h2>
        <div className="mt-3 space-y-2">
          {codes.length === 0 && (
            <p className="text-xs text-gray-500">
              Nenhum código ainda. Finalize um pedido para receber o seu.
            </p>
          )}
          {codes.map((c) => (
            <div
              key={c.code}
              className="flex items-center justify-between rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3"
            >
              <span className="font-mono text-sm font-bold text-cyan-300">{c.code}</span>
              <span className="text-[10px] text-gray-400">
                {c.access_type === "15_dias" ? "15 dias" : "15 minutos"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
