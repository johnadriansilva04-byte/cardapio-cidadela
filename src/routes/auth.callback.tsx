import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/modules/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Verificar se há parâmetros de callback do Supabase
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const error = hashParams.get("error");
        const errorDescription = hashParams.get("error_description");

        if (error) {
          console.error("Erro no callback OAuth:", error, errorDescription);
          // Redirecionar para home com erro
          navigate({ to: "/", search: { authError: error } });
          return;
        }

        if (accessToken) {
          // Supabase vai processar o session automaticamente
          // Só precisamos esperar um pouco e redirecionar
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user?.email) {
            // Salvar que acabou de fazer login com Google
            localStorage.setItem("google_auth_just_logged_in", "true");
            localStorage.setItem("google_auth_email", session.user.email);
          }
        }

        // Redirecionar para home após processar
        navigate({ to: "/" });
      } catch (error) {
        console.error("Erro ao processar callback:", error);
        navigate({ to: "/" });
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <div className="mb-4 size-12 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
        <p className="text-white">Processando login...</p>
      </div>
    </div>
  );
}
