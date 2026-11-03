#!/usr/bin/env node
// Retenção do bucket de backups no R2: mantém os N dias mais recentes e deixa o
// Cloudflare apagar o resto sozinho (lifecycle rule). Sem isso os dumps se
// acumulam para sempre — e ninguém lê o bucket, só escreve.
//
// Uso:  node scripts/r2-lifecycle.mjs [dias]
//       BACKUP_RETENTION_DAYS=3 node scripts/r2-lifecycle.mjs
//
// É idempotente: se a regra já existe, não faz nada e sai com sucesso.

import { execFileSync } from "node:child_process";

const BUCKET = process.env.BACKUP_R2_BUCKET || "cardapio-cidadela-backups";
const RULE = "expire-old";
const rawDays = process.argv[2] || process.env.BACKUP_RETENTION_DAYS || "3";
const days = Number(rawDays);

if (!Number.isInteger(days) || days < 1) {
  console.error(`[lifecycle] dias inválidos: ${rawDays} (use um inteiro >= 1)`);
  process.exit(1);
}

const run = (args) => {
  try {
    const out = execFileSync("npx", ["wrangler", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    if (out) process.stdout.write(out);
    return { ok: true, out: out || "" };
  } catch (e) {
    const out = `${e.stdout || ""}${e.stderr || ""}`;
    process.stderr.write(out);
    return { ok: false, out };
  }
};

// `add` falha quando a regra já existe; isso não é erro para nós.
const r = run([
  "r2",
  "bucket",
  "lifecycle",
  "add",
  BUCKET,
  RULE,
  "",
  "--expire-days",
  String(days),
  "--force",
]);

if (!r.ok) {
  if (/already exists|conflict|duplicate/i.test(r.out)) {
    console.log(`[lifecycle] regra '${RULE}' já existe em ${BUCKET} (nada a fazer)`);
    process.exit(0);
  }
  console.error(`[lifecycle] falha ao aplicar a regra em ${BUCKET}`);
  process.exit(1);
}

console.log(`[lifecycle] ${BUCKET}: objetos com mais de ${days} dia(s) serão apagados pelo R2`);
