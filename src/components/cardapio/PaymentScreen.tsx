import { useState } from "react";
import { Upload, X, Copy, Check } from "lucide-react";
import { useStore } from "@/modules/cidadela-core/store";
import { supabase } from "@/modules/supabase/client";
import type { Order } from "@/lib/types";

type PaymentScreenProps = {
  order: Order;
  onSuccess: () => void;
  onCancel: () => void;
};

export function PaymentScreen({ order, onSuccess, onCancel }: PaymentScreenProps) {
  const { state } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const pixKey = state.pix || "Chave PIX não configurada";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const storeId = state.admin.storeId || state.admin.accessKey;
      const fileName = `${storeId}/${order.id}/comprovante.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: "awaiting_confirmation",
          payment_proof_url: publicUrl,
        })
        .eq("id", order.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (error) {
      console.error("Erro ao enviar comprovante:", error);
      alert("Erro ao enviar comprovante. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-tech">Pagamento PIX</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-secondary p-4">
            <p className="text-sm text-muted-foreground mb-2">Chave PIX</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-tech break-all">{pixKey}</code>
              <button
                type="button"
                onClick={handleCopyPix}
                className="p-2 rounded hover:bg-muted transition-colors"
                title="Copiar chave PIX"
              >
                {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
              </button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Valor a pagar</p>
            <p className="text-2xl font-bold text-tech mt-1">
              {order.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-tech mb-3">Comprovante de Pagamento *</p>
            <p className="text-xs text-muted-foreground mb-3">
              Tire uma foto do comprovante no seu banco e faça upload aqui.
            </p>

            {!preview ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-tech transition-colors">
                <Upload className="size-8 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground">Clique para selecionar a foto</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt="Comprovante"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                >
                  <X className="size-4 text-white" />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!file || uploading}
              className="flex-1 px-4 py-3 rounded-lg bg-[color:var(--olive)] text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? "Enviando..." : "Enviar Comprovante"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
