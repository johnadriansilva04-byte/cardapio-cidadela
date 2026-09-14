import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageField } from "@/components/admin/ImageField";
import { validateImageUrl } from "@/lib/imageValidation";
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
  delivery_radius_km: string;
};

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
  onSubmit: (values: RestaurantFormValues, isEdit: boolean) => Promise<void>;
  submitting?: boolean;
}) {
  const isEdit = Boolean(restaurant);
  const [form, setForm] = useState<RestaurantFormValues>(() => ({
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
    delivery_radius_km: restaurant?.delivery_radius_km ? String(restaurant.delivery_radius_km) : "",
  }));
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(false);
    setForm({
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
      delivery_radius_km: restaurant?.delivery_radius_km
        ? String(restaurant.delivery_radius_km)
        : "",
    });
  }, [open, restaurant]);

  async function handleSubmit() {
    setError(null);
    const name = form.name.trim();
    if (!name) {
      setError("Informe o nome do restaurante.");
      return;
    }
    let slug = form.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    if (!slug) slug = slugify(name);
    if (!slug) {
      setError("Slug inválido. Use letras, números e hífens.");
      return;
    }
    // validate image urls
    const imgErr = validateImageUrl(form.logo_url) ?? validateImageUrl(form.banner_url);
    if (imgErr && (form.logo_url || form.banner_url)) {
      // don't block — ImageField already shows warning, but block facebook page urls
      if (form.logo_url.includes("facebook.com") || form.banner_url.includes("facebook.com")) {
        setError(imgErr);
        return;
      }
    }
    const uniqueSlug = await generateUniqueSlug(slug, restaurant?.id);
    await onSubmit({ ...form, name, slug: uniqueSlug }, isEdit);
  }

  const rid = restaurant?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0f0f14] text-white sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? "Editar restaurante" : "Novo restaurante"}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            {isEdit
              ? "Altere os dados e salve. O link público atualiza ao vivo."
              : "O cardápio nasce publicado e com itens de exemplo."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="rest-name" className="text-gray-300">
              Nome *
            </Label>
            <Input
              id="rest-name"
              value={form.name}
              onChange={(e) => {
                const v = e.target.value;
                setForm((s) => ({
                  ...s,
                  name: v,
                  slug: slugTouched ? s.slug : slugify(v),
                }));
              }}
              placeholder="Ex: Cantina da Pracinha"
              className="border-white/10 bg-white/[0.04] text-white placeholder:text-gray-600"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rest-slug" className="text-gray-300">
              Slug (link público)
            </Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-gray-500">/cardapio/</span>
              <Input
                id="rest-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((s) => ({
                    ...s,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  }));
                }}
                placeholder="cantina-da-pracinha"
                className="flex-1 border-white/10 bg-white/[0.04] font-mono text-sm text-white"
              />
            </div>
            <p className="text-[11px] text-gray-600">
              Letras minúsculas, números e hífens. Se já existir, será ajustado automaticamente.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rest-desc" className="text-gray-300">
              Descrição / slogan
            </Label>
            <Textarea
              id="rest-desc"
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              placeholder="Ex: Massas artesanais desde 2018"
              rows={2}
              className="border-white/10 bg-white/[0.04] text-white placeholder:text-gray-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rest-phone" className="text-gray-300">
                Telefone
              </Label>
              <Input
                id="rest-phone"
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="border-white/10 bg-white/[0.04] text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rest-wa" className="text-gray-300">
                WhatsApp
              </Label>
              <Input
                id="rest-wa"
                value={form.whatsapp}
                onChange={(e) => setForm((s) => ({ ...s, whatsapp: e.target.value }))}
                placeholder="5511999999999"
                className="border-white/10 bg-white/[0.04] text-white"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rest-address" className="text-gray-300">
              Endereço
            </Label>
            <Input
              id="rest-address"
              value={form.address}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
              placeholder="Rua, número, bairro"
              className="border-white/10 bg-white/[0.04] text-white"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rest-pix" className="text-gray-300">
              Chave PIX
            </Label>
            <Input
              id="rest-pix"
              value={form.pix_key}
              onChange={(e) => setForm((s) => ({ ...s, pix_key: e.target.value }))}
              placeholder="CPF, telefone, e-mail ou aleatória"
              className="border-white/10 bg-white/[0.04] text-white"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rest-delivery-fee" className="text-gray-300">
                Taxa de entrega padrão (R$)
              </Label>
              <Input
                id="rest-delivery-fee"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.delivery_fee}
                onChange={(e) => setForm((s) => ({ ...s, delivery_fee: e.target.value }))}
                placeholder="Ex: 5,00"
                className="border-white/10 bg-white/[0.04] text-white"
              />
              <p className="text-[11px] text-gray-600">
                Taxa padrão. Você pode definir taxas por bairro em Configurações do restaurante.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rest-radius" className="text-gray-300">
                Raio de entrega (km)
              </Label>
              <Input
                id="rest-radius"
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={form.delivery_radius_km}
                onChange={(e) => setForm((s) => ({ ...s, delivery_radius_km: e.target.value }))}
                placeholder="Ex: 4"
                className="border-white/10 bg-white/[0.04] text-white"
              />
              <p className="text-[11px] text-gray-600">
                Distância máxima atendida (referência para o cliente).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-gray-300">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((s) => ({ ...s, status: v as RestaurantStatus }))}
              >
                <SelectTrigger className="border-white/10 bg-white/[0.04] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-gray-300">Cor principal</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => setForm((s) => ({ ...s, primary_color: e.target.value }))}
                    className="size-8 rounded border-0 bg-transparent"
                  />
                  <Input
                    value={form.primary_color}
                    onChange={(e) => setForm((s) => ({ ...s, primary_color: e.target.value }))}
                    className="h-8 flex-1 border-white/10 bg-white/[0.04] font-mono text-xs text-white"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-gray-300">Cor secundária</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.secondary_color}
                    onChange={(e) => setForm((s) => ({ ...s, secondary_color: e.target.value }))}
                    className="size-8 rounded border-0 bg-transparent"
                  />
                  <Input
                    value={form.secondary_color}
                    onChange={(e) => setForm((s) => ({ ...s, secondary_color: e.target.value }))}
                    className="h-8 flex-1 border-white/10 bg-white/[0.04] font-mono text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <ImageField
            label="Logo do restaurante"
            value={form.logo_url}
            onChange={(v) => setForm((s) => ({ ...s, logo_url: v }))}
            restaurantId={rid}
            kind="logo"
            placeholder="https://.../logo.jpg"
          />
          <ImageField
            label="Banner / capa"
            value={form.banner_url}
            onChange={(v) => setForm((s) => ({ ...s, banner_url: v }))}
            restaurantId={rid}
            kind="banner"
            placeholder="https://.../banner.jpg"
          />

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50"
          >
            {submitting ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar restaurante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
