import { useEffect, useState } from "react";
import {
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Eye,
  EyeOff,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageField } from "@/components/admin/ImageField";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { Restaurant, Category, Product, ProductAddon } from "@/lib/types";
import { brl } from "@/lib/utils";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  moveProductsToCategory,
  reorderCategories,
  reorderProducts,
  getAddonsByRestaurant,
  createProductAddon,
  updateProductAddon,
  deleteProductAddon,
} from "@/modules/supabase/menu";
import { updateRestaurant } from "@/modules/supabase/restaurants";
import { toast } from "sonner";

const field =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20";

export function MenuManager({ restaurant }: { restaurant: Restaurant }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);

  const [openAddFor, setOpenAddFor] = useState<string | null>(null);
  const [prodForms, setProdForms] = useState<
    Record<string, { name: string; desc: string; price: string; imageUrl: string }>
  >({});

  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editProd, setEditProd] = useState({ name: "", description: "", price: "", image_url: "" });
  const [prodToDelete, setProdToDelete] = useState<Product | null>(null);

  const [newAddon, setNewAddon] = useState<{ name: string; price: string }>({
    name: "",
    price: "",
  });
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [editAddon, setEditAddon] = useState<{ name: string; price: string }>({
    name: "",
    price: "",
  });
  const [addonToDelete, setAddonToDelete] = useState<ProductAddon | null>(null);

  useEffect(() => {
    loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  async function loadMenu() {
    setLoading(true);
    const [cats, prods, ads] = await Promise.all([
      getCategories(restaurant.id),
      getProducts(restaurant.id),
      getAddonsByRestaurant(restaurant.id),
    ]);
    setCategories(cats);
    setProducts(prods);
    setAddons(ads);
    setLoading(false);
  }

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const cat = await createCategory(restaurant.id, name);
    if (cat) {
      setCategories((prev) => [...prev, cat]);
      setNewCatName("");
      toast.success("Categoria criada!");
    } else toast.error("Erro ao criar categoria.");
  }

  async function saveCategory(id: string) {
    const name = editCatName.trim();
    if (!name) return;
    const ok = await updateCategory(id, name);
    if (ok) {
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      setEditingCatId(null);
      toast.success("Categoria atualizada!");
    } else toast.error("Erro ao salvar.");
  }

  async function moveCategory(id: string, direction: "up" | "down") {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sorted.length - 1) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    const tmp = sorted[idx].sort_order;
    sorted[idx] = { ...sorted[idx], sort_order: sorted[swap].sort_order };
    sorted[swap] = { ...sorted[swap], sort_order: tmp };
    setCategories(sorted);
    await reorderCategories(sorted.map((c) => c.id));
  }

  async function confirmDeleteCategory() {
    if (!catToDelete) return;
    const id = catToDelete.id;
    const catProducts = products.filter((p) => p.category_id === id);
    if (catProducts.length > 0) {
      const otherCat = categories.find((c) => c.id !== id);
      if (otherCat) {
        await moveProductsToCategory(id, otherCat.id);
        setProducts((prev) =>
          prev.map((p) => (p.category_id === id ? { ...p, category_id: otherCat.id } : p)),
        );
      } else {
        for (const p of catProducts) await deleteProduct(p.id);
        setProducts((prev) => prev.filter((p) => p.category_id !== id));
      }
    }
    const ok = await deleteCategory(id);
    if (ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Categoria excluída.");
    } else toast.error("Erro ao excluir.");
    setCatToDelete(null);
  }

  function openAddForm(catId: string) {
    setOpenAddFor(catId);
    setProdForms((prev) => ({ ...prev, [catId]: { name: "", desc: "", price: "", imageUrl: "" } }));
  }

  function updateProdForm(catId: string, field: string, value: string) {
    setProdForms((prev) => ({ ...prev, [catId]: { ...prev[catId], [field]: value } }));
  }

  async function addProduct(catId: string) {
    const form = prodForms[catId];
    if (!form?.name.trim() || !form.price) return;
    const price = Number(form.price.replace(",", "."));
    if (isNaN(price) || price <= 0) {
      toast.error("Preço inválido.");
      return;
    }
    const sort = products.filter((p) => p.category_id === catId).length;
    const prod = await createProduct({
      restaurant_id: restaurant.id,
      category_id: catId,
      name: form.name.trim(),
      description: form.desc.trim(),
      price,
      image_url: form.imageUrl.trim(),
      available: true,
      sort_order: sort,
    });
    if (prod) {
      setProducts((prev) => [...prev, prod]);
      setOpenAddFor(null);
      setProdForms((prev) => {
        const next = { ...prev };
        delete next[catId];
        return next;
      });
      toast.success("Produto adicionado!");
    } else toast.error("Erro ao criar produto.");
  }

  async function saveProduct(id: string) {
    const price = Number(editProd.price.replace(",", "."));
    if (isNaN(price) || price <= 0) {
      toast.error("Preço inválido.");
      return;
    }
    const ok = await updateProduct(id, {
      name: editProd.name.trim(),
      description: editProd.description.trim(),
      price,
      image_url: editProd.image_url.trim(),
    });
    if (ok) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                name: editProd.name.trim(),
                description: editProd.description.trim(),
                price,
                image_url: editProd.image_url.trim(),
              }
            : p,
        ),
      );
      setEditingProdId(null);
      toast.success("Produto atualizado!");
    } else toast.error("Erro ao salvar.");
  }

  async function toggleAvailability(id: string, available: boolean) {
    const ok = await updateProduct(id, { available });
    if (ok) setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, available } : p)));
    else toast.error("Erro ao alterar disponibilidade.");
  }

  async function moveProduct(id: string, direction: "up" | "down") {
    const catId = products.find((p) => p.id === id)?.category_id;
    if (!catId) return;
    const sorted = products
      .filter((p) => p.category_id === catId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sorted.length - 1) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    const tmp = sorted[idx].sort_order;
    sorted[idx] = { ...sorted[idx], sort_order: sorted[swap].sort_order };
    sorted[swap] = { ...sorted[swap], sort_order: tmp };
    setProducts((prev) =>
      prev.map((p) => {
        const upd = sorted.find((s) => s.id === p.id);
        return upd ? { ...p, sort_order: upd.sort_order } : p;
      }),
    );
    await reorderProducts(sorted.map((p) => p.id));
  }

  async function confirmDeleteProduct() {
    if (!prodToDelete) return;
    const ok = await deleteProduct(prodToDelete.id);
    if (ok) {
      setProducts((prev) => prev.filter((p) => p.id !== prodToDelete.id));
      setAddons((prev) => prev.filter((a) => a.product_id !== prodToDelete.id));
      toast.success("Produto excluído.");
    } else toast.error("Erro ao excluir.");
    setProdToDelete(null);
  }

  // ====== ADDONS GLOBAIS ======
  async function handleCreateGlobalAddon() {
    if (!newAddon.name.trim() || !newAddon.price) {
      toast.error("Preencha nome e preço do adicional");
      return;
    }
    const price = Number(newAddon.price.replace(",", "."));
    if (isNaN(price) || price < 0) {
      toast.error("Preço inválido");
      return;
    }
    const created = await createProductAddon({
      restaurant_id: restaurant.id,
      product_id: null, // null = adicional global, aplicável a todos os produtos
      name: newAddon.name.trim(),
      price,
    });
    if (!created) {
      toast.error(
        "Erro ao criar adicional — verifique se o supabase/schema.sql foi executado no Supabase.",
      );
      return;
    }
    setAddons((prev) => [...prev, created]);
    setNewAddon({ name: "", price: "" });
    toast.success(`Adicional "${created.name}" adicionado!`);
  }

  async function handleUpdateAddon(id: string) {
    const price = Number(editAddon.price.replace(",", "."));
    if (!editAddon.name.trim() || isNaN(price) || price < 0) {
      toast.error("Nome e preço válidos obrigatórios");
      return;
    }
    const ok = await updateProductAddon(id, { name: editAddon.name.trim(), price });
    if (!ok) {
      toast.error("Falha ao salvar adicional");
      return;
    }
    setAddons((prev) =>
      prev.map((a) => (a.id === id ? { ...a, name: editAddon.name.trim(), price } : a)),
    );
    setEditingAddonId(null);
    toast.success("Adicional atualizado!");
  }

  async function handleToggleAddon(id: string, available: boolean) {
    const ok = await updateProductAddon(id, { available });
    if (ok) setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, available } : a)));
  }

  async function handleDeleteAddon() {
    if (!addonToDelete) return;
    const ok = await deleteProductAddon(addonToDelete.id);
    if (ok) {
      setAddons((prev) => prev.filter((a) => a.id !== addonToDelete.id));
      toast.success("Adicional removido");
    } else toast.error("Erro ao excluir adicional");
    setAddonToDelete(null);
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="mt-3 text-xs text-gray-400">Carregando cardápio…</p>
      </div>
    );
  }

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const activeCount = products.filter((p) => p.available).length;

  return (
    <div className="space-y-4">
      {/* Nova categoria — sempre visível, forma direta */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <p className="mb-2 text-xs font-semibold text-gray-300">Nova categoria</p>
        <div className="flex gap-2">
          <Input
            className={field + " flex-1"}
            placeholder="Ex.: Lanches, Bebidas, Sobremesas"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <Button
            onClick={addCategory}
            disabled={!newCatName.trim()}
            className="shrink-0 bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40"
          >
            <Plus className="size-4" /> Criar
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-16 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/[0.04] text-gray-600">
            <UtensilsCrossed className="size-5" />
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-400">Nenhuma categoria ainda</p>
          <p className="mt-1 text-xs text-gray-600">
            Crie sua primeira categoria acima para começar a montar o cardápio.
          </p>
        </div>
      ) : (
        <>
          {/* Resumo em linha — discreto */}
          <p className="text-xs text-gray-600">
            {sorted.length} categoria{sorted.length === 1 ? "" : "s"} • {products.length} produto
            {products.length === 1 ? "" : "s"} ({activeCount} ativo{activeCount === 1 ? "" : "s"})
            {addons.filter((a) => !a.product_id).length > 0 &&
              ` • ${addons.filter((a) => !a.product_id).length} adicional${addons.filter((a) => !a.product_id).length === 1 ? "" : "is"}`}
          </p>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            {sorted.map((cat, catIndex) => {
              const catProducts = products
                .filter((p) => p.category_id === cat.id)
                .sort((a, b) => a.sort_order - b.sort_order);
              const isAdding = openAddFor === cat.id;
              const isEditing = editingCatId === cat.id;
              const form = prodForms[cat.id];
              const catActive = catProducts.filter((p) => p.available).length;

              return (
                <div
                  key={cat.id}
                  className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0e0e15]"
                >
                  <div className="flex items-center gap-2 border-b border-white/[0.05] bg-white/[0.02] px-4 py-3">
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          className={field + " flex-1"}
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveCategory(cat.id)}
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => saveCategory(cat.id)}
                          className="size-8 shrink-0 text-emerald-400 hover:bg-emerald-500/15"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingCatId(null)}
                          className="size-8 shrink-0 text-gray-400 hover:bg-white/10"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-white">
                          {cat.name}
                        </h3>
                        <span className="shrink-0 text-[11px] font-medium text-gray-600">
                          {catProducts.length === 0
                            ? "vazio"
                            : catActive === catProducts.length
                              ? `${catProducts.length} ${catProducts.length === 1 ? "item" : "itens"}`
                              : `${catActive}/${catProducts.length} ativos`}
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveCategory(cat.id, "up")}
                            disabled={catIndex === 0}
                            title="Mover para cima"
                            className="size-7 text-gray-600 hover:text-white disabled:opacity-30"
                          >
                            <ArrowUp className="size-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveCategory(cat.id, "down")}
                            disabled={catIndex === sorted.length - 1}
                            title="Mover para baixo"
                            className="size-7 text-gray-600 hover:text-white disabled:opacity-30"
                          >
                            <ArrowDown className="size-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingCatId(cat.id);
                              setEditCatName(cat.name);
                            }}
                            title="Renomear categoria"
                            className="size-7 text-gray-600 hover:text-white"
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setCatToDelete(cat)}
                            title="Excluir categoria"
                            className="size-7 text-gray-600 hover:bg-red-500/15 hover:text-red-400"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2 p-3">
                    {catProducts.length === 0 && !isAdding && (
                      <p className="py-6 text-center text-xs text-gray-600">
                        Nenhum produto nesta categoria.
                      </p>
                    )}

                    {catProducts.map((p, prodIndex) => {
                      const isProdEditing = editingProdId === p.id;
                      if (isProdEditing) {
                        return (
                          <div
                            key={p.id}
                            className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] p-3"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                                Editando produto
                              </p>
                              <button
                                onClick={() => setEditingProdId(null)}
                                className="rounded-full p-1 text-gray-500 hover:bg-white/5 hover:text-white"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <Input
                              className={field}
                              value={editProd.name}
                              onChange={(e) => setEditProd({ ...editProd, name: e.target.value })}
                              placeholder="Nome do produto *"
                            />
                            <Textarea
                              className={field + " min-h-[60px]"}
                              value={editProd.description}
                              onChange={(e) =>
                                setEditProd({ ...editProd, description: e.target.value })
                              }
                              placeholder="Descrição (opcional)"
                              rows={2}
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-gray-400">Preço (R$) *</Label>
                                <Input
                                  className={field}
                                  value={editProd.price}
                                  onChange={(e) =>
                                    setEditProd({ ...editProd, price: e.target.value })
                                  }
                                  placeholder="19,90"
                                  inputMode="decimal"
                                />
                              </div>
                              <ImageField
                                label="Foto do produto"
                                value={editProd.image_url}
                                onChange={(v) => setEditProd({ ...editProd, image_url: v })}
                                restaurantId={restaurant.id}
                                kind="product"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => saveProduct(p.id)}
                                className="flex-1 bg-emerald-500 text-white hover:bg-emerald-400"
                              >
                                Salvar alterações
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setEditingProdId(null)}
                                className="flex-1 border-white/10 bg-white/[0.04] text-gray-300"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={p.id}
                          className={`rounded-xl border transition-colors ${
                            p.available
                              ? "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                              : "border-amber-500/15 bg-amber-500/[0.03] opacity-80 hover:opacity-100"
                          }`}
                        >
                          <div className="flex items-center gap-3 p-2.5">
                            {p.image_url ? (
                              <div className="aspect-square size-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="size-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.opacity = "0.15";
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-white/[0.03] text-gray-700 ring-1 ring-white/10">
                                <UtensilsCrossed className="size-4 text-gray-600" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                              {p.description && (
                                <p className="truncate text-xs text-gray-600">{p.description}</p>
                              )}
                              <p className="mt-0.5 text-sm font-black text-cyan-300">
                                {brl(p.price)}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={() => toggleAvailability(p.id, !p.available)}
                                title={p.available ? "Pausar produto" : "Ativar produto"}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                                  p.available
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                    : "border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                }`}
                              >
                                {p.available ? (
                                  <Eye className="size-2.5" />
                                ) : (
                                  <EyeOff className="size-2.5" />
                                )}
                                {p.available ? "Ativo" : "Pausado"}
                              </button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => moveProduct(p.id, "up")}
                                disabled={prodIndex === 0}
                                title="Mover para cima"
                                className="size-7 text-gray-600 hover:text-white disabled:opacity-30"
                              >
                                <ArrowUp className="size-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => moveProduct(p.id, "down")}
                                disabled={prodIndex === catProducts.length - 1}
                                title="Mover para baixo"
                                className="size-7 text-gray-600 hover:text-white disabled:opacity-30"
                              >
                                <ArrowDown className="size-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingProdId(p.id);
                                  setEditProd({
                                    name: p.name,
                                    description: p.description,
                                    price: String(p.price),
                                    image_url: p.image_url,
                                  });
                                }}
                                title="Editar produto"
                                className="size-7 text-gray-600 hover:bg-cyan-500/15 hover:text-cyan-300"
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setProdToDelete(p)}
                                title="Excluir produto"
                                className="size-7 text-gray-600 hover:bg-red-500/15 hover:text-red-400"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isAdding ? (
                      <div className="space-y-3 rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/[0.04] p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                          Novo produto em {cat.name}
                        </p>
                        <Input
                          className={field}
                          placeholder="Nome do produto *"
                          value={form?.name ?? ""}
                          onChange={(e) => updateProdForm(cat.id, "name", e.target.value)}
                          autoFocus
                        />
                        <Textarea
                          className={field + " min-h-[60px]"}
                          placeholder="Descrição (opcional)"
                          value={form?.desc ?? ""}
                          onChange={(e) => updateProdForm(cat.id, "desc", e.target.value)}
                          rows={2}
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400">Preço (R$) *</Label>
                            <Input
                              className={field}
                              placeholder="19,90"
                              inputMode="decimal"
                              value={form?.price ?? ""}
                              onChange={(e) => updateProdForm(cat.id, "price", e.target.value)}
                            />
                          </div>
                          <ImageField
                            label="Foto do produto"
                            value={form?.imageUrl ?? ""}
                            onChange={(v) => updateProdForm(cat.id, "imageUrl", v)}
                            restaurantId={restaurant.id}
                            kind="product"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => addProduct(cat.id)}
                            disabled={!form?.name.trim() || !form?.price}
                            className="flex-1 bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40"
                          >
                            <Plus className="size-3.5" /> Adicionar produto
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setOpenAddFor(null)}
                            className="border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => openAddForm(cat.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 py-2.5 text-xs font-semibold text-gray-500 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-cyan-300"
                      >
                        <Plus className="size-3.5" /> Adicionar produto
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Adicionais Globais */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0e0e15]">
              <div className="flex items-center gap-2 border-b border-white/[0.05] bg-white/[0.02] px-4 py-3">
                <Sparkles className="size-3.5 shrink-0 text-violet-400" />
                <h3 className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-white">
                  Adicionais
                </h3>
                <span className="shrink-0 text-[11px] font-medium text-gray-600">
                  {addons.filter((a) => !a.product_id).length === 0
                    ? "nenhum"
                    : `${addons.filter((a) => !a.product_id).length} cadastrado${addons.filter((a) => !a.product_id).length === 1 ? "" : "s"}`}
                </span>
              </div>

              <div className="space-y-2 p-3">
                {addons.filter((a) => !a.product_id).length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-600">
                    Ofereça extras como "Ovo", "Bacon extra" — aparecem em todos os produtos.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {addons
                      .filter((a) => !a.product_id)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((a) =>
                        editingAddonId === a.id ? (
                          <div
                            key={a.id}
                            className="flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.04] px-3 py-2"
                          >
                            <Input
                              value={editAddon.name}
                              onChange={(e) => setEditAddon({ ...editAddon, name: e.target.value })}
                              className="h-8 flex-1 border-white/10 bg-white/[0.05] text-xs text-white"
                            />
                            <Input
                              value={editAddon.price}
                              onChange={(e) =>
                                setEditAddon({ ...editAddon, price: e.target.value })
                              }
                              className="h-8 w-20 border-white/10 bg-white/[0.05] text-xs text-white"
                              inputMode="decimal"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleUpdateAddon(a.id)}
                              className="size-7 shrink-0 text-emerald-400 hover:bg-emerald-500/15"
                            >
                              <Check className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingAddonId(null)}
                              className="size-7 shrink-0 text-gray-400 hover:bg-white/10"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            key={a.id}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                              a.available
                                ? "border-white/[0.06] bg-white/[0.03]"
                                : "border-amber-500/15 bg-amber-500/[0.04] opacity-70"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white">{a.name}</p>
                              <p className="text-xs font-bold text-violet-300">
                                + {brl(Number(a.price))}
                              </p>
                            </div>
                            <button
                              onClick={() => handleToggleAddon(a.id, !a.available)}
                              title={a.available ? "Desativar" : "Ativar"}
                              className={`grid size-7 place-items-center rounded-full transition-colors ${
                                a.available
                                  ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                  : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                              }`}
                            >
                              {a.available ? (
                                <Eye className="size-3" />
                              ) : (
                                <EyeOff className="size-3" />
                              )}
                            </button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingAddonId(a.id);
                                setEditAddon({ name: a.name, price: String(a.price) });
                              }}
                              title="Editar adicional"
                              className="size-7 text-gray-500 hover:text-white"
                            >
                              <Pencil className="size-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setAddonToDelete(a)}
                              title="Excluir adicional"
                              className="size-7 text-gray-500 hover:bg-red-500/15 hover:text-red-400"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        ),
                      )}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Nome (ex: Ovo)"
                    value={newAddon.name}
                    onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateGlobalAddon()}
                    className="h-9 flex-1 border-white/10 bg-white/[0.04] text-xs text-white placeholder:text-gray-600"
                  />
                  <Input
                    placeholder="3,00"
                    value={newAddon.price}
                    onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateGlobalAddon()}
                    className="h-9 w-24 border-white/10 bg-white/[0.04] text-xs text-white placeholder:text-gray-600"
                    inputMode="decimal"
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateGlobalAddon}
                    disabled={!newAddon.name.trim() || !newAddon.price}
                    className="h-9 shrink-0 bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40"
                  >
                    <Plus className="size-3.5" /> Adicionar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(catToDelete)}
        onOpenChange={(o) => !o && setCatToDelete(null)}
        title="Excluir categoria?"
        description={
          catToDelete
            ? `"${catToDelete.name}" será excluída. Produtos serão movidos para outra categoria quando houver, ou apagados se for a última.`
            : ""
        }
        confirmLabel="Excluir"
        onConfirm={confirmDeleteCategory}
      />
      <ConfirmDialog
        open={Boolean(prodToDelete)}
        onOpenChange={(o) => !o && setProdToDelete(null)}
        title="Excluir produto?"
        description={prodToDelete ? `"${prodToDelete.name}" será removido do cardápio.` : ""}
        confirmLabel="Excluir"
        onConfirm={confirmDeleteProduct}
      />
      <ConfirmDialog
        open={Boolean(addonToDelete)}
        onOpenChange={(o) => !o && setAddonToDelete(null)}
        title="Excluir adicional?"
        description={
          addonToDelete ? `"${addonToDelete.name}" será removido de todos os produtos.` : ""
        }
        confirmLabel="Excluir"
        onConfirm={handleDeleteAddon}
      />
    </div>
  );
}
