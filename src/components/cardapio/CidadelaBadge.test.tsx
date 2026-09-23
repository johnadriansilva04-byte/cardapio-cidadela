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

  it("usa um fundo grafite com borda neon azul discreta", () => {
    render(<CidadelaBadge accent="#ff0000" />);
    const link = screen.getByRole("link", { name: "Conheça a Cidadela" });
    // a borda não usa o accent (que pode ser vivo), e sim o azul da identidade
    expect(link.style.border).toContain("rgb(34, 211, 238)");
    expect(link.style.background).not.toContain("rgb(255, 0, 0)");
  });

  it("aplica a cor do restaurante nas letras em tema escuro", () => {
    render(<CidadelaBadge accent="#06b6d4" theme="dark" />);
    expect(screen.getByText("CIDADELA").style.color).toBe("rgb(6, 182, 212)");
  });

  it("usa letras escuras em cardápio de fundo claro", () => {
    render(<CidadelaBadge accent="#00ff00" theme="light" />);
    const label = screen.getByText("CIDADELA");
    expect(label.style.color).toBe("rgb(11, 11, 18)");
  });

  it("deduz o tema pela luminância do accent quando ele não é informado", () => {
    const { unmount } = render(<CidadelaBadge accent="#06b6d4" />);
    // accent escuro → letras na cor do tema
    expect(screen.getByText("CIDADELA").style.color).toBe("rgb(6, 182, 212)");
    unmount();
    render(<CidadelaBadge accent="#00ff00" />);
    // accent muito claro → letras escuras para não sumir no fundo claro
    expect(screen.getByText("CIDADELA").style.color).toBe("rgb(11, 11, 18)");
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
