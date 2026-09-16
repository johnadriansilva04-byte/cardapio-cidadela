import { useState, useRef } from "react";
import { Upload, X, ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { uploadRestaurantImage } from "@/modules/supabase/storage";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  restaurantId: string;
  kind: "logo" | "banner" | "product";
};

export function ImageField({ label, value, onChange, restaurantId, kind }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Formato não permitido. Use JPG, PNG ou WebP.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Arquivo muito grande (máx. 5 MB).");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    const { url, error } = await uploadRestaurantImage(restaurantId, file, kind);
    setUploading(false);
    if (url) {
      onChange(url);
      setPreviewError(false);
      setUploadError(null);
    } else {
      setUploadError(error ?? "Falha no upload. Tente novamente.");
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const emptyLabel = kind === "logo" ? "Nenhuma logo ainda" : kind === "banner" ? "Nenhuma capa ainda" : "Sem imagem";
  const cta = value ? "Trocar imagem" : "Upload";
  // Container com proporção fixa + object-fit evita que a foto estique ou achate.
  const ratioClass =
    kind === "logo" ? "aspect-square" : kind === "banner" ? "aspect-[21/9]" : "aspect-[4/3]";
  const fitClass = kind === "logo" ? "object-contain p-3" : "object-cover";

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
        <ImageIcon className="size-3.5 text-gray-500" />
        {label}
      </label>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
        {value && !previewError ? (
          <div className="relative">
            <div className={`w-full overflow-hidden bg-white/[0.02] ${ratioClass}`}>
              <img
                src={value}
                alt={`Preview — ${label}`}
                className={`size-full ${fitClass}`}
                onError={() => setPreviewError(true)}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setPreviewError(false);
              }}
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
              aria-label="Remover imagem"
              title="Remover imagem"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            {previewError ? (
              <>
                <AlertCircle className="size-6 text-red-400" />
                <p className="text-xs text-red-300">Não foi possível carregar esta imagem. Tente outro arquivo.</p>
                <button
                  type="button"
                  onClick={() => setPreviewError(false)}
                  className="text-xs text-gray-400 underline hover:text-white"
                >
                  Tentar novamente
                </button>
              </>
            ) : (
              <>
                <div className="grid size-10 place-items-center rounded-xl bg-white/[0.04] text-gray-600">
                  <ImageIcon className="size-5" />
                </div>
                <p className="text-xs font-medium text-gray-500">{emptyLabel}</p>
                <p className="text-[11px] text-gray-600">JPG, PNG ou WebP até 5 MB</p>
              </>
            )}
          </div>
        )}
      </div>

      <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-gray-200 hover:bg-white/[0.08] disabled:opacity-40">
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? "Enviando…" : cta}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFile}
          disabled={uploading}
        />
      </label>

      {uploadError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-300">
          {uploadError}
        </p>
      )}
    </div>
  );
}
