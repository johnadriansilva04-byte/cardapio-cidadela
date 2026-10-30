import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PlanProvider } from "./plan-context";
import { PlanBadge } from "./PlanBadge";
import type { SubscriptionStatus } from "@/lib/types";

const { checkSubscriptionStatus } = vi.hoisted(() => ({
  checkSubscriptionStatus: vi.fn(),
}));

vi.mock("@/modules/supabase/subscription", async () => {
  const actual = await vi.importActual<typeof import("@/modules/supabase/subscription")>(
    "@/modules/supabase/subscription",
  );
  return { ...actual, checkSubscriptionStatus };
});

function status(over: Partial<SubscriptionStatus> = {}): SubscriptionStatus {
  return {
    isPremium: false,
    monthlyOrderCount: 0,
    monthlyLimit: 5,
    remainingOrders: 5,
    premiumExpiresAt: null,
    resetDate: new Date().toISOString(),
    bonusOrders: 0,
    ...over,
  };
}

function renderBadge() {
  return render(
    <PlanProvider storeId="store-1">
      <PlanBadge onClick={() => {}} />
    </PlanProvider>,
  );
}

describe("PlanBadge", () => {
  beforeEach(() => {
    checkSubscriptionStatus.mockReset();
  });

  it("mostra o plano gratuito com a cota restante", async () => {
    checkSubscriptionStatus.mockResolvedValue(status({ remainingOrders: 3 }));
    renderBadge();

    await waitFor(() => expect(screen.getByText("Grátis")).toBeInTheDocument());
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("troca para Premium com os dias até o vencimento", async () => {
    const inTenDays = new Date(Date.now() + 10 * 86_400_000).toISOString();
    checkSubscriptionStatus.mockResolvedValue(
      status({ isPremium: true, premiumExpiresAt: inTenDays, remainingOrders: 0 }),
    );
    renderBadge();

    await waitFor(() => expect(screen.getByText("Premium")).toBeInTheDocument());
    expect(screen.getByText("10d")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveClass("plan-badge-premium");
  });

  it("avisa 'vence hoje' no último dia", async () => {
    checkSubscriptionStatus.mockResolvedValue(
      status({
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    );
    renderBadge();

    await waitFor(() => expect(screen.getByText("vence hoje")).toBeInTheDocument());
  });

  it("não renderiza nada sem loja (sem consulta)", async () => {
    render(
      <PlanProvider storeId={undefined}>
        <PlanBadge />
      </PlanProvider>,
    );

    await waitFor(() => expect(checkSubscriptionStatus).not.toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
