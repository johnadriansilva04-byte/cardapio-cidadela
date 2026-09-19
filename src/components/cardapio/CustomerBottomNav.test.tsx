import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CustomerBottomNav from "./CustomerBottomNav";

function renderNav(overrides: Partial<React.ComponentProps<typeof CustomerBottomNav>> = {}) {
  const onNavigate = vi.fn();
  render(
    <CustomerBottomNav
      active="inicio"
      accent="#06b6d4"
      isAuthenticated={false}
      onNavigate={onNavigate}
      {...overrides}
    />,
  );
  return { onNavigate };
}

describe("CustomerBottomNav", () => {
  it("oferece Cardápio, Meus pedidos e Perfil", () => {
    renderNav();
    expect(screen.getByRole("button", { name: /cardápio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /meus pedidos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /perfil|entrar/i })).toBeInTheDocument();
  });

  it("chama 'Entrar' para quem não tem conta e 'Perfil' para quem tem", () => {
    const { unmount } = render(
      <CustomerBottomNav
        active="inicio"
        accent="#06b6d4"
        isAuthenticated={false}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
    unmount();

    renderNav({ isAuthenticated: true });
    expect(screen.getByRole("button", { name: /perfil/i })).toBeInTheDocument();
  });

  it("avisa qual aba está ativa para leitores de tela", () => {
    renderNav({ active: "pedidos" });
    expect(screen.getByRole("button", { name: /meus pedidos/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /cardápio/i })).not.toHaveAttribute("aria-current");
  });

  it("devolve a aba escolhida ao navegar", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderNav();
    await user.click(screen.getByRole("button", { name: /meus pedidos/i }));
    expect(onNavigate).toHaveBeenCalledWith("pedidos");
    await user.click(screen.getByRole("button", { name: /entrar/i }));
    expect(onNavigate).toHaveBeenCalledWith("perfil");
  });

  it("mostra badge de pedidos em andamento e limita a 9+", () => {
    const { unmount } = render(
      <CustomerBottomNav
        active="inicio"
        accent="#06b6d4"
        pendingCount={3}
        isAuthenticated
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    unmount();

    renderNav({ pendingCount: 42, isAuthenticated: true });
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("não mostra badge quando não há pedidos pendentes", () => {
    renderNav({ pendingCount: 0 });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("não deixa o conteúdo ficar sob o notch do celular", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: /navegação do cardápio/i });
    const classes = nav.innerHTML;
    expect(classes).toContain("safe-area-inset-bottom");
  });
});
