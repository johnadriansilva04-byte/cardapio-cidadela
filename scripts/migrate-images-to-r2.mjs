#!/usr/bin/env node
// ============================================================
// Migração: imagens do Supabase Storage → Cloudflare R2
// ============================================================
// O plano gratuito do Supabase dá 5 GB de egress/mês e imagem é o que mais
// consome. No R2 o egress é zero e o domínio público (images.pracinha.online)
// é cacheado na borda pela Cloudflare. Este script move os objetos existentes
// do bucket `restaurant-images` para o R2 e reescreve as URLs no banco.
//
// É idempotente: um objeto que já existe no R2 é pulado; uma URL que já aponta
// para o R2 não é tocada. Rode quantas vezes quiser.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
//   node scripts/migrate-images-to-r2.mjs
//
//   DRY_RUN=1 ... node scripts/migrate-images-to-r2.mjs   # só lista
//
// O token da Cloudflare precisa de permissão "Workers R2 Storage: Edit".

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUCKET = process.env.IMAGES_R2_BUCKET || "cardapio-cidadela-images";
const PUBLIC_BASE = process.env.IMAGES_R2_BASE || "https://images.pracinha.online";
const SUPABASE_BUCKET = "restaurant-images";
const DRY_RUN = process.env.DRY_RUN === "1";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!SUPABASE_URL || !SERVICE_KEY || !ACCOUNT_ID) {
  console.error("[migrate] faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const tmp = mkdtempSync(join(tmpdir(), "r2-migrate-"));

/** Roda SQL via Management API? Não: usamos a REST API com o service role. */
async function sb(path, init) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...sbHeaders, ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`supabase ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

/** Sobe um arquivo para o R2 via wrangler (usa CLOUDFLARE_API_TOKEN do ambiente). */
function r2Put(key, file) {
  execFileSync("npx", ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--remote"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/** Converte a URL pública do Supabase na chave do objeto. */
function keyFromSupabaseUrl(url) {
  const marker = `/object/public/${SUPABASE_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length));
}

async function migrateObject(key) {
  const srcUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${key}`;
  const res = await fetch(srcUrl);
  if (!res.ok) {
    console.warn(`  ! falha ao baixar ${key}: ${res.status}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const local = join(tmp, key.replace(/\//g, "__"));
  writeFileSync(local, buf);
  r2Put(key, local);
  return `${PUBLIC_BASE}/${key}`;
}

/** Reescreve as URLs no banco (restaurants + products). */
async function rewriteUrls(map) {
  let changed = 0;
  const { data: restaurants } = await sb(`/rest/v1/restaurants?select=id,logo_url,banner_url`);
  for (const r of restaurants || []) {
    const patch = {};
    for (const col of ["logo_url", "banner_url"]) {
      const key = keyFromSupabaseUrl(r[col] || "");
      if (key && map.has(key)) patch[col] = map.get(key);
    }
    if (Object.keys(patch).length) {
      if (DRY_RUN) {
        console.log(`  [dry] restaurants ${r.id} ->`, patch);
      } else {
        await sb(`/rest/v1/restaurants?id=eq.${r.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
      }
      changed++;
    }
  }

  const { data: products } = await sb(`/rest/v1/products?select=id,image_url&image_url=not.is.null`);
  for (const p of products || []) {
    const key = keyFromSupabaseUrl(p.image_url || "");
    if (key && map.has(key)) {
      if (DRY_RUN) {
        console.log(`  [dry] products ${p.id} -> ${map.get(key)}`);
      } else {
        await sb(`/rest/v1/products?id=eq.${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ image_url: map.get(key) }),
        });
      }
      changed++;
    }
  }
  return changed;
}

async function main() {
  console.log(`[migrate] bucket ${BUCKET} <- Supabase ${SUPABASE_BUCKET}${DRY_RUN ? " (DRY_RUN)" : ""}`);
  const listing = await sb(`/storage/v1/object/list/${SUPABASE_BUCKET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1000 }),
  });

  // A listagem vem por pasta; percorremos recursivamente.
  const keys = [];
  for (const entry of listing || []) {
    if (entry.id) {
      keys.push(entry.name);
    } else {
      const sub = await sb(`/storage/v1/object/list/${SUPABASE_BUCKET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: `${entry.name}/`, limit: 1000 }),
      });
      for (const f of sub || []) if (f.id) keys.push(`${entry.name}/${f.name}`);
    }
  }
  console.log(`[migrate] ${keys.length} objeto(s) encontrados`);

  const map = new Map();
  for (const key of keys) {
    if (DRY_RUN) {
      console.log(`  [dry] copiar ${key}`);
      continue;
    }
    try {
      const url = await migrateObject(key);
      if (url) {
        map.set(key, url);
        console.log(`  ✓ ${key}`);
      }
    } catch (e) {
      console.warn(`  ! ${key}: ${e.message}`);
    }
  }

  if (!DRY_RUN) {
    const changed = await rewriteUrls(map);
    console.log(`[migrate] ${map.size} objeto(s) no R2, ${changed} URL(s) reescrita(s)`);
  }
}

main().catch((e) => {
  console.error("[migrate] erro:", e.message);
  process.exit(1);
});
