import { Home, ReceiptText, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/shared";
import { hexToRgba } from "@/lib/utils";

export type CustomerTab = "inicio" | "pedidos" | "perfil";

interface CustomerBottomNavProps {
  active: CustomerTab;
  accent: string;
  /** Pedidos em andamento — vira badge em "Meus pedidos". */
  pendingCount?: number;
  isAuthenticated: boolean;
  onNavigate: (tab: CustomerTab) => void;
  /** Loja Premium: mostra o botão flutuante do Pracinha no centro. */
  chatEnabled?: boolean;
  onOpenChat?: () => void;
}

/**
 * Barra fixa do cardápio público.
 *
 * Segue o mesmo desenho da barra do painel mobile (ícone sobre rótulo, alto
 * contraste) para o cliente reconhecer o padrão. O carrinho não entra aqui:
 * ele tem barra própria, com subtotal e CTA, que aparece só quando há itens.
 *
 * O "Pedir por chat" (Pracinha) fica no CENTRO, elevado e vivo — é o jeito mais
 * fácil de montar o pedido, então precisa ser o botão mais visível da tela, não
 * uma pílula perdida entre as categorias.
 */
export default function CustomerBottomNav({
  active,
  accent,
  pendingCount = 0,
  isAuthenticated,
  onNavigate,
  chatEnabled = false,
  onOpenChat,
}: CustomerBottomNavProps) {
  const items = [
    { id: "inicio" as const, label: "Cardápio", icon: Home },
    { id: "pedidos" as const, label: "Meus pedidos", icon: ReceiptText, badge: pendingCount },
    { id: "perfil" as const, label: isAuthenticated ? "Perfil" : "Entrar", icon: User },
  ];

  const showChat = chatEnabled && Boolean(onOpenChat);
  // Com o chat no centro, o botão divide a barra: dois itens à esquerda e um à
  // direita, deixando o vão exato para o flutuante.
  const left = showChat ? items.slice(0, 2) : items;
  const right = showChat ? items.slice(2) : [];

  const renderItem = (item: (typeof items)[number]) => {
    const isActive = active === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        aria-current={isActive ? "page" : undefined}
        className="relative flex flex-1 flex-col items-center gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[10px] font-semibold transition-colors"
        style={{ color: isActive ? accent : "#6b7280" }}
      >
        {isActive && (
          <span
            key={`pill-${item.id}`}
            className="animate-pop-in absolute inset-x-3 top-1.5 h-9 rounded-2xl"
            style={{ backgroundColor: `${accent}1f` }}
          />
        )}
        <span
          className="relative transition-transform duration-200"
          style={{ transform: isActive ? "translateY(-1px) scale(1.08)" : undefined }}
        >
          <item.icon className="size-5" />
          {item.badge != null && item.badge > 0 && (
            <Badge
              count={item.badge}
              max={9}
              variant="small"
              className="absolute -right-2.5 -top-1.5"
            />
          )}
        </span>
        {item.label}
      </button>
    );
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      <nav
        aria-label="Navegação do cardápio"
        className="border-t border-white/[0.08] bg-[#0c0c14]/95 backdrop-blur-xl"
      >
        <div className="relative mx-auto flex max-w-lg items-stretch">
          {left.map(renderItem)}

          {showChat && (
            <div className="relative flex w-[84px] shrink-0 items-stretch justify-center">
              <button
                type="button"
                onClick={onOpenChat}
                aria-label="Pedir por chat com o Pracinha"
                className="relative flex flex-1 flex-col items-center gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 transition-transform active:scale-95"
              >
                <span className="relative">
                  <span
                    aria-hidden
                    className="absolute -inset-1 rounded-2xl animate-pulse"
                    style={{ backgroundColor: hexToRgba(accent, 0.28) }}
                  />
                  <span
                    className="relative grid size-7 place-items-center rounded-xl text-black"
                    style={{
                      backgroundImage: `linear-gradient(140deg, ${accent} 0%, ${hexToRgba(accent, 0.7)} 100%)`,
                      boxShadow: `0 6px 18px ${hexToRgba(accent, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.4)`,
                    }}
                  >
                    <Sparkles className="size-4" />
                  </span>
                  <span
                    className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full border border-[#0c0c14] bg-white text-[7px] font-black leading-none"
                    style={{ color: accent }}
                  >
                    IA
                  </span>
                </span>
                <span className="text-[10px] font-black" style={{ color: accent }}>
                  Pedir
                </span>
              </button>
            </div>
          )}

          {right.map(renderItem)}
        </div>
      </nav>
    </div>
  );
}
