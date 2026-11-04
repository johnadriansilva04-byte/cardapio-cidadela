import { useRef, useState } from "react";
import { Camera, Check, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { compressImageForUpload } from "@/lib/imageCompression";
import {
  importScannedMenu,
  scanMenuPhoto,
  countScanned,
  type ScannedCategory,
} from "@/modules/supabase/menu-scan";

/**
 * "Manda a foto do cardápio" — recurso do plano ANUAL.
 *
 * O dono tira foto do menu atual; a IA de visão lê os itens e, depois de ele
 * CONFERIR, o cardápio é criado. É o gatilho de venda do anual: quem não tem
 * o plano vê o convite e a opção de continuar digitando (nunca um beco sem saída).
 *
 * A checagem de plano é feita no servidor (`/api/menu/scan`); aqui só mostramos
 * o resultado. Nada é gravado sem o "Importar".
 */
export function PhotoMenuImport({
  restaurantId,
  /** `true` quando o dono tem o ciclo anual — controla só o que a UI oferece. */
  canScan,
  /** Chamado quando o upgrade é pedido (leva para /admin/assinatura). */
  onUpgrade,
  /** Chamado depois de importar, para recarregar o cardápio. */
  onImported,
  /** Variante compacta para o cabeçalho. */
  compact = false,
}: {
  restaurantId: string;
  canScan: boolean;
  onUpgrade: () => void;
  onImported: (count: number) => void;
  compact?: boolean;
}) {
  const { session } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ScannedCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fileToDataUrl(file: File): Promise<string> {
    // Reaproveita a compressão do upload: a foto vira WebP ≤ 800px antes de
    // sair do aparelho, o que reduz o token de imagem (custo) e o tempo de envio.
    const compressed = await compressImageForUpload(file);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Falha ao ler a foto."));
      reader.readAsDataURL(compressed.file);
    });
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setScanning(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await scanMenuPhoto(restaurantId, dataUrl, session?.access_token);
      if (!res.ok) {
        setError(
          res.reason === "annual_required"
            ? "A leitura por foto é do plano Anual."
            : "Não consegui ler a foto agora. Tente outra ou digite os itens.",
        );
        return;
      }
      setResult(res.categories);
    } catch {
      setError("Não consegui ler a foto agora.");
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!result) return;
    setImporting(true);
    const count = await importScannedMenu(restaurantId, result);
    setImporting(false);
    setResult(null);
    if (count > 0) onImported(count);
    else setError("Não consegui salvar os itens. Tente de novo.");
  }

  const summary = result ? countScanned(result) : null;

  // Sem o plano anual: mostra o convite e deixa seguir digitando.
  if (!canScan) {
    return (
      <div
        className={
          compact
            ? "flex items-center gap-2"
            : "flex flex-col gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        {!compact && (
          <p className="text-xs leading-relaxed text-amber-200/90">
            <Sparkles className="mr-1 inline size-3.5" />
            Manda a foto do seu menu e a IA monta o cardápio — exclusivo do plano{" "}
            <span className="font-bold">Anual</span>.
          </p>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onUpgrade}
          className="shrink-0 bg-amber-500 text-black hover:bg-amber-400"
        >
          <Camera className="mr-1.5 size-3.5" /> Enviar foto (Anual)
        </Button>
      </div>
    );
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-3"}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        size="sm"
        variant={compact ? "outline" : "default"}
        onClick={() => inputRef.current?.click()}
        disabled={scanning || importing}
        className={
          compact
            ? "border-white/10 bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]"
            : "bg-cyan-500 text-black hover:bg-cyan-400"
        }
      >
        {scanning ? (
          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
        ) : (
          <Camera className="mr-1.5 size-3.5" />
        )}
        {scanning ? "Lendo a foto…" : "Foto do cardápio"}
      </Button>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      {result && summary && (
        <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-white">
              Li {summary.products} ite{summary.products === 1 ? "m" : "ns"} em {summary.categories}{" "}
              categoria{summary.categories === 1 ? "" : "s"}:
            </p>
            <button
              type="button"
              onClick={() => setResult(null)}
              aria-label="Descartar leitura"
              className="text-gray-500 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {result.map((cat) => (
              <li key={cat.name} className="text-[11px] text-gray-300">
                <span className="font-semibold text-gray-200">{cat.name}</span>
                {" · "}
                {cat.products.map((p) => p.name).join(", ")}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void confirmImport()}
              disabled={importing}
              className="bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 size-3.5" />
              )}
              {importing ? "Importando…" : "Importar cardápio"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setResult(null)}
              className="border-white/10 bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]"
            >
              <Upload className="mr-1.5 size-3.5" /> Outra foto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
