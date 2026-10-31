import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  getRestaurantsByOwner: vi.fn(),
  ensureRestaurantsForUser: vi.fn(),
}));

vi.mock("@/modules/supabase/restaurants", () => ({
  getRestaurantsByOwner: mocks.getRestaurantsByOwner,
  ensureRestaurantsForUser: mocks.ensureRestaurantsForUser,
}));

import { ActiveStoreProvider, useActiveStore } from "./active-store-context";

function makeRestaurant(id: string, name: string) {
  return { id, name, slug: id, logo_url: null, operating_hours: null, status: "published" };
}

function Probe() {
  const { restaurants, active, setActiveId, loading } = useActiveStore();
  if (loading) return <span>carregando</span>;
  return (
    <div>
      <span data-testid="active">{active?.name ?? "nenhuma"}</span>
      <span data-testid="count">{restaurants.length}</span>
      {restaurants.map((r) => (
        <button key={r.id} onClick={() => setActiveId(r.id)}>
          {r.name}
        </button>
      ))}
    </div>
  );
}

function renderProvider(userId: string | undefined = "owner-1") {
  return render(
    <ActiveStoreProvider userId={userId}>
      <Probe />
    </ActiveStoreProvider>,
  );
}

function renderWithoutUser() {
  return render(
    <ActiveStoreProvider userId={undefined}>
      <Probe />
    </ActiveStoreProvider>,
  );
}

describe("ActiveStoreProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.ensureRestaurantsForUser.mockResolvedValue(undefined);
  });

  it("usa a primeira loja quando não há escolha lembrada", async () => {
    mocks.getRestaurantsByOwner.mockResolvedValue([
      makeRestaurant("s1", "Loja Um"),
      makeRestaurant("s2", "Loja Dois"),
    ]);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("Loja Um"));
    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("lembra a loja escolhida e a mantém ao recarregar", async () => {
    mocks.getRestaurantsByOwner.mockResolvedValue([
      makeRestaurant("s1", "Loja Um"),
      makeRestaurant("s2", "Loja Dois"),
    ]);

    const first = renderProvider();
    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("Loja Um"));

    await userEvent.click(screen.getByRole("button", { name: "Loja Dois" }));
    expect(screen.getByTestId("active")).toHaveTextContent("Loja Dois");

    first.unmount();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("Loja Dois"));
  });

  it("ignora uma escolha lembrada que não existe mais", async () => {
    localStorage.setItem("cidadela:active-store", "apagada");
    mocks.getRestaurantsByOwner.mockResolvedValue([makeRestaurant("s1", "Loja Um")]);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("Loja Um"));
  });

  it("não busca nada sem usuário logado", async () => {
    mocks.getRestaurantsByOwner.mockResolvedValue([]);

    renderWithoutUser();

    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("nenhuma"));
    expect(mocks.getRestaurantsByOwner).not.toHaveBeenCalled();
    expect(mocks.ensureRestaurantsForUser).not.toHaveBeenCalled();
  });

  it("reload rebusca a lista", async () => {
    mocks.getRestaurantsByOwner.mockResolvedValue([makeRestaurant("s1", "Loja Um")]);

    function ReloadProbe() {
      const { reload, restaurants } = useActiveStore();
      return (
        <div>
          <span data-testid="count">{restaurants.length}</span>
          <button onClick={reload}>recarregar</button>
        </div>
      );
    }

    render(
      <ActiveStoreProvider userId="owner-1">
        <ReloadProbe />
      </ActiveStoreProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    mocks.getRestaurantsByOwner.mockResolvedValue([
      makeRestaurant("s1", "Loja Um"),
      makeRestaurant("s2", "Loja Dois"),
    ]);

    await userEvent.click(screen.getByRole("button", { name: "recarregar" }));

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
  });
});
