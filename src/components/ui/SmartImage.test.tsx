import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SmartImage } from "./SmartImage";

const STORAGE_URL = "https://abcd.supabase.co/storage/v1/object/public/restaurant-images/r1/a.png";
const EXTERNAL_URL = "https://exemplo.com/foto.jpg";

describe("SmartImage", () => {
  it("usa a URL transformada para imagens do Supabase", () => {
    render(<SmartImage src={STORAGE_URL} alt="Foto" width={100} />);
    const img = screen.getByAltText("Foto");
    expect(img.getAttribute("src")).toContain("/render/image/public/");
    expect(img.getAttribute("src")).toContain("width=100");
  });

  it("mantém URL externa intacta", () => {
    render(<SmartImage src={EXTERNAL_URL} alt="Externa" width={100} />);
    expect(screen.getByAltText("Externa")).toHaveAttribute("src", EXTERNAL_URL);
  });

  it("cai para a URL original quando a transformação falha", async () => {
    render(<SmartImage src={STORAGE_URL} alt="Foto" width={100} />);
    const img = screen.getByAltText("Foto");
    expect(img.getAttribute("src")).toContain("/render/image/public/");

    // Supabase respondendo 400 na rota de render (recurso desabilitado).
    fireEvent.error(img);

    const retried = await screen.findByAltText("Foto");
    expect(retried).toHaveAttribute("src", STORAGE_URL);
  });

  it("mostra o fallback quando até a URL original falha", async () => {
    render(<SmartImage src={STORAGE_URL} alt="Foto" width={100} fallback={<span>vazio</span>} />);
    const img = screen.getByAltText("Foto");
    fireEvent.error(img);
    const retried = await screen.findByAltText("Foto");
    fireEvent.error(retried);

    expect(await screen.findByText("vazio")).toBeInTheDocument();
  });

  it("respeita carregamento imediato quando pedido", () => {
    render(<SmartImage src={STORAGE_URL} alt="Foto" width={100} eager />);
    expect(screen.getByAltText("Foto")).toHaveAttribute("loading", "eager");
  });
});
