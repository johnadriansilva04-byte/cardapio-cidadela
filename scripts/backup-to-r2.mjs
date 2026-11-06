#!/usr/bin/env node
// ============================================================
// Backup do Supabase (dados) → Cloudflare R2
// ============================================================
// O plano gratuito do Supabase NÃO tem backup automático: se o banco quebrar
// (ou um DELETE/job apagar o que não devia), o cardápio e o estado de
// assinatura de todos os clientes vão embora sem volta. Este script exporta as
// tabelas do app via API REST e sobe um arquivo compactado para o R2, que é
// grátis (10 GB) e já está na conta Cloudflare do projeto.
//
// O que É valioso e está coberto: cardápio (restaurantes, categorias,
// produtos, adicionais, bairros), status de assinatura (admin_trials,
// store_day_passes) e saldos (créditos/bônus). Pedidos também entram — são
// descartáveis por retenção, mas úteis para recuperar o dia.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
//   node scripts/backup-to-r2.mjs
//
//   DRY_RUN=1 node scripts/backup-to-r2.mjs   # exporta, não sobe
//
// Restaurar: scripts/restore-from-r2.mjs (ver scripts/README.md).

import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/** Bucket do R2 que guarda os backups. Criado pelo workflow se não existir. */
const BUCKET = process.env.BACKUP_R2_BUCKET || "cardapio-cidadela-backups";

/**
 * Tabelas do app. As legadas (chat_messages/game_sessions/game_moves) ficam de
 * fora — não são usadas. Uma tabela que não existir no banco é pulada, não
 * quebra o backup.
 */
const TABLES = [
  "restaurants",
  "categories",
  "products",
  "addon_groups",
  "addons",
  "product_addons",
  "delivery_neighborhoods",
  "profiles",
  "admin_trials",
  "store_day_passes",
  "store_day_credits",
  "store_bonus_orders",
  "store_usage",
  "rewards",
  "reward_grants",
  "app_settings",
  "invoice_requests",
  "reviews",
  "promotions",
  "promotion_redemptions",
  "point_transactions",
  "cidadela_unlocks",
  "push_subscriptions",
  "push_vapid",
  "orders",
  "order_items",
  "order_status_history",
];

/** Formato do arquivo. Suba quando o payload mudar de forma. */
const BACKUP_VERSION = 1;

/** PostgREST devolve no máximo 1000 linhas por página; paginamos com Range. */
const PAGE_SIZE = 1000;

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`[backup] falta a variável ${name}`);
    process.exit(1);
  }
  return v.trim();
}

const SUPABASE_URL = requireEnv("SUPABASE_URL").replace(/\/$/, "");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");
// `R2_LOCAL=1` usa o R2 simulado do wrangler (dev/teste, sem credenciais).
const R2_LOCAL = process.env.R2_LOCAL === "1";

