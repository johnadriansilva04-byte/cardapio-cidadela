import { useEffect, useState } from "react";
import { Trash2, Plus, Pencil, Check, X, ArrowUp, ArrowDown, GripVertical, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageField } from "@/components/admin/ImageField";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { Restaurant, Category, Product } from "@/lib/types";
import { brl } from "@/lib/utils";
import { validateImageUrl } from "@/lib/imageValidation";
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
} from "@/modules/supabase/menu";
import { toast } from "sonner";

const field = "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20";

export function MenuManager({ restaurant }: { restaurant: Restaurant }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);

  const [openAddFor, setOpenAddFor] = useState<string | null>(null);
  const [prodForms, setProdForms] = useState<Record<string, { name: string; desc: string; price: string; imageUrl: string }>>({});

  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editProd, setEditProd] = useState({ name: "", description: "", price: "", image_url: "" });
  const [prodToDelete, setProdToDelete] = useState<Product | null>(null);

  useEffect(() => {
    loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  async function loadMenu() {
    setLoading(true);
    const [cats, prods] = await Promise.all([getCategories(restaurant.id), getProducts(restaurant.id)]);
    setCategories(cats);
    setProducts(prods);
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
        setProducts((prev) => prev.map((p) => (p.category_id === id ? { ...p, category_id: otherCat.id } : p)));
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
    const vErr = validateImageUrl(form.imageUrl);
    if (vErr && form.imageUrl.includes("facebook.com")) {
      toast.error(vErr);
      return;
    }
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
    const vErr = validateImageUrl(editProd.image_url);
    if (vErr && editProd.image_url.includes("facebook.com")) {
      toast.error(vErr);
      return;
    }
    const price = Number(editProd.price.replace(",", "."));
    if (isNaN(price) || price <= 0) {
      toast.error("Preço inválido.");
      return;
    }
    const ok = await updateProduct(id, { name: editProd.name.trim(), description: editProd.description.trim(), price, image_url: editProd.image_url.trim() });
    if (ok) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, name: editProd.name.trim(), description: editProd.description.trim(), price, image_url: editProd.image_url.trim() } : p)));
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
    const sorted = products.filter((p) => p.category_id === catId).sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sorted.length - 1) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    const tmp = sorted[idx].sort_order;
    sorted[idx] = { ...sorted[idx], sort_order: sorted[swap].sort_order };
    sorted[swap] = { ...sorted[swap], sort_order: tmp };
    setProducts((prev) => prev.map((p) => {
      const upd = sorted.find((s) => s.id === p.id);
      return upd ? { ...p, sort_order: upd.sort_order } : p;
    }));
    await reorderProducts(sorted.map((p) => p.id));
  }

  async function confirmDeleteProduct() {
    if (!prodToDelete) return;
    const ok = await deleteProduct(prodToDelete.id);
    if (ok) {
      setProducts((prev) => prev.filter((p) => p.id !== prodToDelete.id));
      toast.success("Produto excluído.");
    } else toast.error("Erro ao excluir.");
    setProdToDelete(null);
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Categorias do cardápio</p>
        <div className="flex gap-2">
          <Input className={field + " flex-1"} placeholder="Nova categoria (ex: Lanches, Bebidas)" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} />
          <Button onClick={addCategory} disabled={!newCatName.trim()} className="shrink-0 bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40">
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      </div>

      {sorted.map((cat, catIndex) => {
        const catProducts = products.filter((p) => p.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
        const isAdding = openAddFor === cat.id;
        const isEditing = editingCatId === cat.id;
        const form = prodForms[cat.id];

        return (
          <div key={cat.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.03] px-3 py-3">
              <GripVertical className="size-3.5 shrink-0 text-gray-700" />
              {isEditing ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input className={field + " flex-1"} value={editCatName} onChange={(e) => setEditCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCategory(cat.id)} autoFocus />
                  <Button size="icon" variant="ghost" onClick={() => saveCategory(cat.id)} className="size-8 text-emerald-400 hover:bg-emerald-500/15">
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingCatId(null)} className="size-8 text-gray-400 hover:bg-white/10">
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <h3 className="flex-1 truncate text-sm font-bold uppercase tracking-wide text-white">{cat.name}</h3>
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-gray-300">
                    {catProducts.length} {catProducts.length === 1 ? "item" : "itens"}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => moveCategory(cat.id, "up")} disabled={catIndex === 0} className="size-7 text-gray-500 hover:text-white disabled:opacity-30">
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => moveCategory(cat.id, "down")} disabled={catIndex === sorted.length - 1} className="size-7 text-gray-500 hover:text-white disabled:opacity-30">
                    <ArrowDown className="size-3" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }} className="size-7 text-gray-500 hover:text-white">
                    <Pencil className="size-3" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setCatToDelete(cat)} className="size-7 text-gray-500 hover:bg-red-500/15 hover:text-red-400">
                    <Trash2 className="size-3" />
                  </Button>
                </>
              )}
            </div>

            <div className="px-3 pt-3">
              {isAdding ? (
                <div className="space-y-3 rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/[0.03] p-3">
                  <Input className={field} placeholder="Nome do produto *" value={form?.name ?? ""} onChange={(e) => updateProdForm(cat.id, "name", e.target.value)} autoFocus />
                  <Textarea className={field + " min-h-[60px]"} placeholder="Descrição (opcional)" value={form?.desc ?? ""} onChange={(e) => updateProdForm(cat.id, "desc", e.target.value)} rows={2} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Preço (R$) *</Label>
                      <Input className={field} placeholder="19,90" inputMode="decimal" value={form?.price ?? ""} onChange={(e) => updateProdForm(cat.id, "price", e.target.value)} />
                    </div>
                    <div className="sm:col-span-1">
                      <ImageField label="Foto do produto" value={form?.imageUrl ?? ""} onChange={(v) => updateProdForm(cat.id, "imageUrl", v)} restaurantId={restaurant.id} kind="product" placeholder="https://.../produto.jpg" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => addProduct(cat.id)} disabled={!form?.name.trim() || !form?.price} className="flex-1 bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40">
                      <Plus className="size-3.5" /> Adicionar produto
                    </Button>
                    <Button variant="outline" onClick={() => setOpenAddFor(null)} className="border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => openAddForm(cat.id)} variant="outline" className="mb-3 w-full justify-center gap-2 border-dashed border-cyan-500/30 bg-transparent py-5 text-xs font-semibold text-cyan-300 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-cyan-200">
                  <Plus className="size-3.5" /> Adicionar produto em {cat.name}
                </Button>
              )}
            </div>

            <div className="space-y-2 px-3 pb-3">
              {catProducts.length === 0 && !isAdding && <p className="py-6 text-center text-xs text-gray-600">Nenhum produto nesta categoria.</p>}
              {catProducts.map((p, prodIndex) => {
                const isProdEditing = editingProdId === p.id;
                if (isProdEditing) {
                  return (
                    <div key={p.id} className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
                      <Input className={field} value={editProd.name} onChange={(e) => setEditProd({ ...editProd, name: e.target.value })} placeholder="Nome" />
                      <Textarea className={field + " min-h-[60px]"} value={editProd.description} onChange={(e) => setEditProd({ ...editProd, description: e.target.value })} placeholder="Descrição" rows={2} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-400">Preço (R$) *</Label>
                          <Input className={field} value={editProd.price} onChange={(e) => setEditProd({ ...editProd, price: e.target.value })} placeholder="19,90" />
                        </div>
                        <ImageField label="Foto" value={editProd.image_url} onChange={(v) => setEditProd({ ...editProd, image_url: v })} restaurantId={restaurant.id} kind="product" />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => saveProduct(p.id)} className="flex-1 bg-emerald-500 text-white hover:bg-emerald-400">
                          Salvar
                        </Button>
                        <Button variant="outline" onClick={() => setEditingProdId(null)} className="flex-1 border-white/10 bg-white/[0.04] text-gray-300">
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${p.available ? "border-white/10 bg-black/20" : "border-amber-500/20 bg-amber-500/[0.03] opacity-75"}`}>
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="size-11 shrink-0 rounded-xl object-cover" onError={(e) => ((e.currentTarget.style.display = "none"))} /> : <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/5 text-gray-600"><AlertCircle className="size-4" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                      {p.description && <p className="truncate text-xs text-gray-500">{p.description}</p>}
                      <p className="mt-0.5 text-xs font-bold text-cyan-300">{brl(p.price)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button onClick={() => toggleAvailability(p.id, !p.available)} className={`rounded-full px-2 py-1 text-[10px] font-bold ${p.available ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                        {p.available ? "ATIVO" : "PAUSADO"}
                      </button>
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" onClick={() => moveProduct(p.id, "up")} disabled={prodIndex === 0} className="size-6 text-gray-600 hover:text-white disabled:opacity-30">
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => moveProduct(p.id, "down")} disabled={prodIndex === catProducts.length - 1} className="size-6 text-gray-600 hover:text-white disabled:opacity-30">
                          <ArrowDown className="size-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          onClick={() => {
                            setEditingProdId(p.id);
                            setEditProd({ name: p.name, description: p.description, price: String(p.price), image_url: p.image_url });
                          }}
                          className="font-semibold text-gray-400 hover:text-white"
                        >
                          Editar
                        </button>
                        <button onClick={() => setProdToDelete(p)} className="font-semibold text-red-400 hover:text-red-300">
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {sorted.length === 0 && <p className="py-10 text-center text-sm text-gray-500">Nenhuma categoria. Crie uma acima para começar.</p>}

      <ConfirmDialog open={Boolean(catToDelete)} onOpenChange={(o) => !o && setCatToDelete(null)} title="Excluir categoria?" description={catToDelete ? `"${catToDelete.name}" será excluída. Produtos serão movidos para outra categoria quando houver, ou apagados se for a última.` : ""} confirmLabel="Excluir" onConfirm={confirmDeleteCategory} />
      <ConfirmDialog open={Boolean(prodToDelete)} onOpenChange={(o) => !o && setProdToDelete(null)} title="Excluir produto?" description={prodToDelete ? `"${prodToDelete.name}" será removido do cardápio.` : ""} confirmLabel="Excluir" onConfirm={confirmDeleteProduct} />
    </div>
  );
}
