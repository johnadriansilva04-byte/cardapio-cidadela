import { useState, useMemo } from "react";
import { Copy, Check, ExternalLink, QrCode, AlertTriangle } from "lucide-react";
import type { Restaurant } from "@/lib/types";

export function SharePanel({ restaurant }: { restaurant: Restaurant }) {
  const [copied, setCopied] = useState(false);

  const publicPath = `/cardapio/${restaurant.slug}`;

  const publicUrl = useMemo(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      return `${window.location.origin}${publicPath}`;
    }
    return publicPath;
  }, [publicPath]);

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = publicUrl;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Compartilhar cardápio</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            restaurant.status === "published"
              ? "bg-green-500/15 text-green-400"
              : restaurant.status === "paused"
                ? "bg-yellow-500/15 text-yellow-400"
                : "bg-gray-600/20 text-gray-400"
          }`}
        >
          {restaurant.status === "published" ? "PUBLICADO" : restaurant.status === "paused" ? "PAUSADO" : "RASCUNHO"}
        </span>
      </div>

      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cyan-200/70">
          <ExternalLink className="size-3" /> Seu link público
        </p>
        <p className="break-all font-mono text-sm text-cyan-300">{publicUrl}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
          Envie no WhatsApp, bio do Instagram ou QR Code. O cardápio abre direto sem login do cliente.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-500"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiado!" : "Copiar link"}
          </button>
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/50 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
          >
            <ExternalLink className="size-4" /> Abrir cardápio
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-center">
        <p className="mb-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          <QrCode className="size-3" /> QR Code para impressão / balcão
        </p>
        <div className="mx-auto inline-block rounded-xl bg-white p-2">
          <img
            src={qrCodeUrl}
            alt={`QR Code do cardápio de ${restaurant.name}`}
            width={200}
            height={200}
            className="rounded-lg"
            loading="lazy"
          />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Escaneie para abrir o cardápio. Qualquer celular lê direto pela câmera.
        </p>
        <a
          href={qrCodeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-medium text-cyan-400 hover:text-cyan-300"
        >
          Baixar QR Code (PNG)
        </a>
      </div>

      {restaurant.status !== "published" && (
        <div className="flex gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-300" />
          <div>
            <p className="text-sm font-semibold text-yellow-200">
              Cardápio {restaurant.status === "draft" ? "em rascunho" : "pausado"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-yellow-200/80">
              O link funciona, mas clientes veem a mensagem de &quot;{restaurant.status === "draft" ? "não publicado" : "indisponível"}&quot;. Publique em Restaurantes para liberar o acesso.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <p className="text-[11px] font-semibold text-gray-400">Dica</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Mude nome, logo, banner e cores em <span className="text-gray-300">Restaurantes</span>. As alterações aparecem no link público em poucos segundos (Realtime).
        </p>
      </div>
    </div>
  );
}
