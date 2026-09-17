import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Clock,
  ImageIcon,
  Loader2,
  Palette,
  Store,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import OperatingHoursConfig from "@/components/admin/OperatingHoursConfig";
import { uploadRestaurantImage } from "@/modules/supabase/storage";
import {
  DEFAULT_OPERATING_HOURS,
  normalizeOperatingHours,
  type OperatingHours,
} from "@/lib/operatingHours";
import type { Restaurant, RestaurantStatus } from "@/lib/types";
import { generateUniqueSlug } from "@/modules/supabase/restaurants";

export type RestaurantFormValues = {
  name: string;
  slug: string;
  description: string;
  phone: string;
  whatsapp: string;
  address: string;
  logo_url: string;
  banner_url: string;
  primary_color: string;
  secondary_color: string;
  status: RestaurantStatus;
  pix_key: string;
  delivery_fee: string;
  operating_hours: OperatingHours;
};

/** Retorno do envio: o id é necessário para enviar as imagens recém-escolhidas. */
export type RestaurantSubmitResult = { id: string } | Restaurant | null | void;

const fieldClass =
  "border-white/10 bg-white/[0.04] text-white placeholder:text-gray-600 focus-visible:ring-cyan-500/40";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Agrupa campos e cria hierarquia, no lugar de uma pilha de inputs. */
