import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { useAuth } from "@/components/AuthProvider";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Cardápio Cidadela" }] }),
  component: PedidosPage,
});

/**
 * Rota legada: o gerenciamento de pedidos agora vive dentro de cada
 * restaurante (/admin/restaurante/$id?tab=pedidos). Redireciona para
 * o primeiro restaurante do dono para não quebrar links antigos.
 */
function PedidosPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const retryRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        await ensureRestaurantsForUser(user!);
        if (cancelled) return;
        const data = await getRestaurantsByOwner(user!.id);
        if (cancelled) return;
        if (data.length > 0) {
          navigate({
            to: "/admin/restaurante/$id",
            params: { id: data[0].id },
            search: { tab: "pedidos" },
            replace: true,
          });
          return;
        }
        if (retryRef.current < 3) {
          retryRef.current++;
          await new Promise((r) => setTimeout(r, retryRef.current * 400));
          if (cancelled) return;
          const retry = await getRestaurantsByOwner(user!.id);
          if (!cancelled && retry.length > 0) {
            navigate({
              to: "/admin/restaurante/$id",
              params: { id: retry[0].id },
              search: { tab: "pedidos" },
              replace: true,
            });
          }
        }
        if (!cancelled) {
          navigate({ to: "/admin/restaurantes", replace: true });
        }
      } catch {
        if (!cancelled) navigate({ to: "/admin/restaurantes", replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return null;
}
