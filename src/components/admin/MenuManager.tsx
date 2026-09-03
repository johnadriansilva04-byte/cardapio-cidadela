import { useEffect, useState } from "react";
import {
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
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
} from "@/modules/supabase/menu";

const field =
  "w-full rounded-lg border border-cyan-500/30 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none";

export function MenuManager({ restaurant }: { restaurant: Restaurant }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"categories" | "products">("categories");

  // New category
  const [newCatName, setNewCatName] = useState("");

  // Product form
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodImageUrl, setProdImageUrl] = useState("");

  // Edit states
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
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
    if (cats.length > 0 && !selectedCatId) {
      setSelectedCatId(cats[0].id);
    }
    setLoading(false);
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    const cat = await createCategory(restaurant.id, newCatName);
    if (cat) {
      setCategories([...categories, cat]);
      setNewCatName("");
      setSelectedCatId(cat.id);
    }
  }

  async function saveCategory(id: string) {
    if (!editCatName.trim()) return;
    const ok = await updateCategory(id, editCatName);
    if (ok) {
      setCategories(
        categories.map((c) => (c.id === id ? { ...c, name: editCatName } : c)),
      );
      setEditingCatId(null);
    }
  }

  async function removeCategory(id: string) {
    if (!confirm("Excluir esta categoria e todos seus produtos?")) return;
    const ok = await deleteCategory(id);
    if (ok) {
      setCategories(categories.filter((c) => c.id !== id));
      setProducts(products.filter((p) => p.category_id !== id));
      if (selectedCatId === id) {
        setSelectedCatId(categories.find((c) => c.id !== id)?.id ?? "");
      }
    }
  }

  async function addProduct() {
    if (!prodName.trim() || !prodPrice || !selectedCatId) return;
    const price = Number(prodPrice.replace(",", "."));
    if (isNaN(price)) return;

    const prod = await createProduct({
      restaurant_id: restaurant.id,
      category_id: selectedCatId,
      name: prodName,
      description: prodDesc,
      price,
      image_url: prodImageUrl,
      available: true,
      sort_order: products.filter((p) => p.category_id === selectedCatId).length,
    });

    if (prod) {
      setProducts([...products, prod]);
      setProdName("");
      setProdDesc("");
      setProdPrice("");
      setProdImageUrl("");
    }
  }

  async function saveProduct(id: string) {
    const price = Number(editProd.price.replace(",", "."));
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
            : p,
        ),
      );
      setEditingProdId(null);
    }
  }

  async function toggleAvailability(id: string, available: boolean) {
    const ok = await updateProduct(id, { available });
    if (ok) {
      setProducts(
        products.map((p) => (p.id === id ? { ...p, available } : p)),
      );
    }
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

  const selectedProducts = products.filter(
    (p) => p.category_id === selectedCatId,
  );

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("categories")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
            view === "categories"
              ? "bg-cyan-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          Categorias ({categories.length})
        </button>
        <button
          onClick={() => setView("products")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
            view === "products"
              ? "bg-cyan-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          Produtos ({products.length})
        </button>
      </div>

      {/* Categories view */}
      {view === "categories" && (
        <div className="space-y-3">
          {/* Add category */}
          <div className="flex gap-2">
            <input
              className={field}
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

          {categories.length === 0 && (
            <p className="py-6 text-center text-xs text-gray-500">
              Nenhuma categoria. Crie uma para começar.
            </p>
          )}

          {categories.map((c) => {
            const count = products.filter(
              (p) => p.category_id === c.id,
            ).length;
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-black/40 p-3"
              >
                <GripVertical className="size-4 shrink-0 text-gray-700" />
                {editingCatId === c.id ? (
                  <>
                    <input
                      className={field + " flex-1"}
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveCategory(c.id)}
                      autoFocus
                    />
                    <button
                      onClick={() => saveCategory(c.id)}
                      aria-label="Salvar"
                    >
                      <Check className="size-4 text-green-400" />
                    </button>
                    <button
                      onClick={() => setEditingCatId(null)}
                      aria-label="Cancelar"
                    >
                      <X className="size-4 text-gray-400" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-semibold text-white">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {count} {count === 1 ? "item" : "itens"}
                    </span>
                    <button
                      onClick={() => {
                        setEditingCatId(c.id);
                        setEditCatName(c.name);
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="size-3 text-gray-400" />
                    </button>
                    <button
                      onClick={() => removeCategory(c.id)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="size-3 text-red-500" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Products view */}
      {view === "products" && (
        <div className="space-y-3">
          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCatId(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                  selectedCatId === c.id
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-800 text-gray-400"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Add product */}
          {selectedCatId && (
            <div className="rounded-lg border border-dashed border-cyan-500/30 p-3 space-y-2">
              <input
                className={field}
                placeholder="Nome do produto"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
              />
              <input
                className={field}
                placeholder="Descrição (opcional)"
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className={field + " flex-1"}
                  placeholder="Preço (R$)"
                  inputMode="decimal"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                />
                <input
                  className={field + " flex-1"}
                  placeholder="URL da imagem (opcional)"
                  value={prodImageUrl}
                  onChange={(e) => setProdImageUrl(e.target.value)}
                />
              </div>
              <button
                onClick={addProduct}
                disabled={!prodName.trim() || !prodPrice}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                <Plus className="size-3" /> Adicionar produto
              </button>
            </div>
          )}

          {/* Product list */}
          {selectedProducts.map((p) => (
            <div
              key={p.id}
              className={`rounded-lg border p-3 ${
                p.available
                  ? "border-cyan-500/20 bg-black/40"
                  : "border-gray-700 bg-black/20 opacity-60"
              }`}
            >
              {editingProdId === p.id ? (
                <div className="space-y-2">
                  <input
                    className={field}
                    value={editProd.name}
                    onChange={(e) =>
                      setEditProd({ ...editProd, name: e.target.value })
                    }
                  />
                  <input
                    className={field}
                    value={editProd.description}
                    onChange={(e) =>
                      setEditProd({ ...editProd, description: e.target.value })
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      className={field + " flex-1"}
                      value={editProd.price}
                      onChange={(e) =>
                        setEditProd({ ...editProd, price: e.target.value })
                      }
                    />
                    <input
                      className={field + " flex-1"}
                      value={editProd.image_url}
                      onChange={(e) =>
                        setEditProd({ ...editProd, image_url: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveProduct(p.id)}
                      className="flex-1 rounded-lg bg-green-600 py-1.5 text-xs font-bold text-white"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditingProdId(null)}
                      className="flex-1 rounded-lg bg-gray-800 py-1.5 text-xs font-bold text-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="size-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="size-12 shrink-0 rounded-lg bg-gray-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {p.name}
                    </p>
                    {p.description && (
                      <p className="truncate text-[10px] text-gray-500">
                        {p.description}
                      </p>
                    )}
                    <p className="text-xs font-bold text-cyan-400">
                      {brl(p.price)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => toggleAvailability(p.id, !p.available)}
                      className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                        p.available
                          ? "bg-green-500/20 text-green-300"
                          : "bg-gray-700 text-gray-500"
                      }`}
                    >
                      {p.available ? "ATIVO" : "OFF"}
                    </button>
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
              )}
            </div>
          ))}

          {selectedCatId && selectedProducts.length === 0 && (
            <p className="py-6 text-center text-xs text-gray-500">
              Nenhum produto nesta categoria
            </p>
          )}

          {!selectedCatId && (
            <p className="py-6 text-center text-xs text-gray-500">
              Selecione uma categoria
            </p>
          )}
        </div>
      )}
    </div>
  );
}
