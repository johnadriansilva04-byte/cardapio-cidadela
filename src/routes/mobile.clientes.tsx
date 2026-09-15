import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Users, Search, Phone, MapPin, TrendingUp, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner } from "@/modules/supabase/restaurants";
import { getOrdersByRestaurant } from "@/modules/supabase/orders";
import { brl } from "@/lib/utils";

export const Route = createFileRoute("/mobile/clientes")({
  head: () => ({
    meta: [{ title: "Clientes — Gestão Mobile" }],
  }),
  component: MobileClientes,
});

interface CustomerStats {
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrder: string;
}

function MobileClientes() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, [user]);

  async function loadCustomers() {
    if (!user) return;
    try {
      setLoading(true);
      const restaurants = await getRestaurantsByOwner(user.id);
      if (restaurants.length === 0) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      const customerMap = new Map<string, CustomerStats>();

      for (const restaurant of restaurants) {
        const orders = await getOrdersByRestaurant(restaurant.id);
        
        for (const order of orders) {
          const key = order.customer_phone || order.customer_name;
          const existing = customerMap.get(key) || {
            name: order.customer_name,
            phone: order.customer_phone || "",
            address: order.delivery_address || "",
            totalOrders: 0,
            totalSpent: 0,
            lastOrder: order.created_at,
          };

          existing.totalOrders += 1;
          existing.totalSpent += Number(order.total);
          if (new Date(order.created_at) > new Date(existing.lastOrder)) {
            existing.lastOrder = order.created_at;
          }

          customerMap.set(key, existing);
        }
      }

      const sortedCustomers = Array.from(customerMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent);

      setCustomers(sortedCustomers);
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="mx-auto size-8 animate-spin text-cyan-400" />
          <p className="mt-3 text-sm text-gray-400">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Clientes</h1>
          <p className="text-xs text-gray-400">{customers.length} cliente{customers.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="grid size-10 place-items-center rounded-xl bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="size-4 text-cyan-400" />
            <span className="text-[10px] font-bold uppercase text-gray-500">Total</span>
          </div>
          <p className="text-lg font-bold text-white">{customers.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="size-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase text-gray-500">Receita</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">
            {brl(customers.reduce((sum, c) => sum + c.totalSpent, 0))}
          </p>
        </div>
      </div>

      {/* Customers List */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="size-12 text-gray-600" />
            <p className="mt-3 text-sm font-medium text-gray-400">
              {searchQuery ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            </p>
            <p className="text-xs text-gray-600">
              {searchQuery ? "Tente outra busca" : "Os clientes aparecerão aqui após pedidos"}
            </p>
          </div>
        ) : (
          filteredCustomers.map((customer, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white">{customer.name}</h3>
                  {customer.phone && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                      <Phone className="size-3" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-1.5 mt-1 text-xs text-gray-400">
                      <MapPin className="size-3 mt-0.5" />
                      <span className="line-clamp-1">{customer.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-500">Pedidos</p>
                  <p className="text-sm font-bold text-white">{customer.totalOrders}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-500">Total gasto</p>
                  <p className="text-sm font-bold text-cyan-400">{brl(customer.totalSpent)}</p>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3">
                <p className="text-[10px] font-bold uppercase text-gray-500">Último pedido</p>
                <p className="text-xs text-gray-400">
                  {new Date(customer.lastOrder).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default MobileClientes;