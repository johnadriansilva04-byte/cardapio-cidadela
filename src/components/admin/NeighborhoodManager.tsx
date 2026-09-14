import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  X,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  Search,
  Import,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { DeliveryNeighborhood, Restaurant } from "@/lib/types";
import { brl } from "@/lib/utils";
import { UF_NAMES } from "@/lib/brazilStates";
import { searchNeighborhoodsByCity, type CityLookupResult } from "@/lib/neighborhoodLookup";
import {
  getNeighborhoods,
  saveNeighborhood,
  deleteNeighborhood,
} from "@/modules/supabase/restaurants";
import { toast } from "sonner";

const field =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none";

export function NeighborhoodManager({ restaurant }: { restaurant: Restaurant }) {
  const [items, setItems] = useState<DeliveryNeighborhood[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFee, setNewFee] = useState("");
  const [savingFee, setSavingFee] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFee, setEditFee] = useState("");
  const [toDelete, setToDelete] = useState<DeliveryNeighborhood | null>(null);

  // Auto-load por cidade
  const [autoCity, setAutoCity] = useState("");
  const [autoUf, setAutoUf] = useState("");
  const [searching, setSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    city: CityLookupResult;
    neighborhoods: string[];
  } | null>(null);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  async function load() {
    setLoading(true);
    const data = await getNeighborhoods(restaurant.id);
    setItems(data);
    setLoading(false);
  }

  function parseFee(raw: string): number {
    return Number(String(raw).replace(",", ".")) || 0;
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      toast.error("Informe o nome do bairro.");
      return;
    }
    const fee = parseFee(newFee);
    if (fee < 0) {
      toast.error("Valor inválido.");
      return;
    }
    setSavingFee(true);
    const row = await saveNeighborhood(restaurant.id, { name, fee });
    setSavingFee(false);
    if (!row) {
      toast.error("Erro ao salvar. Verifique se o bairro já existe.");
      return;
    }
    setItems((prev) =>
      [...prev.filter((n) => n.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setNewName("");
    setNewFee("");
    setAdding(false);
    toast.success("Bairro adicionado!");
  }

  async function handleEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Informe o nome do bairro.");
      return;
    }
    const fee = parseFee(editFee);
    if (fee < 0) {
      toast.error("Valor inválido.");
      return;
    }
    setSavingFee(true);
    const row = await saveNeighborhood(restaurant.id, { id: editingId, name, fee });
    setSavingFee(false);
    if (!row) {
      toast.error("Erro ao salvar. Verifique se o bairro já existe.");
      return;
    }
    setItems((prev) => prev.map((n) => (n.id === editingId ? row : n)));
    setEditingId(null);
    toast.success("Bairro atualizado!");
  }

  async function handleDelete() {
    if (!toDelete) return;
    const ok = await deleteNeighborhood(toDelete.id);
    if (!ok) {
      toast.error("Erro ao excluir.");
      return;
    }
    setItems((prev) => prev.filter((n) => n.id !== toDelete.id));
    setToDelete(null);
    toast.success("Bairro removido.");
  }

  async function handleAutoSearch() {
    const city = autoCity.trim();
    const uf = autoUf.trim().toUpperCase();
    if (!city) {
      toast.error("Digite o nome da cidade.");
      return;
    }
    if (!uf || !UF_NAMES[uf]) {
      toast.error("Informe a UF (ex.: SC, SP, RJ).");
      return;
    }

    setSearching(true);
    setLookupResult(null);
    try {
      const res = await searchNeighborhoodsByCity(city, uf);
      if (!res.city) {
        toast.error("Cidade não encontrada. Confira o nome e a UF.");
        return;
      }
      if (res.neighborhoods.length === 0) {
        toast.error("Não encontramos bairros para essa cidade ainda.");
        return;
      }
      setLookupResult({ city: res.city, neighborhoods: res.neighborhoods });
      setSelectedForImport(new Set(res.neighborhoods));
      toast.success(`${res.neighborhoods.length} bairros encontrados em ${res.city.cityName}!`);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível buscar os bairros agora. Tente novamente em instantes.");
    } finally {
      setSearching(false);
    }
  }

  const alreadyImported = (name: string) =>
    items.some((n) => n.name.trim().toLowerCase() === name.trim().toLowerCase());

  function toggleSelection(name: string) {
    setSelectedForImport((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleSelectAll(candidates: string[]) {
    setSelectedForImport((prev) => {
      const next = new Set(prev);
      const hasAll = candidates.every((c) => next.has(c));
      if (hasAll) candidates.forEach((c) => next.delete(c));
      else candidates.forEach((c) => next.add(c));
      return next;
    });
  }

  async function handleImportSelected() {
    if (!lookupResult || selectedForImport.size === 0) return;
    setImporting(true);

    let added = 0;
    let skipped = 0;
    let failed = 0;
    for (const name of [...lookupResult.neighborhoods].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    )) {
      if (!selectedForImport.has(name)) continue;
      if (alreadyImported(name)) {
        skipped++;
        continue;
      }
      const row = await saveNeighborhood(restaurant.id, { name, fee: 0 });
      if (!row) failed++;
      else {
        added++;
        setItems((prev) =>
          [...prev.filter((n) => n.id !== row.id), row].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
      }
    }

    setImporting(false);
    if (added > 0) {
      toast.success(`${added} bairro(s) importado(s)!`);
    } else if (skipped > 0) {
      toast.info("Tudo já estava cadastrado.");
    } else {
      toast.error("Nenhum bairro pôde ser importado. Verifique os duplicados.");
    }
    setLookupResult(null);
    setSelectedForImport(new Set());
  }

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto size-7 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
            <MapPin className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-white">Taxas por bairro</p>
              {items.length > 0 && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-gray-300">
                  {items.length} {items.length === 1 ? "bairro" : "bairros"}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Cadastre os bairros atendidos e o valor da entrega em cada um. O cliente escolhe o
              bairro no checkout e a taxa é aplicada automaticamente.
            </p>
          </div>
        </div>

        {/* Form adicionar */}
        {adding ? (
          <div className="mt-4 space-y-3 rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/[0.04] p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Nome do bairro *</Label>
                <Input
                  className={field}
                  placeholder="Ex: Centro"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Taxa de entrega (R$) *</Label>
                <Input
                  className={field}
                  placeholder="Ex: 5,00"
                  inputMode="decimal"
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                disabled={savingFee || !newName.trim()}
                className="flex-1 bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40"
              >
                {savingFee ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Adicionar bairro
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                  setNewFee("");
                }}
                className="border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setAdding(true)}
            variant="outline"
            className="mt-4 w-full gap-2 border-dashed border-cyan-500/30 bg-transparent py-5 text-xs font-semibold text-cyan-300 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-cyan-200"
          >
            <Plus className="size-3.5" /> Adicionar bairro atendido
          </Button>
        )}
      </div>
      {/* Auto-load por cidade */}
      <div className="overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.08] via-white/[0.02] to-cyan-500/[0.06] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Buscar bairros automaticamente</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Digite a cidade e a UF e o sistema encontra os bairros da região para você importar
              com um clique. Depois é só ajustar a taxa de cada bairro.
            </p>
          </div>
        </div>

        {!lookupResult ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-gray-400">Cidade *</Label>
              <Input
                className={field}
                placeholder="Ex: Florianópolis"
                value={autoCity}
                onChange={(e) => setAutoCity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAutoSearch()}
              />
            </div>
            <div className="space-y-1.5 sm:w-24">
              <Label className="text-xs text-gray-400">UF *</Label>
              <Input
                className={`${field} uppercase`}
                placeholder="SC"
                maxLength={2}
                value={autoUf}
                onChange={(e) => setAutoUf(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleAutoSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAutoSearch}
                disabled={searching}
                className="w-full gap-2 bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-50 sm:w-auto"
              >
                {searching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {searching ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-200">
                <BadgeCheck className="size-3.5" />
                {lookupResult.neighborhoods.length} bairros em {lookupResult.city.cityName} (
                {lookupResult.city.stateCode})
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSelectAll(lookupResult.neighborhoods)}
                  className="border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-gray-300 hover:bg-white/[0.08]"
                >
                  {lookupResult.neighborhoods.every((n) => selectedForImport.has(n)) &&
                  lookupResult.neighborhoods.length > 0
                    ? "Desmarcar todos"
                    : "Marcar todos"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setLookupResult(null);
                    setSelectedForImport(new Set());
                  }}
                  className="border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-gray-300 hover:bg-white/[0.08]"
                >
                  Cancelar
                </Button>
              </div>
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/20 p-2">
              {[...lookupResult.neighborhoods]
                .sort((a, b) => a.localeCompare(b, "pt-BR"))
                .map((name) => {
                  const checked = selectedForImport.has(name);
                  const dup = alreadyImported(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleSelection(name)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                        checked
                          ? "bg-violet-500/15 text-white hover:bg-violet-500/20"
                          : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <span
                        className={`grid size-4 shrink-0 place-items-center rounded border ${
                          checked
                            ? "border-violet-400 bg-violet-500 text-black"
                            : "border-white/20 bg-transparent"
                        }`}
                      >
                        {checked && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      {dup && (
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                          já cadastrado
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>

            <Button
              onClick={handleImportSelected}
              disabled={importing || selectedForImport.size === 0}
              className="w-full gap-2 bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Import className="size-4" />
              )}
              Importar {selectedForImport.size > 0 ? `${selectedForImport.size} ` : ""}
              bairro(s) selecionado(s)
            </Button>
            <p className="text-[11px] text-gray-600">
              Os bairros importados entram com taxa R$ 0,00 — edite depois para definir o valor da
              entrega de cada um.
            </p>
          </div>
        )}
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-12 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-white/[0.04] text-gray-600">
            <MapPin className="size-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-400">Nenhum bairro cadastrado</p>
          <p className="mt-1 text-xs text-gray-600">
            Adicione bairros para calcular a taxa de entrega por região.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...items]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((n) =>
              editingId === n.id ? (
                <div
                  key={n.id}
                  className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      className={field}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nome do bairro"
                      onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                      autoFocus
                    />
                    <Input
                      className={field}
                      value={editFee}
                      onChange={(e) => setEditFee(e.target.value)}
                      placeholder="Taxa (R$)"
                      inputMode="decimal"
                      onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleEdit}
                      disabled={savingFee}
                      className="flex-1 bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {savingFee ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Salvar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      className="flex-1 border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"
                    >
                      <X className="size-4" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={n.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.12]"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-gray-500">
                    <MapPin className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{n.name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-black text-cyan-300">
                    {brl(n.fee)}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Editar bairro"
                      onClick={() => {
                        setEditingId(n.id);
                        setEditName(n.name);
                        setEditFee(String(n.fee));
                      }}
                      className="size-7 text-gray-500 hover:bg-cyan-500/15 hover:text-cyan-300"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Excluir bairro"
                      onClick={() => setToDelete(n)}
                      className="size-7 text-gray-500 hover:bg-red-500/15 hover:text-red-400"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ),
            )}
        </div>
      )}

      {items.length > 0 && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-600">
          <AlertCircle className="mt-0.5 size-3 shrink-0" />
          No checkout, o cliente escolhe o bairro e paga a taxa dele. Se o bairro não estiver na
          lista, a entrega usa a taxa padrão definida em "Taxa de entrega" do restaurante.
        </p>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir bairro?"
        description={toDelete ? `"${toDelete.name}" será removido da lista de entrega.` : ""}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  );
}
