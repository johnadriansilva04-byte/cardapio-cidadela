#!/usr/bin/env node
/**
 * Keep-alive do Supabase (plano gratuito).
 *
 * O Free pausa o projeto após 1 semana sem nenhuma requisição, e um projeto
 * pausado derruba o app (a API responde 503). Este script faz UMA requisição
 * leve — o suficiente para a janela nunca fechar. Roda a cada 5 dias.
 *
 * Envs:
 *   SUPABASE_URL        https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY   chave pública (a mesma do bundle)
 */

const URL_BASE = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

async function main() {
  if (!URL_BASE || !ANON_KEY) {
    console.error("[keep-alive] faltando SUPABASE_URL/SUPABASE_ANON_KEY.");
    process.exit(1);
  }

  const res = await fetch(`${URL_BASE}/rest/v1/restaurants?select=id&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });

  if (res.status < 400) {
    console.log(`[keep-alive] ping ok (HTTP ${res.status}) — projeto ativo.`);
    return;
  }
  console.error(`[keep-alive] ping falhou (HTTP ${res.status}).`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
