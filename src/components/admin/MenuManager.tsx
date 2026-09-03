import { useEffect, useState } from "react";
import {
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import type { Restaurant, Category, Product } from "@/lib/types";
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
} from "@/modules/supabase/menu";

const field =
  "w-full rounded-lg border border-cyan-500/30 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none";

export function MenuManager({ restaurant }: { restaurant: Restaurant }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Category states
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [catDeleteConfirm, setCatDeleteConfirm] = useState<string | null>(null);

  // Product form states per category
  const [openAddFor, setOpenAddFor] = useState<string | null>(null);
  const [prodForms, setProdForms] = useState<
    Record<string, { name: string; desc: string; price: string; imageUrl: string }>
  >({});

  // Product edit states
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editProd, setEditProd] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
  });

  useEffect(() => {
    loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  async function loadMenu() {
    setLoading(true);
    const [cats, prods] = await Promise.all([
      getCategories(restaurant.id),
      getProducts(restaurant.id),
    ]);
    setCategories(cats);
    setProducts(prods);
    setLoading(false);
  }

  // ---- Category handlers ----

  async function addCategory() {
    if (!newCatName.trim()) return;
    const cat = await createCategory(restaurant.id, newCatName);
    if (cat) {
      setCategories([...categories, cat]);
      setNewCatName("");
    }
  }

  async function saveCategory(id: string) {
    if (!editCatName.trim()) return;
    const ok = await updateCategory(id, editCatName);
    if (ok) {
      setCategories(
        categories.map((c) => (c.id === id ? { ...c, name: editCatName } : c))
      );
      setEditingCatId(null);
    }
  }

  async function moveCategory(id: string, direction: "up" | "down") {
    const sorted = [...categories].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sorted.length - 1) return;

    const swap = direction === "up" ? idx - 1 : idx + 1;
    const tempOrder = sorted[idx].sort_order;
    sorted[idx] = { ...sorted[idx], sort_order: sorted[swap].sort_order };
    sorted[swap] = { ...sorted[swap], sort_order: tempOrder };

    setCategories(sorted);
    await reorderCategories(sorted.map((c) => c.id));
  }

  async function removeCategory(id: string) {
    const catProducts = products.filter((p) => p.category_id === id);
    if (catProducts.length > 0) {
      // Move products to first other category
      const otherCat = categories.find((c) => c.id !== id);
      if (otherCat) {
        await moveProductsToCategory(id, otherCat.id);
        setProducts(
          products.map((p) =>
            p.category_id === id ? { ...p, category_id: otherCat.id } : p
          )
        );
      } else {
        // No other category — delete products first
        for (const p of catProducts) {
          await deleteProduct(p.id);
        }
        setProducts(products.filter((p) => p.category_id !== id));
      }
    }

    const ok = await deleteCategory(id);
    if (ok) {
      setCategories(categories.filter((c) => c.id !== id));
      setCatDeleteConfirm(null);
    }
  }

  // ---- Product handlers ----

  function openAddForm(catId: string) {
    setOpenAddFor(catId);
    setProdForms((prev) => ({
      ...prev,
      [catId]: { name: "", desc: "", price: "", imageUrl: "" },
    }));
  }

  function updateProdForm(catId: string, field: string, value: string) {
    setProdForms((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], [field]: value },
    }));
  }

  async function addProduct(catId: string) {
    const form = prodForms[catId];
    if (!form?.name.trim() || !form.price) return;
    const price = Number(form.price.replace(",", "."));
    if (isNaN(price) || price <= 0) return;

    const sort = products.filter((p) => p.category_id === catId).length;

    const prod = await createProduct({
      restaurant_id: restaurant.id,
      category_id: catId,
      name: form.name,
      description: form.desc,
      price,
      image_url: form.imageUrl,
      available: true,
      sort_order: sort,
    });

    if (prod) {
      setProducts([...products, prod]);
      setOpenAddFor(null);
      setProdForms((prev) => {
        const next = { ...prev };
        delete next[catId];
        return next;
      });
    }
  }

  async function saveProduct(id: string) {
    const price = Number(editProd.price.replace(",", "."));
    if (isNaN(price)) return;

    const ok = await updateProduct(id, {
      name: editProd.name,
      description: editProd.description,
      price,
      image_url: editProd.image_url,
    });

    if (ok) {
      setProducts(
        products.map((p) =>
          p.id === id
            ? {
                ...p,
                name: editProd.name,
                description: editProd.description,
                price,
                image_url: editProd.image_url,
              }
            : p
        )
      );
      setEditingProdId(null);
    }
  }

  async function toggleAvailability(id: string, available: boolean) {
    const ok = await updateProduct(id, { available });
    if (ok) {
      setProducts(
        products.map((p) => (p.id === id ? { ...p, available } : p))
      );
    }
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
    const tempOrder = sorted[idx].sort_order;
    sorted[idx] = { ...sorted[idx], sort_order: sorted[swap].sort_order };
    sorted[swap] = { ...sorted[swap], sort_order: tempOrder };

    // Update local state for all products in this category
    setProducts((prev) =>
      prev.map((p) => {
        const updated = sorted.find((s) => s.id === p.id);
        if (updated) return { ...p, sort_order: updated.sort_order };
        return p;
      })
    );

    await reorderProducts(sorted.map((p) => p.id));
  }

  async function removeProduct(id: string) {
    const ok = await deleteProduct(id);
    if (ok) {
      setProducts(products.filter((p) => p.id !== id));
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="mt-3 text-xs text-gray-400">Carregando cardápio...</p>
      </div>
    );
  }

  const sorted = [...categories].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <div className="space-y-4">
      {/* Add category row */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Categorias do cardápio
        </p>
        <div className="flex gap-2">
          <input
            className={field + " flex-1"}
            placeholder="Nova categoria"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <button
            onClick={addCategory}
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-cyan-600 text-white hover:bg-cyan-500"
            aria-label="Adicionar categoria"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* Categories as sections */}
      {sorted.map((cat, catIndex) => {
        const catProducts = products
          .filter((p) => p.category_id === cat.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const isAdding = openAddFor === cat.id;
        const isEditing = editingCatId === cat.id;
        const isDeleting = catDeleteConfirm === cat.id;
        const form = prodForms[cat.id];

        return (
          <div
            key={cat.id}
            className="overflow-hidden rounded-xl border border-cyan-500/20 bg-white/[0.02]"
          >
            {/* Category header */}
            <div className="flex items-center gap-3 border-b border-cyan-500/10 bg-cyan-500/[0.05] px-4 py-3">
              <GripVertical className="size-4 shrink-0 text-gray-700" />

              {isEditing ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    className={field + " flex-1"}
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveCategory(cat.id)}
                    autoFocus
                  />
                  <button
                    onClick={() => saveCategory(cat.id)}
                    className="grid size-8 place-items-center rounded-lg hover:bg-green-500/20"
                    aria-label="Salvar"
                  >
                    <Check className="size-4 text-green-400" />
                  </button>
                  <button
                    onClick={() => setEditingCatId(null)}
                    className="grid size-8 place-items-center rounded-lg hover:bg-gray-500/20"
                    aria-label="Cancelar"
                  >
                    <X className="size-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="flex-1 text-sm font-bold text-white uppercase tracking-wide">
                    {cat.name}
                  </h3>
                  <span className="text-[10px] text-gray-500">
                    {catProducts.length}{" "}
                    {catProducts.length === 1 ? "item" : "itens"}
                  </span>

                  {/* Move buttons */}
                  <button
                    onClick={() => moveCategory(cat.id, "up")}
                    disabled={catIndex === 0}
                    className="grid size-7 place-items-center rounded text-gray-500 hover:text-white disabled:opacity-30"
                    aria-label="Mover para cima"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    onClick={() => moveCategory(cat.id, "down")}
                    disabled={catIndex === sorted.length - 1}
                    className="grid size-7 place-items-center rounded text-gray-500 hover:text-white disabled:opacity-30"
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown className="size-3" />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => {
                      setEditingCatId(cat.id);
                      setEditCatName(cat.name);
                    }}
                    className="grid size-7 place-items-center rounded text-gray-500 hover:text-white"
                    aria-label="Editar categoria"
                  >
                    <Pencil className="size-3" />
                  </button>

                  {/* Delete */}
                  {isDeleting ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeCategory(cat.id)}
                        className="rounded bg-red-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-400"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setCatDeleteConfirm(null)}
                        className="rounded bg-gray-800 px-2 py-1 text-[10px] font-bold text-gray-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCatDeleteConfirm(cat.id)}
                      className="grid size-7 place-items-center rounded text-gray-500 hover:text-red-400"
                      aria-label="Excluir categoria"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Add product button / form */}
            <div className="px-4 pt-3">
              {isAdding ? (
                <div className="rounded-lg border border-dashed border-cyan-500/30 p-3 space-y-2">
                  <input
                    className={field}
                    placeholder="Nome do produto"
                    value={form?.name ?? ""}
                    onChange={(e) =>
                      updateProdForm(cat.id, "name", e.target.value)
                    }
                    autoFocus
                  />
                  <input
                    className={field}
                    placeholder="Descrição (opcional)"
                    value={form?.desc ?? ""}
                    onChange={(e) =>
                      updateProdForm(cat.id, "desc", e.target.value)
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      className={field + " flex-1"}
                      placeholder="Preço (R$)"
                      inputMode="decimal"
                      value={form?.price ?? ""}
                      onChange={(e) =>
                        updateProdForm(cat.id, "price", e.target.value)
                      }
                    />
                    <input
                      className={field + " flex-1"}
                      placeholder="URL da imagem"
                      value={form?.imageUrl ?? ""}
                      onChange={(e) =>
                        updateProdForm(cat.id, "imageUrl", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addProduct(cat.id)}
                      disabled={!form?.name.trim() || !form?.price}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
                    >
                      <Plus className="size-3" /> Adicionar produto
                    </button>
                    <button
                      onClick={() => setOpenAddFor(null)}
                      className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => openAddForm(cat.id)}
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-500/30 py-2 text-[11px] font-semibold text-cyan-400 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/5"
                >
                  <Plus className="size-3" /> Adicionar produto
                </button>
              )}
            </div>

            {/* Product list */}
            <div className="space-y-2 px-4 pb-4">
              {catProducts.length === 0 && !isAdding && (
                <p className="py-4 text-center text-[11px] text-gray-600">
                  Nenhum produto nesta categoria
                </p>
              )}

              {catProducts.map((p, prodIndex) => {
                const isProdEditing = editingProdId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg border transition-all ${
                      p.available
                        ? "border-cyan-500/10 bg-black/30"
                        : "border-gray-800 bg-black/10 opacity-50"
                    }`}
                  >
                    {isProdEditing ? (
                      <div className="space-y-2 p-3">
                        <input
                          className={field}
                          value={editProd.name}
                          onChange={(e) =>
                            setEditProd({ ...editProd, name: e.target.value })
                          }
                          placeholder="Nome do produto"
                        />
                        <input
                          className={field}
                          value={editProd.description}
                          onChange={(e) =>
                            setEditProd({
                              ...editProd,
                              description: e.target.value,
                            })
                          }
                          placeholder="Descrição"
                        />
                        <div className="flex gap-2">
                          <input
                            className={field + " flex-1"}
                            value={editProd.price}
                            onChange={(e) =>
                              setEditProd({ ...editProd, price: e.target.value })
                            }
                            placeholder="Preço"
                          />
                          <input
                            className={field + " flex-1"}
                            value={editProd.image_url}
                            onChange={(e) =>
                              setEditProd({
                                ...editProd,
                                image_url: e.target.value,
                              })
                            }
                            placeholder="URL da imagem"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveProduct(p.id)}
                            className="flex-1 rounded-lg bg-green-600 py-1.5 text-xs font-bold text-white hover:bg-green-500"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingProdId(null)}
                            className="flex-1 rounded-lg bg-gray-800 py-1.5 text-xs font-bold text-gray-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="size-11 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="size-11 shrink-0 rounded-lg bg-gray-800/60" />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {p.name}
                          </p>
                          {p.description && (
                            <p className="truncate text-[11px] text-gray-500">
                              {p.description}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs font-bold text-cyan-400">
                            {brl(p.price)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <button
                            onClick={() =>
                              toggleAvailability(p.id, !p.available)
                            }
                            className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                              p.available
                                ? "bg-green-500/20 text-green-300"
                                : "bg-gray-700 text-gray-500"
                            }`}
                          >
                            {p.available ? "ATIVO" : "OFF"}
                          </button>

                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => moveProduct(p.id, "up")}
                              disabled={prodIndex === 0}
                              className="grid size-5 place-items-center text-gray-600 hover:text-white disabled:opacity-30"
                              aria-label="Mover para cima"
                            >
                              <ArrowUp className="size-2.5" />
                            </button>
                            <button
                              onClick={() =>
                                moveProduct(p.id, "down")
                              }
                              disabled={
                                prodIndex === catProducts.length - 1
                              }
                              className="grid size-5 place-items-center text-gray-600 hover:text-white disabled:opacity-30"
                              aria-label="Mover para baixo"
                            >
                              <ArrowDown className="size-2.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingProdId(p.id);
                                setEditProd({
                                  name: p.name,
                                  description: p.description,
                                  price: String(p.price),
                                  image_url: p.image_url,
                                });
                              }}
                              className="text-[9px] text-gray-400 hover:text-white"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => removeProduct(p.id)}
                              className="text-[9px] text-red-400 hover:text-red-300"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {sorted.length === 0 && (
        <p className="py-10 text-center text-xs text-gray-500">
          Nenhuma categoria. Crie uma para começar.
        </p>
      )}
    </div>
  );
}
