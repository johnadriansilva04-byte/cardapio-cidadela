/**
 * Tema sazonal da landing (o "outdoor" da home).
 *
 * Em novembro e dezembro o hero veste o Natal: é o pico do delivery, quando o
 * dono decide como vai vender nas festas — a melhor época do ano para vender o
 * cardápio digital. Fora da janela, a home volta ao visual padrão.
 *
 * `Date.getMonth()` é 0-based: 10 = novembro, 11 = dezembro. Novembro entra
 * porque o comércio monta a campanha de Natal antes do mês virar.
 */
export function isChristmasSeason(date: Date = new Date()): boolean {
  const month = date.getMonth();
  return month === 10 || month === 11;
}
