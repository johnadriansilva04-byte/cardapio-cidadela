import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "@/modules/ui/Controls";

const OPTIONS = [
  { key: "active", label: "Em andamento", count: 3 },
  { key: "today", label: "Hoje", count: 10 },
  { key: "all", label: "Todos", count: 40 },
] as const;

type Key = (typeof OPTIONS)[number]["key"];

/** O app usa o controle com estado real; o dublê só observa as chamadas. */
function Harness({
  initial = "active" as Key,
  onSelect,
}: {
  initial?: Key;
  onSelect?: (k: Key) => void;
}) {
  const [value, setValue] = useState<Key>(initial);
  return (
    <SegmentedControl
      ariaLabel="Filtrar pedidos"
      value={value}
      onChange={(next) => {
        onSelect?.(next);
        setValue(next);
      }}
      options={OPTIONS.map((o) => ({ ...o }))}
    />
  );
}

function setup(initial: Key = "active") {
  const onSelect = vi.fn();
  render(<Harness initial={initial} onSelect={onSelect} />);
  return { onSelect };
}

describe("SegmentedControl", () => {
  it("expõe um radiogroup com a opção ativa marcada", () => {
    setup();
    expect(screen.getByRole("radiogroup", { name: "Filtrar pedidos" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Em andamento/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /Hoje/ })).toHaveAttribute("aria-checked", "false");
  });

  it("mostra a contagem de cada segmento", () => {
    setup();
    expect(screen.getByRole("radio", { name: /Hoje/ })).toHaveTextContent("10");
    expect(screen.getByRole("radio", { name: /Todos/ })).toHaveTextContent("40");
  });

  it("deixa só a opção ativa na ordem de tabulação (roving tabindex)", () => {
    setup();
    expect(screen.getByRole("radio", { name: /Em andamento/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: /Hoje/ })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: /Todos/ })).toHaveAttribute("tabindex", "-1");
  });

  it("move com as setas, seleciona e leva o foco junto", async () => {
    const user = userEvent.setup();
    const { onSelect } = setup("active");

    await user.tab();
    expect(screen.getByRole("radio", { name: /Em andamento/ })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenLastCalledWith("today");
    expect(screen.getByRole("radio", { name: /Hoje/ })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenLastCalledWith("all");
    expect(screen.getByRole("radio", { name: /Todos/ })).toHaveFocus();
  });

  it("dá a volta nas setas (última → primeira)", async () => {
    const user = userEvent.setup();
    const { onSelect } = setup("all");

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenLastCalledWith("active");
  });

  it("Home e End pulam para as pontas", async () => {
    const user = userEvent.setup();
    const { onSelect } = setup("today");

    await user.tab();
    await user.keyboard("{Home}");
    expect(onSelect).toHaveBeenLastCalledWith("active");
    await user.keyboard("{End}");
    expect(onSelect).toHaveBeenLastCalledWith("all");
  });

  it("seleciona ao clicar", async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    await user.click(screen.getByRole("radio", { name: /Todos/ }));
    expect(onSelect).toHaveBeenCalledWith("all");
    expect(screen.getByRole("radio", { name: /Todos/ })).toHaveAttribute("aria-checked", "true");
  });
});
