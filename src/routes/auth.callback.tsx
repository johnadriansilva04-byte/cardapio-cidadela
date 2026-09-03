import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (isAuthenticated) {
      window.location.href = "/admin";
    } else {
      window.location.href = "/login";
    }
  }, [loading, isAuthenticated]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 size-8 animate-spin text-cyan-400" />
        <p className="text-sm text-gray-400">Processando autenticação...</p>
      </div>
    </div>
  );
}
