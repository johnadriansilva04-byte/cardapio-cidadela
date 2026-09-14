import { useState, useRef } from "react";
import { Upload, Link2, X, AlertCircle, ImageIcon, Loader2 } from "lucide-react";
import { validateImageUrl } from "@/lib/imageValidation";
import { uploadRestaurantImage } from "@/modules/supabase/storage";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  restaurantId: string;
  kind: "logo" | "banner" | "product";
  placeholder?: string;
  helpText?: string;
};

export function ImageField({ label, value, onChange, restaurantId, kind, placeholder, helpText }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validationMsg = validateImageUrl(value);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setUploadError("Arquivo muito grande (máx. 4MB).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("Selecione um arquivo de imagem.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const { url, error } = await uploadRestaurantImage(restaurantId, file, kind);
    setUploading(false);
    if (url) {
      onChange(url);
      setPreviewError(false);
    } else {
      setUploadError(error ?? "Falha no upload. Tente uma URL direta.");
    }
    // reset input so same file can be picked again
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
        <ImageIcon className="size-3.5 text-gray-500" />
        {label}
      </label>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-600" />
          <input
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setPreviewError(false);
            }}
            placeholder={placeholder ?? "https://... (URL direta da imagem)"}
            className={`w-full rounded-lg border bg-white/[0.03] py-2.5 pl-8 pr-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 ${
              validationMsg
                ? "border-amber-500/40 focus:border-amber-500/60 focus:ring-amber-500/20"
                : "border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20"
            }`}
          />
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/[0.08] disabled:opacity-40">
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {uploading ? "Enviando…" : "Upload"}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>

      <p className="text-[10px] leading-relaxed text-gray-500">
        {helpText ?? "Insira a URL direta da imagem (terminando em .jpg, .jpeg, .png ou .webp) ou faça upload. Evite colar link de página do Facebook — copie o endereço da imagem."}
      </p>

      {validationMsg && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{validationMsg}</span>
        </p>
      )}
      {uploadError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-300">{uploadError}</p>
      )}

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
          {!previewError ? (
            <img
              src={value}
              alt={`Preview — ${label}`}
              className={`w-full object-cover ${kind === "product" ? "h-32" : kind === "logo" ? "h-24 object-contain p-2" : "h-28"}`}
              onError={() => setPreviewError(true)}
            />
          ) : (
            <div className="flex h-24 items-center justify-center gap-2 px-3 text-xs text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              <span>Não foi possível carregar esta imagem. Verifique a URL ou tente outro arquivo.</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              onChange("");
              setPreviewError(false);
            }}
            className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
            aria-label="Remover imagem"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
