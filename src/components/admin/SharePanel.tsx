import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import type { Restaurant } from "@/lib/types";

export function SharePanel({ restaurant }: { restaurant: Restaurant }) {
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${restaurant.slug}`
      : `/r/${restaurant.slug}`;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}`;

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const msg = `Confira o cardápio de ${restaurant.name}!\n\n${publicUrl}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-white">Compartilhar cardápio</h3>

      {/* Public URL */}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Seu link
        </p>
        <p className="break-all text-sm text-cyan-300">{publicUrl}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={copyLink}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-500"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copiado!" : "Copiar link"}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-500/50 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
          >
            <ExternalLink className="size-4" /> Abrir cardápio
          </a>
        </div>
      </div>

      {/* QR Code */}
      <div className="rounded-xl border border-cyan-500/20 bg-black/40 p-4 text-center">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          QR Code
        </p>
        <img
          src={qrCodeUrl}
          alt={`QR Code do cardápio de ${restaurant.name}`}
          width={200}
          height={200}
          className="mx-auto rounded-lg bg-white p-2"
        />
        <p className="mt-3 text-xs text-gray-400">
          Escaneie para acessar o cardápio
        </p>
      </div>

      {/* WhatsApp share */}
      {restaurant.whatsapp && (
        <button
          onClick={shareWhatsApp}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-500/40 py-3 text-sm font-semibold text-green-400 hover:bg-green-500/10"
        >
          📱 Enviar link via WhatsApp
        </button>
      )}

      {/* Status reminder */}
      {restaurant.status !== "published" && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <p className="text-xs text-yellow-300">
            ⚠️ Seu cardápio está em{" "}
            <strong>
              {restaurant.status === "draft" ? "rascunho" : "pausa"}
            </strong>
            . Publique-o para que clientes possam acessar.
          </p>
        </div>
      )}
    </div>
  );
}
