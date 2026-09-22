import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { Promotion } from "@/lib/loyalty";
import { PROMOTION_KIND_LABELS, describePromotion } from "@/lib/loyalty";
import type { Restaurant } from "@/lib/types";
import { deletePromotion, getPromotions, savePromotion } from "@/modules/supabase/promotions";

const field =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none";

const KINDS = Object.keys(PROMOTION_KIND_LABELS) as Promotion["kind"][];

interface DraftPromotion {
  id?: string;
  title: string;
  description: string;
  kind: Promotion["kind"];
  value: string;
  starts_at?: string;
  ends_at?: string;
}

const emptyDraft: DraftPromotion = {
  title: "",
  description: "",
  kind: "reward",
  value: "",
  starts_at: "",
  ends_at: "",
};

/**
 * Promoções do restaurante que aparecem no perfil do cliente.
 *
 * Só o tipo "reward" é resgatável com pontos; os outros são vitrine
 * (pontos em dobro, bônus, desconto) e por isso mostram o rótulo explicativo
 * em vez de um botão de resgate.
 */
export function PromotionsManager({ restaurant }: { restaurant: Restaurant }) {
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftPromotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Promotion | null>(null);

  async function reload() {
    setLoading(true);
    setItems(await getPromotions(restaurant.id));
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só ao trocar de restaurante
  }, [restaurant.id]);

  async function handleSave() {
    if (!draft) return;
    const value = Number(draft.value.replace(",", "."));
    if (!draft.title.trim()) {
      toast.error("Dê um nome para a promoção.");
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    // Validar datas se fornecidas
    if (draft.starts_at && draft.ends_at && new Date(draft.starts_at) >= new Date(draft.ends_at)) {
      toast.error("A data de início deve ser anterior à data de término.");
      return;
    }

    setSaving(true);
    const saved = await savePromotion(restaurant.id, {
      id: draft.id,
      title: draft.title,
      description: draft.description,
      kind: draft.kind,
      value,
      active: true,
      starts_at: draft.starts_at || null,
      ends_at: draft.ends_at || null,
    });
    setSaving(false);

    if (!saved) {
      toast.error("Não foi possível salvar. A migração de promoções já rodou?");
      return;
    }
    toast.success(draft.id ? "Promoção atualizada." : "Promoção criada.");
    setDraft(null);
    void reload();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const ok = await deletePromotion(confirmDelete.id);
    if (ok) toast.success("Promoção removida.");
    else toast.error("Não foi possível remover.");
    setConfirmDelete(null);
    void reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Sparkles className="size-4 text-cyan-400" /> Promoções
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Aparecem no perfil do cliente, junto com os pontos de soberania.
          </p>
        </div>
        {!draft && (
          <Button size="sm" onClick={() => setDraft(emptyDraft)} className="gap-1.5">
            <Plus className="size-4" /> Nova
          </Button>
        )}
      </div>

      {draft && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div>
            <Label htmlFor="promo-title">Título</Label>
            <Input
              id="promo-title"
              className={field}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Ex.: Sobremesa grátis"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="promo-kind">Tipo</Label>
              <select
                id="promo-kind"
                className={field}
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as Promotion["kind"] })}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind} className="bg-[#0b0b12]">
                    {PROMOTION_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="promo-value">
                {draft.kind === "discount"
                  ? "Desconto (%)"
                  : draft.kind === "points_multiplier"
                    ? "Multiplicador"
                    : "Pontos"}
              </Label>
              <Input
                id="promo-value"
                className={field}
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                inputMode="decimal"
                placeholder={draft.kind === "points_multiplier" ? "2" : "30"}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="promo-description">Descrição</Label>
            <Input
              id="promo-description"
              className={field}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Detalhe a regra para o cliente"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="promo-starts">Início (opcional)</Label>
              <Input
                id="promo-starts"
                type="datetime-local"
                className={field}
                value={draft.starts_at}
                onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="promo-ends">Término (opcional)</Label>
              <Input
                id="promo-ends"
                type="datetime-local"
                className={field}
                value={draft.ends_at}
                onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
              />
            </div>
          </div>

          <p className="text-[11px] text-gray-500">
            Como o cliente vê:{" "}
            {describePromotion({
              id: draft.id ?? "",
              title: draft.title,
              description: draft.description,
              kind: draft.kind,
              value: Number(draft.value.replace(",", ".")) || 0,
              starts_at: draft.starts_at || null,
              ends_at: draft.ends_at || null,
            })}
          </p>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDraft(null)}
              className="gap-1.5 text-gray-400"
            >
              <X className="size-4" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-gray-500" />
        </div>
      ) : items.length === 0 ? (
        !draft && (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-gray-500">
            Nenhuma promoção ainda. Crie a primeira para aparecer no perfil dos clientes.
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {items.map((promo) => (
            <li
              key={promo.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{promo.title}</p>
                <p className="text-[11px] text-gray-500">{describePromotion(promo)}</p>
                {promo.starts_at && new Date(promo.starts_at) > new Date() && (
                  <p className="text-[10px] text-cyan-400">Agendada para {new Date(promo.starts_at).toLocaleDateString('pt-BR')}</p>
                )}
                {promo.ends_at && new Date(promo.ends_at) < new Date() && (
                  <p className="text-[10px] text-red-400">Expirou em {new Date(promo.ends_at).toLocaleDateString('pt-BR')}</p>
                )}
              </div>
              <button
                onClick={() =>
                  setDraft({
                    id: promo.id,
                    title: promo.title,
                    description: promo.description,
                    kind: promo.kind,
                    value: String(promo.value),
                    starts_at: promo.starts_at ? new Date(promo.starts_at).toISOString().slice(0, 16) : "",
                    ends_at: promo.ends_at ? new Date(promo.ends_at).toISOString().slice(0, 16) : "",
                  })
                }
                aria-label={`Editar ${promo.title}`}
                className="text-gray-500 transition-colors hover:text-white"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => setConfirmDelete(promo)}
                aria-label={`Remover ${promo.title}`}
                className="text-gray-500 transition-colors hover:text-red-400"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Remover promoção?"
        description={`"${confirmDelete?.title ?? ""}" deixa de aparecer para os clientes. Resgates já feitos não são afetados.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
