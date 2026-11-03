#!/usr/bin/env node
/**
 * Keep-alive do projeto Supabase (plano gratuito).
 *
 * O plano gratuito PAUSA o projeto após 1 semana sem nenhuma atividade. Um
 * projeto pausado sai do ar: a API responde 503 e o app inteiro para até
 * alguém restaurar à mão no painel. Com cliente pagando, isso é inaceitável.
 *
 * Este script faz o mínimo para a janela nunca fechar: se a semana passou SEM
 * nenhuma requisição, ele faz UMA. Com tráfego real, ele não gasta nada.
 *
 * Estratégia:
 *   1. Se houver SUPABASE_ACCESS_TOKEN, lê o status do projeto e, se estiver
 *      pausado, tenta restaurar (`POST /restore`).
 *   2. Consulta o uso dos últimos 7 dias (Management API). Com QUALQUER
 *      requisição registrada, encerra sem pingar — não gasta egress à toa.
 *   3. Sem uso (ou sem token), faz um GET leve numa tabela pública com a anon
 *      key: é uma requisição REST de verdade e reseta o contador de inatividade.
 *
 * Envs:
 *   SUPABASE_URL            (obrigatório) https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY       (obrigatório p/ o ping) chave pública
 *   SUPABASE_ACCESS_TOKEN   (opcional) PAT p/ checar uso e restaurar
 *   SUPABASE_PROJECT_REF    (opcional) ref; se ausente, extrai da URL
 *
 * Nada é gravado em disco. O token, quando presente, vai só no header.
 */

const URL_BASE = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const REF =
  process.env.SUPABASE_PROJECT_REF ||
  (URL_BASE.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? "");

function log(...args) {
  console.log("[keep-alive]", ...args);
}

/** GET/POST na Management API (api.supabase.com). */
async function mgmt(path, init = {}) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

/** Soma todas as requisições registradas na janela de ociosidade. */
async function requestsInIdleWindow() {
  // Janela de 3 dias, não 7: um ping também conta como requisição, então olhar
  // 7 dias faria o próprio keep-alive "esconder" a ociosidade e só pingar de
  // novo ~8 dias depois — colado no limite de pausa. Com 3 dias, o projeto
  // ocioso é pingado a cada ~3-4 dias, com folga dentro da semana.
  const interval = process.env.SUPABASE_IDLE_WINDOW ?? "3day";
  const { status, json } = await mgmt(
    `/v1/projects/${REF}/analytics/endpoints/usage.api-counts?interval=${interval}`,
  );
  if (status >= 400 || !json || !Array.isArray(json.result)) {
    return { ok: false, total: null, detail: json };
  }
  const total = json.result.reduce(
    (acc, row) =>
      acc +
      Number(row.total_auth_requests ?? 0) +
      Number(row.total_realtime_requests ?? 0) +
      Number(row.total_rest_requests ?? 0) +
      Number(row.total_storage_requests ?? 0),
    0,
  );
  return { ok: true, total, detail: json.result };
}

/** Uma requisição REST real e leve — o que reseta a inatividade. */
async function ping() {
  if (!URL_BASE || !ANON_KEY) {
    return { ok: false, reason: "SUPABASE_URL/SUPABASE_ANON_KEY ausentes" };
  }
  const res = await fetch(`${URL_BASE}/rest/v1/restaurants?select=id&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  return { ok: res.status < 400, status: res.status };
}

async function main() {
  if (!URL_BASE) {
    console.error("Faltando SUPABASE_URL.");
    process.exit(1);
  }

  const hasToken = Boolean(ACCESS_TOKEN && REF);

  // 1) Projeto já pausado? Restaura antes de qualquer coisa.
  if (hasToken) {
    const { status, json } = await mgmt(`/v1/projects/${REF}`);
    const state = json?.status ?? "?";
    log(`status do projeto: ${state}`);
    if (status < 400 && state !== "ACTIVE_HEALTHY") {
      log("projeto não está saudável — tentando restaurar...");
      const restore = await mgmt(`/v1/projects/${REF}/restore`, { method: "POST" });
      log(`restore: ${restore.status}`);
      if (restore.status >= 400) {
        console.error("Falha ao restaurar:", restore.json);
        process.exit(1);
      }
    }
  }

  // 2) Teve alguma requisição na janela? Então nada a fazer.
  if (hasToken) {
    const usage = await requestsInIdleWindow();
    if (usage.ok) {
      log(`requisições na janela de ociosidade: ${usage.total}`);
      if (usage.total > 0) {
        log("projeto ativo — nenhum ping necessário.");
        return;
      }
      log("sem requisições na janela — pingando para não pausar.");
    } else {
      log("não deu para ler o uso — pingando por segurança.");
    }
  } else {
    log("sem SUPABASE_ACCESS_TOKEN — pingando direto (keep-alive simples).");
  }

  // 3) O ping.
  const result = await ping();
  if (result.ok) {
    log(`ping ok (HTTP ${result.status}) — projeto mantido ativo.`);
  } else {
    console.error("ping falhou:", result.reason ?? `HTTP ${result.status}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
