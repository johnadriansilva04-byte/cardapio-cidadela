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

  it("a logo fica sobreposta à borda inferior da capa, sem ser cortada", () => {
    renderCard();
    const logo = screen.getAllByAltText("Dona da Pensão")[1];
    const avatar = logo.parentElement as HTMLElement;
    // sobe sobre a borda inferior da capa
    expect(avatar.className).toContain("-top-8");
    // e fica acima dos elementos da capa no empilhamento
    expect(avatar.className).toContain("z-20");
    // centralizado no card, junto com o nome
    expect(avatar.className).toContain("left-1/2");
    expect(avatar.className).toContain("-translate-x-1/2");
    // vive fora da capa (que tem overflow-hidden), então nunca é cortado
    const cover = screen.getAllByAltText("Dona da Pensão")[0].parentElement as HTMLElement;
    expect(cover.contains(avatar)).toBe(false);
  });

  it("centraliza nome, descrição e contagem junto do avatar", () => {
    renderCard();
    const logo = screen.getAllByAltText("Dona da Pensão")[1];
    const content = (logo.parentElement as HTMLElement).parentElement
      ?.nextElementSibling as HTMLElement;
    expect(content.className).toContain("items-center");
    const heading = screen.getByRole("heading", { name: "Dona da Pensão" });
    // o nome é filho direto do bloco centralizado, sem seta lateral
    expect(heading.parentElement).toBe(content);
    expect(screen.getByText("Os melhores lanches, entrega rápida.").className).toContain(
      "text-center",
    );
  });

  it("mantém a altura original da capa e o recuo do conteúdo", () => {
    renderCard();
    const cover = screen.getAllByAltText("Dona da Pensão")[0].parentElement as HTMLElement;
    expect(cover.className).toContain("h-36");
    const avatar = screen.getAllByAltText("Dona da Pensão")[1].parentElement as HTMLElement;
    const content = avatar.parentElement?.nextElementSibling as HTMLElement;
    // a logo tem 64px (size-16) e sobe 32px; o conteúdo precisa de padding >= 32px
    expect(content.className).toContain("pt-9");
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
