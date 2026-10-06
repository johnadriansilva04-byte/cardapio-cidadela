import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressiveList } from "@/modules/ui/ProgressiveList";

function makeItems(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Pedido ${i + 1}`);
}

describe("ProgressiveList", () => {
  it("mostra só os primeiros itens e resume o resto", () => {
    render(
      <ProgressiveList
        items={makeItems(40)}
        singular="pedido"
        plural="pedidos"
        renderItem={(item) => <p key={item}>{item}</p>}
      />,
    );

    expect(screen.getByText("Pedido 1")).toBeInTheDocument();
    expect(screen.getByText("Pedido 2")).toBeInTheDocument();
    // O terceiro não é montado: 40 pedidos não custam 40 cards na 1ª pintura.
    expect(screen.queryByText("Pedido 3")).not.toBeInTheDocument();
    expect(screen.getByTestId("progressive-more")).toHaveTextContent("Ver mais 8 pedidos");
    expect(screen.getByTestId("progressive-more")).toHaveTextContent("+38");
  });

  it("revela o restante em lotes e permite recolher", async () => {
    const user = userEvent.setup();
    render(
      <ProgressiveList
        items={makeItems(40)}
        singular="pedido"
        plural="pedidos"
        renderItem={(item) => <p key={item}>{item}</p>}
      />,
    );

    await user.click(screen.getByTestId("progressive-more"));
    expect(screen.getByText("Pedido 10")).toBeInTheDocument();
    expect(screen.getByTestId("progressive-more")).toHaveTextContent("Ver mais 8 pedidos");
    expect(screen.getByTestId("progressive-more")).toHaveTextContent("+30");

    // "Mostrar menos" volta ao estado inicial.
    await user.click(screen.getByRole("button", { name: /mostrar menos/i }));
    expect(screen.queryByText("Pedido 3")).not.toBeInTheDocument();
  });

  it("não mostra controles quando tudo cabe na tela", () => {
    render(
      <ProgressiveList
        items={makeItems(2)}
        singular="pedido"
        plural="pedidos"
        renderItem={(item) => <p key={item}>{item}</p>}
      />,
    );

    expect(screen.queryByTestId("progressive-more")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mostrar menos/i })).not.toBeInTheDocument();
  });

  it("usa o singular quando falta só um item", () => {
    render(
      <ProgressiveList
        items={makeItems(3)}
        singular="pedido"
        plural="pedidos"
        renderItem={(item) => <p key={item}>{item}</p>}
      />,
    );

    expect(screen.getByTestId("progressive-more")).toHaveTextContent("Ver mais 1 pedido");
  });
});
