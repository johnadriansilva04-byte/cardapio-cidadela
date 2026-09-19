import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CidadelaBadge } from "./CidadelaBadge";

describe("CidadelaBadge", () => {
  it("leva para a pracinha em nova aba", () => {
    render(<CidadelaBadge accent="#06b6d4" />);
    const link = screen.getByRole("link", { name: "Conheça a Cidadela" });
    expect(link).toHaveAttribute("href", "https://pracinha.online");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("usa a cor do restaurante na borda e no brilho", () => {
    render(<CidadelaBadge accent="#ff0000" />);
    const link = screen.getByRole("link", { name: "Conheça a Cidadela" });
    expect(link.style.border).toContain("rgb(255, 0, 0)");
  });

  it("aplica a cor do restaurante nos textos em neon", () => {
    render(<CidadelaBadge accent="#00ff00" />);
    expect(screen.getByText("CONHEÇA").style.color).toBe("rgb(0, 255, 0)");
    expect(screen.getByText("A CIDADELA").style.color).toBe("rgb(0, 255, 0)");
  });

  it("aceita posicionamento por classe", () => {
    render(<CidadelaBadge accent="#06b6d4" className="absolute right-3 top-3" />);
    const link = screen.getByRole("link", { name: "Conheça a Cidadela" });
    expect(link.className).toContain("absolute");
    expect(link.className).toContain("right-3");
  });

  it("permite trocar o destino", () => {
    render(<CidadelaBadge accent="#06b6d4" href="https://exemplo.com" />);
    expect(screen.getByRole("link", { name: "Conheça a Cidadela" })).toHaveAttribute(
      "href",
      "https://exemplo.com",
    );
  });
});
