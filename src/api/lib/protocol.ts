/**
 * Protocolo de atendimento do suporte.
 *
 * Formato: `CID-AAAAMMDD-XXXXXX`, onde o sufixo é aleatório em base32 sem
 * letras ambíguas (0/O, 1/I/L). O protocolo é o que o dono cita depois para
 * "achar" o relato — por isso precisa ser curto, ditável por telefone e único.
 *
 * O sufixo é aleatório, não sequencial: um contador exporia quantos relatos o
 * produto recebe e permitiria adivinhar protocolos de terceiros.
 */

// Sem 0/O/1/I/L: são os que as pessoas trocam ao ditar/ouvir um código.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SUFFIX_LENGTH = 6;

/** Gera um protocolo. `random` é injetável para o teste ser determinístico. */
export function generateProtocol(
  date: Date = new Date(),
  random: () => number = Math.random,
): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}`;

  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return `CID-${stamp}-${suffix}`;
}

/** Formato aceito na busca. Tolerante a minúsculas e a espaços em volta. */
export function isValidProtocol(value: string): boolean {
  return /^CID-\d{8}-[A-Z0-9]{6}$/.test(value.trim().toUpperCase());
}

/** Normaliza o que o usuário digitou para o formato canônico. */
export function normalizeProtocol(value: string): string {
  return value.trim().toUpperCase();
}
