// Lógica pura de avaliações. Fica separada do acesso ao banco para poder ser
// testada e reaproveitada tanto no cardápio público quanto no painel.

export interface Review {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  rating: number;
  comment: string;
  customer_name: string;
  created_at: string;
}

export interface ReviewDistributionEntry {
  rating: number;
  count: number;
  percent: number;
}

export interface ReviewSummary {
  count: number;
  /** Média com uma casa decimal. Zero quando não há avaliações. */
  average: number;
  distribution: ReviewDistributionEntry[];
}

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_COMMENT_LENGTH = 500;

/** Mantém a nota dentro da faixa suportada, arredondando para inteiro. */
export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return MIN_RATING;
  return Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(value)));
}

export function isValidRating(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING;
}

export interface ReviewInput {
  rating: number;
  comment?: string;
}

/** Valida antes de enviar — devolve a mensagem de erro ou null se estiver ok. */
export function validateReviewInput(input: ReviewInput): string | null {
  if (!isValidRating(input.rating)) {
    return "Escolha uma nota de 1 a 5 estrelas.";
  }
  if ((input.comment ?? "").length > MAX_COMMENT_LENGTH) {
    return `O comentário pode ter no máximo ${MAX_COMMENT_LENGTH} caracteres.`;
  }
  return null;
}

/** Resume as avaliações para o cabeçalho do cardápio. */
export function summarizeReviews(reviews: Review[]): ReviewSummary {
  const valid = reviews.filter((r) => isValidRating(r.rating));
  if (valid.length === 0) {
    return {
      count: 0,
      average: 0,
      distribution: buildDistribution([]),
    };
  }
  const total = valid.reduce((sum, r) => sum + r.rating, 0);
  return {
    count: valid.length,
    average: Math.round((total / valid.length) * 10) / 10,
    distribution: buildDistribution(valid),
  };
}

function buildDistribution(reviews: Review[]): ReviewDistributionEntry[] {
  const counts = new Map<number, number>();
  for (const review of reviews) counts.set(review.rating, (counts.get(review.rating) ?? 0) + 1);

  const entries: ReviewDistributionEntry[] = [];
  for (let rating = MAX_RATING; rating >= MIN_RATING; rating--) {
    const count = counts.get(rating) ?? 0;
    entries.push({
      rating,
      count,
      percent: reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0,
    });
  }
  return entries;
}

const RATING_LABELS: Record<number, string> = {
  1: "Ruim",
  2: "Fraco",
  3: "Regular",
  4: "Bom",
  5: "Excelente",
};

export function ratingLabel(rating: number): string {
  return RATING_LABELS[clampRating(rating)];
}

/**
 * Mostra só o primeiro nome e a inicial do sobrenome. A avaliação é pública no
 * cardápio, então o nome completo do cliente não precisa ficar exposto.
 */
export function maskReviewerName(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Cliente";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

export type ReviewSortOrder = "recent" | "highest" | "lowest";

/** Ordena sem mutar o array recebido (vem direto de estado/props). */
export function sortReviews(reviews: Review[], order: ReviewSortOrder = "recent"): Review[] {
  const copy = [...reviews];
  if (order === "highest") return copy.sort((a, b) => b.rating - a.rating);
  if (order === "lowest") return copy.sort((a, b) => a.rating - b.rating);
  return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** Data relativa curta ("hoje", "3 dias") usada abaixo do nome de quem avaliou. */
export function relativeReviewDate(createdAt: string, now: number = Date.now()): string {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "";
  const days = Math.floor((now - created) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `${days} dias atrás`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 mês atrás" : `${months} meses atrás`;
}
