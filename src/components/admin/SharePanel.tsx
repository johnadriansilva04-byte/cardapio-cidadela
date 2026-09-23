import { useState, useMemo } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  QrCode,
  AlertTriangle,
  MessageCircle,
  Printer,
} from "lucide-react";
import type { Restaurant } from "@/lib/types";

export function SharePanel({ restaurant }: { restaurant: Restaurant }) {
  const [copied, setCopied] = useState(false);

  const publicPath = `/cardapio/${restaurant.slug}`;

  const publicUrl = useMemo(() => {
    // URL fixo correto em vez de usar window.location.origin
    const baseUrl = "https://cardapio-cidadela.vercel.app";
    return `${baseUrl}${publicPath}`;
  }, [publicPath]);

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}`;

  const whatsappMessage = useMemo(() => {
    return `🍽️ *${restaurant.name}*\n\nConfira nosso cardápio e faça seu pedido online:\n${publicUrl}`;
  }, [restaurant.name, publicUrl]);

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

  function openWhatsApp() {
    const digits = (restaurant.whatsapp || "").replace(/\D/g, "");
    const url = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(whatsappMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Link público — destaque principal */}
      <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.08] to-transparent p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300/80">
            Link público do cardápio
          </p>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              restaurant.status === "published"
                ? "bg-green-500/15 text-green-400"
                : restaurant.status === "paused"
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "bg-gray-600/20 text-gray-400"
            }`}
          >
            {restaurant.status === "published"
              ? "PUBLICADO"
              : restaurant.status === "paused"
                ? "PAUSADO"
                : "RASCUNHO"}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-3">
          <p className="min-w-0 flex-1 truncate font-mono text-sm text-cyan-300">{publicUrl}</p>
          <button
            onClick={copyLink}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-500"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-2.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/[0.08]"
          >
            <ExternalLink className="size-3.5" /> Abrir cardápio
          </a>
          <button
            onClick={openWhatsApp}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 py-2.5 text-xs font-semibold text-green-300 transition-colors hover:bg-green-500/20"
          >
            <MessageCircle className="size-3.5" /> Enviar no WhatsApp
          </button>
          <a
            href={qrCodeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-2.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/[0.08]"
          >
            <Printer className="size-3.5" /> Baixar QR Code
          </a>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          Funciona sem login — o cliente abre, escolhe e pede. Ideal para bio do Instagram, status
          do WhatsApp e mesa do restaurante.
        </p>
      </div>

      {/* QR Code — balcão / mesa */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="shrink-0 rounded-2xl bg-white p-2.5">
            <img
              src={qrCodeUrl}
              alt={`QR Code do cardápio de ${restaurant.name}`}
              width={140}
              height={140}
              className="rounded-lg"
              loading="lazy"
            />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-white sm:justify-start">
              <QrCode className="size-4" style={{ color: "var(--color-brand, #22d3ee)" }} />
              QR Code para o balcão
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Imprima e cole na mesa ou no balcão. Qualquer câmera de celular abre o cardápio na
              hora.
            </p>
          </div>
        </div>
      </div>

      {restaurant.status !== "published" && (
        <div className="flex gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-300" />
          <div>
            <p className="text-sm font-semibold text-yellow-200">
              Cardápio {restaurant.status === "draft" ? "em rascunho" : "pausado"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-yellow-200/80">
              O link funciona, mas clientes veem a mensagem de &quot;
              {restaurant.status === "draft" ? "não publicado" : "indisponível"}&quot;. Publique em
              Restaurantes para liberar o acesso.
            </p>
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-gray-600">
        Alterações de nome, logo e cores aparecem no link público em poucos segundos (tempo real).
      </p>
    </div>
  );
}