/** Lê todas as linhas de uma tabela, paginando. Devolve null se não existir. */
async function fetchTable(table) {
  const rows = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Range: `${from}-${to}`,
        "Range-Unit": "items",
      },
    });
    if (res.status === 404) return null; // tabela não existe neste banco
    if (!res.ok) {
      throw new Error(`${table}: HTTP ${res.status} ${await res.text().catch(() => "")}`);
    }
    const page = await res.json();
    if (!Array.isArray(page)) return null;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  const startedAt = new Date();
  const date = startedAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-"); // p/ nome do objeto
  const keyPrefix = `${date}/${stamp}`;

  console.log(`[backup] exportando ${TABLES.length} tabelas de ${SUPABASE_URL}`);

  const tables = {};
  const counts = {};
  const skipped = [];
  const failed = [];

  for (const table of TABLES) {
    try {
      const rows = await fetchTable(table);
      if (rows === null) {
        skipped.push(table);
        continue;
      }
      tables[table] = rows;
      counts[table] = rows.length;
      console.log(`[backup]   ${table}: ${rows.length} linha(s)`);
    } catch (e) {
      failed.push(table);
      console.error(`[backup]   ${table}: FALHOU — ${e.message}`);
    }
  }

  if (failed.length > 0) {
    // Backup parcial é pior que nenhum: sobe, mas marca como incompleto para o
    // restore não tratar como íntegro.
    console.error(`[backup] tabelas com erro: ${failed.join(", ")}`);
  }

  const payload = {
    version: BACKUP_VERSION,
    generatedAt: startedAt.toISOString(),
    supabaseUrl: SUPABASE_URL,
    incomplete: failed.length > 0,
    tables,
  };
  const gz = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

  const manifest = {
    version: BACKUP_VERSION,
    generatedAt: startedAt.toISOString(),
    key: `${keyPrefix}/backup.json.gz`,
    incomplete: failed.length > 0,
    tables: counts,
    skipped,
    failed,
    totalRows,
    bytes: gz.length,
  };

  const dir = join(process.cwd(), ".backup-tmp");
  mkdirSync(dir, { recursive: true });
  const localFile = join(dir, "backup.json.gz");
  const manifestFile = join(dir, "manifest.json");
  writeFileSync(localFile, gz);
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

  console.log(`[backup] ${totalRows} linha(s), ${(gz.length / 1024).toFixed(1)} KB compactados`);

  if (DRY_RUN) {
    console.log(`[backup] DRY_RUN=1 — arquivo local em ${localFile}, nada foi enviado`);
    return;
  }

  const localFlag = R2_LOCAL ? ["--local"] : ["--remote"];

  // Captura a saída do wrangler: precisamos inspecionar o stderr para
  // reconhecer o erro 10042 (R2 não ativado) e dar a instrução certa.
  const runWrangler = (args) => {
    try {
      const out = execFileSync("npx", ["wrangler", ...args], {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
      if (out) process.stdout.write(out);
      return { ok: true, out: out || "" };
    } catch (e) {
      const text = `${e.stdout || ""}${e.stderr || ""}`;
      process.stderr.write(text);
      return { ok: false, out: text };
    }
  };

  const r2NotEnabled = (text) => text.includes("10042") || /enable R2/i.test(text);

  const enableHint =
    "\n[backup] O R2 não está ativado nesta conta Cloudflare.\n" +
    "  Dar permissão ao token NÃO ativa o produto. Ative uma vez em:\n" +
    "  Cloudflare Dashboard → R2 Object Storage → 'Enable R2' (aceitar os termos).\n" +
    "  Depois rode de novo. O dump ficou em " +
    `${localFile} (não foi enviado).\n`;

  // Cria o bucket se ainda não existir. `r2 bucket create` é sempre remoto e
  // NÃO aceita --remote/--local (só --location/--storage-class/--jurisdiction);
  // passar a flag derruba o comando com "Unknown argument".
  if (!R2_LOCAL) {
    const created = runWrangler(["r2", "bucket", "create", BUCKET]);
    if (!created.ok && r2NotEnabled(created.out)) {
      console.error(enableHint);
      process.exit(1);
    }
    // "já existe" é inofensivo; qualquer outro erro aparece no upload abaixo.
  }

  for (const [objectPath, file] of [
    [`${keyPrefix}/backup.json.gz`, localFile],
    [`${date}/manifest.json`, manifestFile],
    [`latest/manifest.json`, manifestFile],
  ]) {
    const r = runWrangler([
      "r2",
      "object",
      "put",
      `${BUCKET}/${objectPath}`,
      `--file=${file}`,
      ...localFlag,
    ]);
    if (!r.ok) {
      if (r2NotEnabled(r.out)) {
        console.error(enableHint);
      }
      throw new Error(`falha ao enviar ${objectPath} para o R2`);
    }
  }

  rmSync(dir, { recursive: true, force: true });

  console.log(`[backup] enviado para r2://${BUCKET}/${keyPrefix}/backup.json.gz`);
  if (failed.length > 0) process.exit(2);
}

main().catch((e) => {
  console.error("[backup] erro fatal:", e.message);
  process.exit(1);
});
