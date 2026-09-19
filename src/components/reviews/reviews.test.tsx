import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StarRating } from "./StarRating";
import { RatingInput } from "./RatingInput";
import { ReviewList } from "./ReviewList";
import { ReviewSubmitForm } from "./ReviewSubmitForm";
import type { Review } from "@/lib/reviews";

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "r1",
    restaurant_id: "rest1",
    order_id: null,
    rating: 5,
    comment: "Muito bom!",
    customer_name: "Ana Silva",
    created_at: "2026-09-19T12:00:00.000Z",
    ...overrides,
  };
}

describe("StarRating", () => {
  it("expõe a nota para leitores de tela", () => {
    render(<StarRating value={4} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Nota 4 de 5");
  });

  it("permite rótulo customizado", () => {
    render(<StarRating value={3} label="Média da loja" />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Média da loja");
  });
});

describe("RatingInput", () => {
  it("seleciona uma nota e mostra o rótulo", async () => {
    const onChange = vi.fn();
    render(<RatingInput value={0} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /4 estrelas/ }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("anuncia o rótulo da nota selecionada", () => {
    render(<RatingInput value={5} onChange={() => {}} />);
    expect(screen.getByText("Excelente")).toBeInTheDocument();
  });
});

describe("ReviewList", () => {
  it("mostra a média e a contagem", () => {
    const reviews = [makeReview({ id: "a", rating: 5 }), makeReview({ id: "b", rating: 4 })];
    render(<ReviewList reviews={reviews} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("2 avaliações")).toBeInTheDocument();
  });

  it("mascara o sobrenome de quem avaliou", () => {
    render(<ReviewList reviews={[makeReview()]} />);
    expect(screen.getByText("Ana S.")).toBeInTheDocument();
  });

  it("mostra estado vazio sem avaliações", () => {
    render(<ReviewList reviews={[]} />);
    expect(screen.getByText("Sem avaliações ainda")).toBeInTheDocument();
  });
});

describe("ReviewSubmitForm", () => {
  it("bloqueia o envio sem nota selecionada", () => {
    render(<ReviewSubmitForm onSubmit={() => Promise.resolve({})} customerName="Ana" />);
    expect(screen.getByRole("button", { name: /enviar avaliação/i })).toBeDisabled();
  });

  it("valida e envia a nota escolhida", async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    const onSuccess = vi.fn();
    render(<ReviewSubmitForm onSubmit={onSubmit} onSuccess={onSuccess} customerName="Ana" />);

    await userEvent.click(screen.getByRole("radio", { name: /5 estrelas/ }));
    await userEvent.type(screen.getByPlaceholderText(/conte como foi/i), "Ótimo!");
    await userEvent.click(screen.getByRole("button", { name: /enviar avaliação/i }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 5, comment: "Ótimo!" });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("exibe o erro devolvido pelo envio", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: "Falha ao enviar." });
    render(<ReviewSubmitForm onSubmit={onSubmit} customerName="Ana" />);

    await userEvent.click(screen.getByRole("radio", { name: /3 estrelas/ }));
    await userEvent.click(screen.getByRole("button", { name: /enviar avaliação/i }));

    expect(await screen.findByText("Falha ao enviar.")).toBeInTheDocument();
  });
});
