/**
 * Limite de requisições por IP, em memória (janela deslizante).
 *
 * É a primeira barreira de aplicação contra abuso (força bruta em link de
 * pagamento, spam de webhook, varredura de rotas de API). NÃO substitui a
 * proteção de borda: em serverless cada instância tem seu próprio mapa e ele
 * morre com a instância, então o limite é "melhor esforço" por instância. A
 * defesa de verdade contra DDoS volumétrico é o Firewall da Vercel (borda);
 * isto aqui cobre o abuso aplicacional que passa pela borda.
 *
 * Sem dependência externa de propósito: um Redis/Upstash daria um contador
 * global, mas adiciona infra e custo. Se o volume justificar, troque o `Map`
 * por um store compartilhado mantendo a mesma assinatura.
 */

interface Bucket {
  /** Timestamps (ms) das requisições recentes dentro da janela. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Teto de chaves para o mapa não crescer sem limite sob ataque. */
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  /** Segundos até poder tentar de novo (para o header Retry-After). */
  retryAfter: number;
  /** Requisições restantes na janela (aprox.). */
  remaining: number;
}

/**
 * Conta uma requisição para `key`. Retorna `ok: false` quando estourou
 * `limit` requisições na janela de `windowMs`.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const cutoff = now - windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  // Descarta o que saiu da janela.
  if (bucket.hits.length && bucket.hits[0] <= cutoff) {
    bucket.hits = bucket.hits.filter((t) => t > cutoff);
  }

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, retryAfter, remaining: 0 };
  }

  bucket.hits.push(now);

  // Poda simples: se o mapa passar do teto, remove as chaves mais antigas.
  if (buckets.size > MAX_KEYS) {
    const drop = Math.ceil(MAX_KEYS * 0.1);
    let i = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++i >= drop) break;
    }
  }

  return { ok: true, retryAfter: 0, remaining: limit - bucket.hits.length };
}

/** Só para testes: zera o estado entre casos. */
export function resetRateLimit(): void {
  buckets.clear();
}

/**
 * Extrai o IP do cliente. Na Vercel o `x-forwarded-for` traz a cadeia
 * (cliente, proxies); o primeiro é o cliente. `x-real-ip` é o fallback.
 * Sem nada, devolve "unknown" — todas as requisições sem IP compartilham o
 * mesmo balde, o que ainda limita um flood anônimo.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Resposta 429 padrão com `Retry-After`. */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": String(retryAfter),
      },
    },
  );
}
