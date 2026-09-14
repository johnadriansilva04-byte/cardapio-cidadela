/**
 * Server-side busca de bairros na Overpass API.
 *
 * O 406 vinha de mirrors que bloqueiam POST sem Referer/User-Agent de navegador.
 * Agora usa `area(3600000000+osmId)` (id vindo do Nominatim) — mais preciso que
 * buscar por nome — e tenta GET antes de POST em 3 mirrors.
 */

import { createServerFn } from "@tanstack/react-start";

function normalizeNeighborhoodName(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/^Bairro\s+/i, "").trim();
}

const OVERPASS_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
] as const;

function buildQuery(areaId: number): string {
  return `
[out:json][timeout:30];
area(${areaId})->.city;
(
  nwr["place"="suburb"](area.city);
  nwr["place"="neighbourhood"](area.city);
  nwr["place"="quarter"](area.city);
  nwr["boundary"="administrative"]["admin_level"~"9|10"](area.city);
);
out tags;
`.trim();
}

async function fetchViaGet(baseUrl: string, query: string, signal: AbortSignal): Promise<Response> {
  const url = `${baseUrl}?data=${encodeURIComponent(query)}`;
  return fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "cardapio-cidadela/1.0 (+https://cardapio-cidadela.vercel.app)",
    },
    signal,
  });
}

async function fetchViaPost(baseUrl: string, query: string, signal: AbortSignal): Promise<Response> {
  return fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json",
      "User-Agent": "cardapio-cidadela/1.0 (+https://cardapio-cidadela.vercel.app)",
    },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
}

export const fetchNeighborhoods = createServerFn()
  .validator((d: { cityName: string; stateCode: string; osmId?: number }) => d)
  .handler(async ({ data }) => {
    const { cityName, stateCode, osmId } = data as {
      cityName: string;
      stateCode: string;
      osmId?: number;
    };

    // Se temos o osmId do Nominatim, usamos areaId direto (3600000000+osmId) — muito mais confiável.
    // Fallback legado: tenta por nome (mantido só se osmId vier undefined por cache antigo).
    let query: string;
    if (typeof osmId === "number" && osmId > 0) {
      const areaId = 3_600_000_000 + osmId;
      query = buildQuery(areaId);
    } else {
      // Fallback por nome — importa UF_NAMES só aqui para não quebrar se osmId existir
      const { UF_NAMES } = await import("./brazilStates");
      const stateName = UF_NAMES[stateCode.toUpperCase()] ?? stateCode.toUpperCase();
      query = `
[out:json][timeout:30];
area["name"="${stateName}"]["admin_level"="4"]->.uf;
area["name"="${cityName}"]["admin_level"="8"](area.uf)->.city;
(
  nwr["place"="suburb"](area.city);
  nwr["place"="neighbourhood"](area.city);
  nwr["place"="quarter"](area.city);
);
out tags;`.trim();
    }

    let lastError: unknown = null;

    for (const mirror of OVERPASS_MIRRORS) {
      // Primeiro tenta GET (menos bloqueado por alguns mirrors), depois POST
      for (const mode of ["GET", "POST"] as const) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 28_000);
          const res =
            mode === "GET"
              ? await fetchViaGet(mirror, query, ctrl.signal)
              : await fetchViaPost(mirror, query, ctrl.signal);
          clearTimeout(t);

          if (!res.ok) {
            // 406/429 são do mirror — tenta próximo modo/mirror em vez de falhar direto
            lastError = new Error(`${mirror} [${mode}] -> HTTP ${res.status}`);
            continue;
          }

          const text = await res.text();
          let json: { elements?: Array<{ tags?: { name?: string } }> };
          try {
            json = JSON.parse(text) as typeof json;
          } catch {
            lastError = new Error(`${mirror} JSON inválido`);
            continue;
          }

          const names = new Set<string>();
          for (const el of json.elements ?? []) {
            const name = el.tags?.name?.trim();
            if (name) names.add(normalizeNeighborhoodName(name));
          }
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
    }

    throw lastError ?? new Error("Overpass indisponível — tente novamente em instantes.");
  });
