import { Home, ReceiptText, User } from "lucide-react";
import { BottomNav } from "@/components/shared";
import { Badge } from "@/components/shared";

export type CustomerTab = "inicio" | "pedidos" | "perfil";

interface CustomerBottomNavProps {
  active: CustomerTab;
  accent: string;
  /** Pedidos em andamento — vira badge em "Meus pedidos". */
  pendingCount?: number;
  isAuthenticated: boolean;
  onNavigate: (tab: CustomerTab) => void;
}

/**
 * Barra fixa do cardápio público.
 *
 * Segue o mesmo desenho da barra do painel mobile (ícone sobre rótulo, alto
 * contraste) para o cliente reconhecer o padrão. O carrinho não entra aqui:
 * ele tem barra própria, com subtotal e CTA, que aparece só quando há itens.
 */
export default function CustomerBottomNav({
  active,
  accent,
  pendingCount = 0,
  isAuthenticated,
  onNavigate,
}: CustomerBottomNavProps) {
  const items = [
    { id: "inicio", label: "Cardápio", icon: Home },
    { id: "pedidos", label: "Meus pedidos", icon: ReceiptText, badge: pendingCount },
    { id: "perfil", label: isAuthenticated ? "Perfil" : "Entrar", icon: User },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      <nav
        aria-label="Navegação do cardápio"
        className="border-t border-white/[0.08] bg-[#0c0c14]/95 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {items.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as CustomerTab)}
                aria-current={isActive ? "page" : undefined}
                className="relative flex flex-1 flex-col items-center gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[10px] font-semibold transition-colors"
                style={{ color: isActive ? accent : "#6b7280" }}
              >
                <span className="relative">
                  <item.icon className="size-5" />
                  {item.badge != null && item.badge > 0 && (
                    <Badge count={item.badge} max={9} variant="small" className="absolute -right-2.5 -top-1.5" />
                  )}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
