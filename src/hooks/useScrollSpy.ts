import { useEffect } from "react";

interface UseScrollSpyOptions {
  /** Ids das seções, na ordem em que aparecem na página. */
  ids: string[];
  /** Elemento rolável onde as seções vivem (padrão: viewport). */
  root?: Element | null;
  /** Margem para compensar a barra de categorias sticky do topo. */
  rootMargin?: string;
  /** Chamado quando a seção "ativa" muda por rolagem. */
  onChange: (id: string) => void;
  enabled?: boolean;
}

/**
 * Marca a seção visível enquanto o usuário rola o cardápio.
 *
 * Sem isto, a categoria em destaque só mudava ao clicar no menu superior —
 * rolar até uma seção deixava outra categoria acesa. O `rootMargin` negativo
 * no topo compensa a barra sticky, para a seção só ser considerada ativa
 * quando realmente passa por baixo dela; o valor curto na base evita que duas
 * seções fiquem "visíveis" ao mesmo tempo.
 */
export function useScrollSpy({
  ids,
  root = null,
  rootMargin = "-96px 0px -60% 0px",
  onChange,
  enabled = true,
}: UseScrollSpyOptions) {
  const key = ids.join("|");

  useEffect(() => {
    if (!enabled || ids.length === 0) return;
    if (typeof IntersectionObserver === "undefined") return;

    const sections = ids
      .map((id) => document.getElementById(`cat-${id}`))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    // Guarda a fração visível de cada seção: o observer só avisa quando um
    // elemento cruza o limiar, então uma seção pode ficar "presa" como ativa
    // mesmo após outra dominar a tela. Recalculamos pelo maior `ratio`.
    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [sectionId, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = sectionId;
          }
        }

        if (bestId) onChange(bestId.replace(/^cat-/, ""));
      },
      { root, rootMargin, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` resume a lista de ids
  }, [key, root, rootMargin, enabled, onChange]);
}
