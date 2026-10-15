#!/usr/bin/env node
/**
 * Aplica TODAS as migrações do projeto no Supabase, na ordem correta, via
 * Management API (não precisa de Docker nem conexão direta ao Postgres).
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx \
 *   SUPABASE_PROJECT_REF=xxxxxxxxxxxxxxxxxxxx \
 *   node supabase/apply-all.mjs            # aplica
 *
 *   DRY_RUN=1 node supabase/apply-all.mjs  # só valida token/ref e lista arquivos
 *
 * Segurança: o token vai por variável de ambiente, nunca por argumento (não
 * aparece em `ps`). Nada é gravado em disco.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const DRY = process.env.DRY_RUN === "1";

if (!TOKEN || !REF) {
  console.error("Faltando SUPABASE_ACCESS_TOKEN e/ou SUPABASE_PROJECT_REF.");
  process.exit(1);
}

// Ordem importa: schema base primeiro, migrações incrementais depois.
const FILES = [
  "schema.sql",
  "supabase_customer_loyalty_migration.sql",
  "supabase_reviews_migration.sql",
  "supabase_rewards_migration.sql",
  "supabase_retention.sql",
];

async function api(path, init = {}) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
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

async function runSql(query) {
  return api(`/v1/projects/${REF}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

async function main() {
  console.log(`Projeto: ${REF}${DRY ? " (DRY RUN)" : ""}`);

  const probe = await runSql("select current_database() as db, current_user as usr");
  if (probe.status >= 400) {
    console.error("Token/ref inválidos:", probe.status, probe.json);
    process.exit(1);
  }
  console.log("Conexão OK:", probe.json);

  if (DRY) {
    console.log("Arquivos que seriam aplicados, nesta ordem:");
    for (const f of FILES) {
      const sql = readFileSync(join(__dirname, f), "utf8");
      console.log(`  - ${f} (${sql.length} bytes)`);
    }
    return;
  }

  for (const f of FILES) {
    const sql = readFileSync(join(__dirname, f), "utf8");
    process.stdout.write(`→ ${f} ... `);
    const { status, json } = await runSql(sql);
    if (status >= 400) {
      console.log("FALHOU");
      console.error("   ", status, typeof json === "string" ? json.slice(0, 500) : json);
      process.exit(1);
    }
    console.log("ok");
  }

  console.log("\n✅ Todas as migrações aplicadas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
