/**
 * Busca automática de bairros por cidade (Brasil).
 *
 * Fluxo:
 *  1. Nominatim (OpenStreetMap) geocodifica a cidade + UF -> obtém nome oficial
 *     e sigla do estado.
 *  2. Overpass API (OpenStreetMap) consulta as features "suburb"/"neighbourhood"
 *     dentro da área do município e devolve os nomes dos bairros.
 *
 * O Nominatim é chamado direto do navegador (aceita CORS). A Overpass bloqueia
 * User-Agent de navegador em alguns mirrors, então a consulta é sempre feita via
 * server function (src/lib/neighborhoodLookup.server.ts), que usa User-Agent de
 * API e tenta vários mirrors.
 *
 * São APIs públicas, gratuitas e sem chave.
 * Fonte dos dados: © contribuidores do OpenStreetMap, ODbL 1.0 (osm.org/copyright)
 */

import { fetchNeighborhoods } from "./neighborhoodLookup.server";
import { STATE_TO_UF } from "./brazilStates";

export interface CityLookupResult {
  /** Nome oficial do município encontrado (ex.: "Florianópolis"). */
  cityName: string;
  /** UF encontrada (ex.: "SC"). */
  stateCode: string;
  /** Latitude do centre do município. */
  lat: number;
  /** Longitude do centre do município. */
  lon: number;
}

/**
 * Geocodifica uma cidade brasileira no Nominatim.
 * Retorna null se não encontrar um município válido.
 */
export async function geocodeCity(
  cityInput: string,
  stateInput: string,
  signal?: AbortSignal,
): Promise<CityLookupResult | null> {
  const city = cityInput.trim();
  const state = stateInput.trim();
  if (!city) return null;

  const q = [city, state, "Brazil"].filter(Boolean).join(", ");
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1" +
    `&countrycodes=br&q=${encodeURIComponent(q)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "cardapio-cidadela (menu digital)" },
    signal,
  });
  if (!res.ok) return null;

  const results = (await res.json()) as Array<{
    lat: string;
    lon: string;
    osm_type: string;
    osm_id: number;
    type?: string;
    class?: string;
    name?: string;
    address?: {
      city?: string;
      state?: string;
      municipality?: string;
      town?: string;
      region?: string;
    };
  }>;

  // Pega o primeiro resultado que represente um município (boundary administrativa).
  const match = results.find(
    (r) =>
      r.class === "boundary" &&
      (r.type === "administrative" || r.type === "city" || r.type === "municipality") &&
      r.osm_type === "relation" &&
      r.osm_id > 0,
  );
  if (!match) return null;

  // Nominatim devolve o nome completo do estado ("Santa Catarina").
  // Converte para a sigla usando o mapa; se não achar, mantém a UF digitada.
  const fullState = (match.address?.state ?? state).replace(/^Estado de /i, "");
  const stateCode = STATE_TO_UF[fullState] ?? state.trim().toUpperCase();

  return {
    cityName: match.name ?? city,
    stateCode: stateCode || state.toUpperCase() || "BR",
    lat: parseFloat(match.lat),
    lon: parseFloat(match.lon),
  };
}

/** Remove ruídos comuns ("Bairro X") deixando o nome final limpo. */
export function normalizeNeighborhoodName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^Bairro\s+/i, "")
    .trim();
}

/**
 * Busca completa: geocodifica a cidade e retorna os bairros prontos para salvar.
 */
export async function searchNeighborhoodsByCity(
  cityInput: string,
  stateInput: string,
  signal?: AbortSignal,
): Promise<{ city: CityLookupResult | null; neighborhoods: string[] }> {
  const city = await geocodeCity(cityInput, stateInput, signal);
  if (!city) return { city: null, neighborhoods: [] };

  const neighborhoods = await fetchNeighborhoods({
    data: { cityName: city.cityName, stateCode: city.stateCode },
  });
  return { city, neighborhoods };
}

export { UF_NAMES } from "./brazilStates";
