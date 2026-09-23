import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RestaurantCardCompact } from "./RestaurantCardCompact";
import type { Restaurant } from "@/lib/types";

function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: "r1",
    name: "Dona da Pensão",
    slug: "dona-da-pensao",
    description: "Os melhores lanches, entrega rápida.",
    logo_url: "https://exemplo.com/logo.png",
    banner_url: "https://exemplo.com/banner.png",
    status: "published",
    phone: null,
    whatsapp: null,
    address: null,
    primary_color: "#06b6d4",
    ...overrides,
  } as Restaurant;
}

function renderCard(restaurant: Partial<Restaurant> = {}, menuItemCount: number | null = 13) {
  return render(
    <RestaurantCardCompact
      restaurant={makeRestaurant(restaurant)}
      menuItemCount={menuItemCount}
      onEdit={vi.fn()}
      onTogglePublish={vi.fn()}
      onDelete={vi.fn()}
      onManageOrders={vi.fn()}
      onSettings={vi.fn()}
    />,
  );
}

describe("RestaurantCardCompact", () => {
  it("mostra nome, descrição e contagem de itens", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Dona da Pensão" })).toBeInTheDocument();
    expect(screen.getByText("Os melhores lanches, entrega rápida.")).toBeInTheDocument();
    expect(screen.getByText("13 items no cardápio")).toBeInTheDocument();
  });

  it("usa singular quando há um único item", () => {
    renderCard({}, 1);
    expect(screen.getByText("1 item no cardápio")).toBeInTheDocument();
  });

  it("a logo fica sobreposta à borda inferior da capa", () => {
    renderCard();
    const logo = screen.getAllByAltText("Dona da Pensão")[1];
    const avatar = logo.parentElement as HTMLElement;
    // sobe sobre a borda inferior da capa
    expect(avatar.className).toContain("-bottom-7");
    // e fica acima dos elementos da capa no empilhamento
    expect(avatar.className).toContain("z-20");
  });

  it("mantém a altura original da capa e o recuo do conteúdo", () => {
    renderCard();
    const cover = screen.getAllByAltText("Dona da Pensão")[0].parentElement as HTMLElement;
    expect(cover.className).toContain("h-36");
    const avatar = screen.getAllByAltText("Dona da Pensão")[1].parentElement as HTMLElement;
    const content = avatar.parentElement?.nextElementSibling as HTMLElement;
    // a logo tem 56px (size-14) e sobe 28px; o conteúdo precisa de padding >= 28px
    expect(content.className).toContain("pt-8");
  });

  it("usa as iniciais quando não há logo", () => {
    renderCard({ logo_url: "" });
    expect(screen.getByText("DD")).toBeInTheDocument();
  });

  it("esconde a contagem quando não foi informada", () => {
    renderCard({}, null);
    expect(screen.queryByText(/no cardápio/)).not.toBeInTheDocument();
  });
});
