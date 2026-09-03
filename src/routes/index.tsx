import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Menu Digital — Plataforma de Cardápios" },
      {
        name: "description",
        content:
          "Crie, gerencie e publique cardápios digitais para restaurantes. Plataforma SaaS profissional.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return <AdminDashboard />;
}
