import { describe, expect, it } from "vitest";
import {
  MAX_COMMENT_LENGTH,
  clampRating,
  isValidRating,
  maskReviewerName,
  ratingLabel,
  relativeReviewDate,
  sortReviews,
  summarizeReviews,
  validateReviewInput,
  type Review,
} from "@/lib/reviews";

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "rv1",
    restaurant_id: "r1",
    order_id: null,
    rating: 5,
    comment: "",
    customer_name: "Ana Silva",
    created_at: "2026-09-19T12:00:00.000Z",
    ...overrides,
  };
}

describe("clampRating", () => {
  it("limita à faixa 1..5", () => {
    expect(clampRating(0)).toBe(1);
    expect(clampRating(9)).toBe(5);
    expect(clampRating(3.6)).toBe(4);
    expect(clampRating(NaN)).toBe(1);
  });
});

describe("isValidRating", () => {
  it("aceita só inteiros de 1 a 5", () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
  });
});

describe("validateReviewInput", () => {
  it("recusa nota inválida", () => {
    expect(validateReviewInput({ rating: 0 })).toMatch(/nota de 1 a 5/);
  });

  it("recusa comentário acima do limite", () => {
    expect(validateReviewInput({ rating: 5, comment: "x".repeat(MAX_COMMENT_LENGTH + 1) })).toMatch(
      /no máximo/,
    );
  });

  it("aceita entrada válida com ou sem comentário", () => {
    expect(validateReviewInput({ rating: 4 })).toBeNull();
    expect(validateReviewInput({ rating: 4, comment: "Bom" })).toBeNull();
  });
});

describe("summarizeReviews", () => {
  it("retorna resumo zerado sem avaliações", () => {
    const summary = summarizeReviews([]);
    expect(summary.count).toBe(0);
    expect(summary.average).toBe(0);
    expect(summary.distribution).toHaveLength(5);
    expect(summary.distribution[0]).toMatchObject({ rating: 5, count: 0, percent: 0 });
  });

  it("calcula média com uma casa decimal", () => {
    const summary = summarizeReviews([
      makeReview({ id: "a", rating: 5 }),
      makeReview({ id: "b", rating: 4 }),
      makeReview({ id: "c", rating: 4 }),
    ]);
    expect(summary.count).toBe(3);
    expect(summary.average).toBe(4.3);
  });

  it("monta a distribuição de 5 até 1 com percentuais inteiros", () => {
    const summary = summarizeReviews([
      makeReview({ id: "a", rating: 5 }),
      makeReview({ id: "b", rating: 5 }),
      makeReview({ id: "c", rating: 3 }),
      makeReview({ id: "d", rating: 1 }),
    ]);
    expect(summary.distribution.map((d) => d.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(summary.distribution[0]).toMatchObject({ count: 2, percent: 50 });
    expect(summary.distribution[4]).toMatchObject({ count: 1, percent: 25 });
  });

  it("ignora notas inválidas vindas do banco", () => {
    const summary = summarizeReviews([
      makeReview({ id: "a", rating: 5 }),
      makeReview({ id: "b", rating: 0 }),
      makeReview({ id: "c", rating: 99 }),
    ]);
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(5);
  });
});

describe("ratingLabel", () => {
  it("descreve cada faixa", () => {
    expect(ratingLabel(5)).toBe("Excelente");
    expect(ratingLabel(1)).toBe("Ruim");
  });
});

describe("maskReviewerName", () => {
  it("mantém primeiro nome e inicial do sobrenome", () => {
    expect(maskReviewerName("Ana Paula Silva")).toBe("Ana P.");
  });

  it("mantém nome único", () => {
    expect(maskReviewerName("Ana")).toBe("Ana");
  });

  it("cai para Cliente quando vazio", () => {
    expect(maskReviewerName("   ")).toBe("Cliente");
  });
});

describe("sortReviews", () => {
  const reviews = [
    makeReview({ id: "a", rating: 3, created_at: "2026-09-10T00:00:00.000Z" }),
    makeReview({ id: "b", rating: 5, created_at: "2026-09-18T00:00:00.000Z" }),
    makeReview({ id: "c", rating: 1, created_at: "2026-09-15T00:00:00.000Z" }),
  ];

  it("ordena por mais recente", () => {
    expect(sortReviews(reviews, "recent").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("ordena por nota", () => {
    expect(sortReviews(reviews, "highest").map((r) => r.rating)).toEqual([5, 3, 1]);
    expect(sortReviews(reviews, "lowest").map((r) => r.rating)).toEqual([1, 3, 5]);
  });

  it("não muta o array original", () => {
    const original = [...reviews];
    sortReviews(reviews, "highest");
    expect(reviews).toEqual(original);
  });
});

describe("relativeReviewDate", () => {
  const now = new Date("2026-09-19T12:00:00.000Z").getTime();

  it("classifica hoje/ontem/dias/meses", () => {
    expect(relativeReviewDate("2026-09-19T09:00:00.000Z", now)).toBe("hoje");
    expect(relativeReviewDate("2026-09-18T09:00:00.000Z", now)).toBe("ontem");
    expect(relativeReviewDate("2026-09-15T09:00:00.000Z", now)).toBe("4 dias atrás");
    expect(relativeReviewDate("2026-08-01T09:00:00.000Z", now)).toBe("1 mês atrás");
  });

  it("devolve vazio para data inválida", () => {
    expect(relativeReviewDate("nada", now)).toBe("");
  });
});
