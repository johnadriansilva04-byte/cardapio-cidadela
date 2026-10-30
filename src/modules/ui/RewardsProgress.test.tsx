import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RewardsProgress } from "@/modules/ui/RewardsProgress";
import { PremiumUsageMeter } from "@/modules/ui/PremiumUsageMeter";

// Link do TanStack precisa de router; os componentes só usam <Link> no CTA de
// upgrade, que não é renderizado nestes casos.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

describe("RewardsProgress", () => {
  it("mostra a meta, o progresso e o bônus", () => {
    render(
      <RewardsProgress
        rewards={[
          {
            reward_id: "r1",
            title: "Liga 20h no mês",
            metric: "usage_seconds",
            threshold: 72000,
            bonus_orders: 0,
            day_credits: 5,
            progress: 36000,
            granted: false,
          },
        ]}
      />,
    );
    expect(screen.getByText("Liga 20h no mês")).toBeInTheDocument();
    expect(screen.getByText(/10h \/ 20h/)).toBeInTheDocument();
    expect(screen.getByText("+5 diárias")).toBeInTheDocument();
  });

  it("marca a meta conquistada", () => {
    render(
      <RewardsProgress
        rewards={[
          {
            reward_id: "r2",
            title: "Mil pedidos",
            metric: "orders",
            threshold: 1000,
            bonus_orders: 0,
            day_credits: 20,
            progress: 1000,
            granted: true,
          },
        ]}
      />,
    );
    expect(screen.getByText("Conquistado")).toBeInTheDocument();
  });

  it("não renderiza nada sem metas", () => {
    const { container } = render(<RewardsProgress rewards={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PremiumUsageMeter com bônus", () => {
  it("soma o bônus à cota exibida e mostra o selo", () => {
    render(<PremiumUsageMeter used={2} limit={5} bonus={20} />);
    expect(screen.getByText("2/25")).toBeInTheDocument();
    expect(screen.getByText(/\+20 bônus conquistados/)).toBeInTheDocument();
  });

  it("sem bônus não mostra o selo", () => {
    render(<PremiumUsageMeter used={2} limit={5} />);
    expect(screen.getByText("2/5")).toBeInTheDocument();
    expect(screen.queryByText(/bônus conquistado/)).not.toBeInTheDocument();
  });
});
