/**
 * MATA FOME — movimento solidário opcional do dono.
 *
 * Não é um produto nem um combo padronizado: é um convite. A loja adere
 * (`restaurants.mata_fome_enabled`) e o cardápio público ganha uma faixa
 * dizendo "tá com pressa? escolha seu MATA FOME". O cliente escolhe QUALQUER
 * item do próprio cardápio — um belisque para ele, ou uma refeição para quem
 * não tem como pagar. O preço e o item continuam sendo os da casa.
 *
 * Módulo puro (sem React/Supabase) para a mesma copy valer no cardápio e no
 * painel, e para poder testar sem rede.
 */

export type MataFomeCopy = {
  /** Título da faixa no cardápio. */
  title: string;
  /** Explicação curta, em uma frase. */
  subtitle: string;
  /** Selo curto para chips/badges. */
  badge: string;
  /** Texto do interruptor no painel. */
  toggleLabel: string;
  /** Explicação do que o interruptor faz. */
  toggleHint: string;
};

export const MATA_FOME: MataFomeCopy = {
  title: "Tá com pressa? Escolha seu MATA FOME",
  subtitle:
    "Um belisque para você ou uma refeição para quem não tem como pagar. Escolha qualquer item do cardápio.",
  badge: "MATA FOME",
  toggleLabel: "Participar do MATA FOME",
  toggleHint:
    'Mostra no cardápio o convite "tá com pressa? escolha seu MATA FOME". O cliente escolhe o item que quiser — de um belisque a uma refeição para quem precisa.',
};

/** A loja participa do movimento? */
export function isMataFomeOn(
  restaurant: {
    mata_fome_enabled?: boolean | null;
  } | null,
): boolean {
  return restaurant?.mata_fome_enabled === true;
}

/** Recado opcional do dono (quando/limite). Devolve "" quando não há. */
export function mataFomeNote(restaurant: { mata_fome_note?: string | null } | null): string {
  return (restaurant?.mata_fome_note ?? "").trim();
}
