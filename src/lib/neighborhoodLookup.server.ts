/**
 * Server-side busca de bairros na Overpass API.
 *
 * Motivo de ser server-side: a Overpass API bloqueia requisições vindas de
 * navegadores em alguns mirrors (HTTP 406 por User-Agent). Rodando no servidor
 * enviamos um User-Agent de API e conseguimos tentar vários mirrors até obter
 * uma resposta válida — o navegador só chama esta server function.
 */

import { createServerFn } from "@tanstack/react-start";
import { UF_NAMES } from "./brazilStates";

/** Remove ruídos comuns ("Bairro X") deixando o nome final limpo. */
function normalizeNeighborhoodName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^Bairro\s+/i, "")
    .trim();
}

const OVERPASS_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

function buildQuery(cityName: string, stateCode: string): string {
  const stateName = UF_NAMES[stateCode.toUpperCase()] ?? stateCode.toUpperCase();
  return `
[out:json][timeout:45];
area["name"="${stateName}"]["admin_level"="4"]->.uf;
area["name"="${cityName}"]["admin_level"="8"](area.uf)->.city;
(
  nwr["place"="suburb"](area.city);
  nwr["place"="neighbourhood"](area.city);
);
out tags;
`;
}

async function queryMirror(baseUrl: string, query: string, signal: AbortSignal): Promise<Response> {
  return fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
      "User-Agent": "curl/8.0 (cardapio-cidadela; +https://cardapio-cidadela.vercel.app)",
    },
    body: new URLSearchParams({ data: query }).toString(),
    signal,
  });
}

/**
 * Busca os nomes dos bairros de um município via Overpass (tentando mirrors).
 * Lança Error caso nenhum mirror responda com dados.
 */
export const fetchNeighborhoods = createServerFn()
  .validator((d: { cityName: string; stateCode: string }) => d)
  .handler(async ({ data }) => {
    const { cityName, stateCode } = data;
    const query = buildQuery(cityName, stateCode);

    let lastError: unknown = null;
    for (const mirror of OVERPASS_MIRRORS) {
      try {
        // Timeout individual por mirror: se um cair, o próximo tem chance justa.
        const res = await queryMirror(mirror, query, AbortSignal.timeout(40_000));
        if (!res.ok) {
          lastError = new Error(`${mirror} -> HTTP ${res.status}`);
          continue;
        }
        const json = (await res.json()) as {
          elements?: Array<{ tags?: { name?: string } }>;
        };
        const names = new Set<string>();
        for (const el of json.elements ?? []) {
          const name = el.tags?.name?.trim();
          if (name) names.add(normalizeNeighborhoodName(name));
        }
        // Um mirror que retorna vazio (área não encontrada) não é confiável
        // para dizer "a cidade não tem bairros" — tenta o próximo.
        if (names.size === 0) {
          lastError = new Error(`${mirror} retornou vazio`);
          continue;
        }
        return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        lastError = err;
      }
    }

    throw lastError ?? new Error("Overpass indisponível");
  });
