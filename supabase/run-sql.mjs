#!/usr/bin/env node
/**
 * Executa um arquivo .sql avulso no Supabase, via Management API.
 *
 * Pensado para as faxinas pontuais (ex.: `purge_test_stores.sql`), que não são
 * migrações e por isso ficam fora do `apply-all.mjs`.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx \
 *   SUPABASE_PROJECT_REF=xxxxxxxxxxxxxxxxxxxx \
 *   node supabase/run-sql.mjs supabase/purge_test_stores.sql
 *
 * Segurança: o token vai por variável de ambiente, nunca por argumento.
 */
import { readFileSync } from "node:fs";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const FILE = process.argv[2];

if (!TOKEN || !REF || !FILE) {
  console.error("Uso: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node supabase/run-sql.mjs <arquivo.sql>");
  process.exit(1);
}

const sql = readFileSync(FILE, "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (res.status >= 400) {
  console.error(`Falhou (${res.status}):`, text);
  process.exit(1);
}

try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
