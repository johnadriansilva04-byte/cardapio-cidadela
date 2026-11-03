#!/usr/bin/env node
// ============================================================
// Restaurar um backup do R2 → Supabase
// ============================================================
// Lê o arquivo gerado por scripts/backup-to-r2.mjs e reenvia as linhas para o
// banco via API REST (service role). É um UPSERT por `id`: recria o que sumiu e
// atualiza o que mudou, sem apagar o que já existe.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
//   node scripts/restore-from-r2.mjs --list
//
//   ... node scripts/restore-from-r2.mjs --key 2026-11-03/2026-11-03T03-00-00-000Z/backup.json.gz
//
//   RESTORE_TABLES=restaurants,categories,products ... node scripts/restore-from-r2.mjs --latest
//
// Flags:
//   --list              lista os backups disponíveis (mais recentes primeiro)
//   --latest            restaura o backup mais recente (de latest/manifest.json)
//   --key <objeto>      restaura um objeto específico do bucket
//   --confirm           obrigatório para escrever; sem ele só mostra o plano
//
// Segurança: o R2 é privado (sem domínio público), então o dump não fica
// exposto. Ainda assim o arquivo tem dados de clientes — não o publique.

import { gunzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const BUCKET = process.env.BACKUP_R2_BUCKET || "cardapio-cidadela-backups";

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`[restore] falta a variável ${name}`);
    process.exit(1);
  }
  return v.trim();
}

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

// `R2_LOCAL=1` lê do R2 simulado do wrangler (dev/teste, sem credenciais).
const R2_LOCAL = process.env.R2_LOCAL === "1";
const remoteFlag = R2_LOCAL ? "--local" : "--remote";

const wrangler = (wargs, { capture = false } = {}) =>
  execFileSync("npx", ["wrangler", ...wargs], {
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });

async function main() {
  if (has("--list")) {
    // O wrangler não lista objetos do R2; o manifesto mais recente é a fonte
    // de verdade. Os manifests datados ficam em `<data>/manifest.json`.
    const dir = join(process.cwd(), ".restore-tmp");
    mkdirSync(dir, { recursive: true });
    const manifestFile = join(dir, "manifest.json");
    wrangler(
      [
        "r2",
        "object",
        "get",
        `${BUCKET}/latest/manifest.json`,
        `--file=${manifestFile}`,
        remoteFlag,
      ],
      { capture: true },
    );
    console.log(readFileSync(manifestFile, "utf8"));
    rmSync(dir, { recursive: true, force: true });
    return;
  }

  const SUPABASE_URL = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const confirm = has("--confirm");

  const dir = join(process.cwd(), ".restore-tmp");
  mkdirSync(dir, { recursive: true });
  const localFile = join(dir, "backup.json.gz");

  let key = valueOf("--key");
  if (!key && has("--latest")) {
    const manifestFile = join(dir, "manifest.json");
    wrangler(
      [
        "r2",
        "object",
        "get",
        `${BUCKET}/latest/manifest.json`,
        `--file=${manifestFile}`,
        remoteFlag,
      ],
      { capture: true },
    );
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    key = manifest.key;
    console.log(`[restore] backup mais recente: ${manifest.generatedAt} (${key})`);
  }
  if (!key) {
    console.error("[restore] informe --latest, --key <objeto> ou --list");
    process.exit(1);
  }

  wrangler(["r2", "object", "get", `${BUCKET}/${key}`, `--file=${localFile}`, remoteFlag]);
  const payload = JSON.parse(gunzipSync(readFileSync(localFile)).toString("utf8"));

  const only = process.env.RESTORE_TABLES
    ? new Set(process.env.RESTORE_TABLES.split(",").map((t) => t.trim()))
    : null;

  const plan = Object.entries(payload.tables)
    .filter(([t, rows]) => (!only || only.has(t)) && rows.length > 0)
    .map(([t, rows]) => `${t} (${rows.length})`);

  console.log(
    `[restore] backup de ${payload.generatedAt}${payload.incomplete ? " [INCOMPLETO]" : ""}`,
  );
  console.log(`[restore] tabelas a restaurar: ${plan.join(", ") || "(nenhuma)"}`);

  if (!confirm) {
    console.log("[restore] modo simulação — rode de novo com --confirm para escrever");
    return;
  }

  // `id` é a chave de conflito de todas as tabelas do app. O upsert recria o que
  // sumiu sem duplicar o que já está lá.
  for (const [table, rows] of Object.entries(payload.tables)) {
    if (only && !only.has(table)) continue;
    if (rows.length === 0) continue;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.error(`[restore] ${table}: HTTP ${res.status} ${await res.text().catch(() => "")}`);
        process.exit(2);
      }
    }
    console.log(`[restore]   ${table}: ${rows.length} linha(s) restaurada(s)`);
  }

  rmSync(dir, { recursive: true, force: true });
  console.log("[restore] concluído");
}

main().catch((e) => {
  console.error("[restore] erro fatal:", e.message);
  process.exit(1);
});
