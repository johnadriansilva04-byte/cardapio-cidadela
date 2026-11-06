import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Restaurant } from "@/lib/types";

// O card toca o banco ao aplicar o tema; aqui só importa a decisão de UI
// (aviso no mês, gate do anual e o upsell), então o update é mockado.
const updateRestaurant = vi.fn(async () => true);
vi.mock("@/modules/supabase/restaurants", () => ({
  updateRestaurant: (...args: unknown[]) => updateRestaurant(...args),
}));

import { SeasonalThemesCard } from "@/components/admin/SeasonalThemesCard";

function makeStore(): Restaurant {
  return {
    id: "store-1",
    owner_id: "owner-1",
    name: "Pizzaria do Zé",
    slug: "pizzaria-do-ze",
    description: "Pizzas artesanais",
    phone: "",
    whatsapp: "",
    address: "",
    logo_url: "",
    banner_url: "",
    primary_color: "#06b6d4",
    secondary_color: "#8b5cf6",
    status: "published",
    pix_key: "",
    delivery_fee: 0,
    operating_hours: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as Restaurant;
}

describe("SeasonalThemesCard", () => {
  beforeEach(() => {
    localStorage.clear();
    updateRestaurant.mockClear();
    // Fixa o relógio no Natal para o tema ativo ser determinístico. Com
    // `shouldAdvanceTime` os timers internos do userEvent continuam correndo,
    // senão a interação trava.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 11, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("oferece o tema do mês combinado com o nicho da loja", async () => {
    render(<SeasonalThemesCard restaurant={makeStore()} canUse />);
    expect(await screen.findByText(/Natal na Pizzaria chegou/i)).toBeInTheDocument();
  });

  it("com o plano anual, aplica as cores do tema na loja", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SeasonalThemesCard restaurant={makeStore()} canUse />);
    await user.click(await screen.findByRole("button", { name: /vestir meu cardápio de natal/i }));
    await waitFor(() => expect(updateRestaurant).toHaveBeenCalledTimes(1));
    expect(updateRestaurant).toHaveBeenCalledWith("store-1", {
      primary_color: "#dc2626",
      secondary_color: "#16a34a",
    });
  });

  it("sem o anual, o botão vira upsell e não grava nada", async () => {
    const onUpgrade = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SeasonalThemesCard restaurant={makeStore()} canUse={false} onUpgrade={onUpgrade} />);
    await user.click(await screen.findByRole("button", { name: /plano anual/i }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(updateRestaurant).not.toHaveBeenCalled();
  });

  it("'Agora não' some com a oferta do tema", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SeasonalThemesCard restaurant={makeStore()} canUse />);
    expect(await screen.findByText(/Natal na Pizzaria chegou/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /agora não/i }));
    await waitFor(() =>
      expect(screen.queryByText(/Natal na Pizzaria chegou/i)).not.toBeInTheDocument(),
    );
  });
});