function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-white/[0.06] pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-gray-300">
          {icon}
        </span>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">{title}</h3>
          {hint && <p className="text-[11px] text-gray-600">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Upload visual com arrastar-e-soltar.
 *
 * Guarda o arquivo em memória para permitir escolher a imagem antes de o
 * restaurante existir — o binário sobe logo depois do insert, quando o id já
 * pode compor o caminho no storage.
 */
function ImageUploader({
  label,
  kind,
  value,
  pendingFile,
  onPick,
  onClearValue,
  onClearPending,
  disabled,
}: {
  label: string;
  kind: "logo" | "banner";
  value: string;
  pendingFile: File | null;
  onPick: (file: File) => void;
  onClearValue: () => void;
  onClearPending: () => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const shown = preview ?? value;
  const isLogo = kind === "logo";

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Máximo 5 MB.");
      return;
    }
    onPick(file);
  }

  return (
    <div className="space-y-2">
      <Label className="text-gray-300">{label}</Label>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative overflow-hidden rounded-xl border border-dashed border-white/15 bg-black/30 transition-colors hover:border-cyan-500/40 ${
          isLogo ? "aspect-square" : "aspect-[21/9]"
        }`}
      >
        {shown ? (
          <>
            <img
              src={shown}
              alt={`Prévia — ${label}`}
              className={`size-full ${isLogo ? "object-contain p-3" : "object-cover"}`}
            />
            <button
              type="button"
              onClick={() => (pendingFile ? onClearPending() : onClearValue())}
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black/90"
              aria-label={`Remover ${label}`}
              title="Remover imagem"
            >
              <Trash2 className="size-3.5" />
            </button>
            {pendingFile && (
              <span className="absolute bottom-2 left-2 rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-black">
                Envia ao salvar
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-1.5 text-center disabled:opacity-50"
          >
            {isLogo ? (
              <ImageIcon className="size-5 text-gray-600" />
            ) : (
              <Upload className="size-5 text-gray-600" />
            )}
            <span className="text-xs font-medium text-gray-400">Arraste ou clique</span>
            <span className="text-[10px] text-gray-600">JPG, PNG ou WebP até 5 MB</span>
          </button>
        )}
        {disabled && (
          <span className="absolute inset-0 grid place-items-center bg-black/60">
            <Loader2 className="size-5 animate-spin text-cyan-400" />
          </span>
        )}
      </div>
      {shown && !disabled && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/[0.08]"
        >
          <Upload className="size-3.5" /> Trocar imagem
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function buildInitial(restaurant: Restaurant | null): RestaurantFormValues {
  return {
    name: restaurant?.name ?? "",
    slug: restaurant?.slug ?? "",
    description: restaurant?.description ?? "",
    phone: restaurant?.phone ?? "",
    whatsapp: restaurant?.whatsapp ?? "",
    address: restaurant?.address ?? "",
    logo_url: restaurant?.logo_url ?? "",
    banner_url: restaurant?.banner_url ?? "",
    primary_color: restaurant?.primary_color ?? "#06b6d4",
    secondary_color: restaurant?.secondary_color ?? "#8b5cf6",
    status: (restaurant?.status as RestaurantStatus) ?? "published",
    pix_key: restaurant?.pix_key ?? "",
    delivery_fee: restaurant?.delivery_fee ? String(restaurant.delivery_fee) : "",
    operating_hours: restaurant?.operating_hours
      ? normalizeOperatingHours(restaurant.operating_hours)
      : { ...DEFAULT_OPERATING_HOURS },
  };
}

export function RestaurantDialog({
  open,
  onOpenChange,
  restaurant,
  onSubmit,
  submitting = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: Restaurant | null;
  /**
   * Persiste o restaurante. Em criação, devolva o registro criado (o diálogo
   * precisa do id para enviar as imagens); em edição, `patchId` permite salvar
   * um restaurante recém-criado sem depender do estado da tela.
   */
  onSubmit: (
    values: RestaurantFormValues,
    isEdit: boolean,
    patchId?: string,
  ) => Promise<RestaurantSubmitResult>;
  submitting?: boolean;
}) {
  const isEdit = Boolean(restaurant);
  const [form, setForm] = useState<RestaurantFormValues>(() => buildInitial(restaurant));
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(false);
    setLogoFile(null);
    setBannerFile(null);
    setForm(buildInitial(restaurant));
  }, [open, restaurant]);

  function patch(part: Partial<RestaurantFormValues>) {
    setForm((s) => ({ ...s, ...part }));
  }

  /** Sobe logo/banner para um restaurante que já existe. */
  async function uploadPending(id: string): Promise<Partial<RestaurantFormValues>> {
    const urls: Partial<RestaurantFormValues> = {};
    if (logoFile) {
      const res = await uploadRestaurantImage(id, logoFile, "logo");
      if (res.url) urls.logo_url = res.url;
      else if (res.error) setError(res.error);
    }
    if (bannerFile) {
      const res = await uploadRestaurantImage(id, bannerFile, "banner");
      if (res.url) urls.banner_url = res.url;
      else if (res.error) setError(res.error);
    }
    return urls;
  }

  /** Descobre o id de um resultado de submit, em qualquer um dos formatos aceitos. */
  function resultId(result: RestaurantSubmitResult): string | undefined {
    if (!result) return undefined;
    if (typeof result === "object" && "id" in result) return result.id;
    return undefined;
  }

  async function handleSubmit() {
    setError(null);
    if (submitting) return;

    const name = form.name.trim();
    if (!name) {
      setError("Informe o nome do restaurante.");
      return;
    }
    const slug =
      form.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "") || slugify(name);
    if (!slug) {
      setError("Link inválido. Use letras, números e hífens.");
      return;
    }

    const uniqueSlug = await generateUniqueSlug(slug, restaurant?.id);
    const values: RestaurantFormValues = { ...form, name, slug: uniqueSlug };
    const hasFiles = Boolean(logoFile || bannerFile);

    try {
      if (isEdit && restaurant) {
        setUploading(true);
        const urls = await uploadPending(restaurant.id);
        setUploading(false);
        await onSubmit({ ...values, ...urls }, true);
        onOpenChange(false);
        return;
      }

      // Criação: salva primeiro (o storage exige o restaurante existindo) e
      // completa com as imagens em seguida.
      const created = await onSubmit(values, false);
      const id = resultId(created);
      if (!id) {
        // Falhou: o diálogo continua aberto para o usuário corrigir.
        return;
      }
      if (hasFiles) {
        setUploading(true);
        const urls = await uploadPending(id);
        setUploading(false);
        if (Object.keys(urls).length > 0) {
          await onSubmit({ ...values, ...urls }, true, id);
        }
      }
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  }

  const busy = submitting || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden border-white/10 bg-[#0f0f14] p-0 text-white sm:max-w-5xl"
      >
        {/* Cabeçalho fixo: contexto e ação sempre à vista */}
        <header className="flex shrink-0 items-start gap-3 border-b border-white/[0.06] px-6 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
            <Store className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base font-bold text-white">
              {isEdit ? `Editar ${restaurant?.name}` : "Novo restaurante"}
            </DialogTitle>
            <p className="text-xs text-gray-500">
              {isEdit
                ? "Altere as informações e salve. O link público atualiza na hora."
                : "Configure todas as informações em uma única tela. O cardápio já nasce publicado com itens de exemplo."}
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <Section icon={<Store className="size-3.5" />} title="Dados básicos">
                <div>
                  <Label htmlFor="rest-name" className="text-gray-300">
                    Nome *
                  </Label>
                  <Input
                    id="rest-name"
                    value={form.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((s) => ({ ...s, name: v, slug: slugTouched ? s.slug : slugify(v) }));
                    }}
                    placeholder="Ex: Cantina da Pracinha"
                    className={`mt-1.5 ${fieldClass}`}
                  />
                </div>
                <div>
                  <Label htmlFor="rest-slug" className="text-gray-300">
                    Link público
                  </Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="shrink-0 text-xs text-gray-500">/cardapio/</span>
                    <Input
                      id="rest-slug"
                      value={form.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
                      }}
                      placeholder="cantina-da-pracinha"
                      className={`flex-1 font-mono text-sm ${fieldClass}`}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-600">
                    Se já existir, ajustamos automaticamente.
                  </p>
                </div>
                <div>
                  <Label htmlFor="rest-desc" className="text-gray-300">
                    Descrição / slogan
                  </Label>
                  <Textarea
                    id="rest-desc"
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="Ex: Massas artesanais desde 2018"
                    rows={2}
                    className={`mt-1.5 ${fieldClass}`}
                  />
                </div>
              </Section>

              <Section icon={<Store className="size-3.5" />} title="Contato">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rest-phone" className="text-gray-300">
                      Telefone
                    </Label>
                    <Input
                      id="rest-phone"
                      value={form.phone}
                      onChange={(e) => patch({ phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      className={`mt-1.5 ${fieldClass}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rest-wa" className="text-gray-300">
                      WhatsApp
                    </Label>
                    <Input
                      id="rest-wa"
                      value={form.whatsapp}
                      onChange={(e) => patch({ whatsapp: e.target.value })}
                      placeholder="5511999999999"
                      className={`mt-1.5 ${fieldClass}`}
                    />
                    <p className="mt-1 text-[11px] text-gray-600">Recebe os pedidos e o link.</p>
                  </div>
                </div>
              </Section>

              <Section icon={<Store className="size-3.5" />} title="Localização">
                <div>
                  <Label htmlFor="rest-address" className="text-gray-300">
                    Endereço
                  </Label>
                  <Input
                    id="rest-address"
                    value={form.address}
                    onChange={(e) => patch({ address: e.target.value })}
                    placeholder="Rua, número, bairro"
                    className={`mt-1.5 ${fieldClass}`}
                  />
                </div>
              </Section>

              <Section
                icon={<Wallet className="size-3.5" />}
                title="Delivery"
                hint="Valor inicial da entrega, usado quando o bairro não tem taxa própria."
              >
                <div>
                  <Label htmlFor="rest-delivery-fee" className="text-gray-300">
                    Taxa padrão de entrega (R$)
                  </Label>
                  <Input
                    id="rest-delivery-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.delivery_fee}
                    onChange={(e) => patch({ delivery_fee: e.target.value })}
                    placeholder="Ex: 5.00"
                    className={`mt-1.5 ${fieldClass}`}
                  />
                  <p className="mt-1 text-[11px] text-gray-600">
                    Pode ser sobrescrita por bairros específicos.
                  </p>
                </div>
              </Section>

              <Section icon={<Wallet className="size-3.5" />} title="Pagamentos">
                <div>
                  <Label htmlFor="rest-pix" className="text-gray-300">
                    Chave PIX
                  </Label>
                  <Input
                    id="rest-pix"
                    value={form.pix_key}
                    onChange={(e) => patch({ pix_key: e.target.value })}
                    placeholder="CPF, telefone, e-mail ou aleatória"
                    className={`mt-1.5 ${fieldClass}`}
                  />
                  <p className="mt-1 text-[11px] text-gray-600">
                    Exibida no QR Code ao finalizar o pagamento.
                  </p>
                </div>
              </Section>
            </div>

            <div className="space-y-5">
              <Section icon={<ImageIcon className="size-3.5" />} title="Identidade visual">
                <ImageUploader
                  label="Logo"
                  kind="logo"
                  value={form.logo_url}
                  pendingFile={logoFile}
                  onPick={setLogoFile}
                  onClearValue={() => patch({ logo_url: "" })}
                  onClearPending={() => setLogoFile(null)}
                  disabled={uploading}
                />
                <ImageUploader
                  label="Banner / capa"
                  kind="banner"
                  value={form.banner_url}
                  pendingFile={bannerFile}
                  onPick={setBannerFile}
                  onClearValue={() => patch({ banner_url: "" })}
                  onClearPending={() => setBannerFile(null)}
                  disabled={uploading}
                />
              </Section>

              <Section
                icon={<Clock className="size-3.5" />}
                title="Funcionamento"
                hint="Fora desses horários o cardápio não aceita pedidos."
              >
                <OperatingHoursConfig
                  value={form.operating_hours}
                  onChange={(h) => patch({ operating_hours: h })}
                />
              </Section>

              <Section icon={<Palette className="size-3.5" />} title="Aparência">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-300">Cor principal</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        value={form.primary_color}
                        onChange={(e) => patch({ primary_color: e.target.value })}
                        className="size-9 shrink-0 rounded border-0 bg-transparent"
                      />
                      <Input
                        value={form.primary_color}
                        onChange={(e) => patch({ primary_color: e.target.value })}
                        className={`h-9 font-mono text-xs ${fieldClass}`}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-300">Cor secundária</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        value={form.secondary_color}
                        onChange={(e) => patch({ secondary_color: e.target.value })}
                        className="size-9 shrink-0 rounded border-0 bg-transparent"
                      />
                      <Input
                        value={form.secondary_color}
                        onChange={(e) => patch({ secondary_color: e.target.value })}
                        className={`h-9 font-mono text-xs ${fieldClass}`}
                      />
                    </div>
                  </div>
                </div>
                {/* Prévia em tempo real do que o cliente verá no cardápio */}
                <div
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{
                    background: `linear-gradient(135deg, ${form.primary_color}22, ${form.secondary_color}22)`,
                  }}
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-black"
                    style={{ background: form.primary_color }}
                  >
                    <Store className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {form.name || "Nome do restaurante"}
                    </p>
                    <p className="truncate text-[11px] text-gray-400">
                      {form.description || "Descrição ou slogan"}
                    </p>
                  </div>
                  <span
                    className="ml-auto shrink-0 rounded-full px-3 py-1 text-[11px] font-bold text-black"
                    style={{ background: form.secondary_color }}
                  >
                    Pedir
                  </span>
                </div>
              </Section>
            </div>
          </div>

          {error && (
            <p className="mt-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {/* Rodapé fixo: as ações não somem no fim de um formulário longo */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] bg-black/20 px-6 py-4">
          <p className="hidden text-[11px] text-gray-600 sm:block">
            {isEdit ? "As alterações valem no link público." : "Você poderá ajustar tudo depois."}
          </p>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={busy}
              className="bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              {busy ? "Salvando…" : isEdit ? "Salvar restaurante" : "Criar restaurante"}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
