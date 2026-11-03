# Backups (Supabase → Cloudflare R2)

O plano gratuito do Supabase **não tem backup automático**. Se o banco quebrar,
um `DELETE` errado no SQL Editor ou um job de retenção apagar demais, o cardápio
e o estado de assinatura de todos os clientes vão embora sem volta.

Estes scripts guardam uma cópia diária no **Cloudflare R2** (10 GB grátis, já
inclusos na conta Cloudflare do projeto) e sabem restaurá-la.

## O que é salvo

Os dados que doem perder: **cardápio** (restaurantes, categorias, produtos,
adicionais, bairros), **assinatura** (`admin_trials`, `store_day_passes`),
**saldos** (créditos e bônus) e também `orders`/`order_items` (descartáveis por
retenção, mas úteis para recuperar o dia). Tabelas legadas
(`chat_messages`/`game_sessions`/`game_moves`) ficam de fora.

Cada execução gera **um arquivo compactado** (`backup.json.gz`) com todas as
tabelas + um `manifest.json` com a contagem por tabela e a flag `incomplete`
(se alguma tabela falhou, o restore sabe que o dump não é íntegro).

## Onde fica

- **Bucket:** `cardapio-cidadela-backups` (R2, privado — sem domínio público).
- **Chave de cada backup:** `AAAA-MM-DD/<timestamp>/backup.json.gz`.
- **Manifesto datado:** `AAAA-MM-DD/manifest.json`.
- **Ponteiro para o último:** `latest/manifest.json`.

O bucket é **privado**: o dump tem dados de clientes. Não crie domínio público
nem `r2.dev` para ele.

## Como funciona no dia a dia

O workflow `.github/workflows/backup-r2.yml` roda **todo dia às 03:30 UTC**
(00:30 BRT) e também aceita execução manual (Actions → *Backup* → Run workflow).
Não é preciso fazer nada: o arquivo do dia vai para o R2 sozinho.

## Secrets necessários (GitHub → Settings → Secrets)

| Secret | De onde vem |
|---|---|
| `VITE_SUPABASE_URL` | já existe (usado no deploy) |
| `SUPABASE_SERVICE_ROLE_KEY` | **adicionar** — Supabase → Settings → API → `service_role` |
| `CLOUDFLARE_ACCOUNT_ID` | já existe (usado no deploy) |
| `CLOUDFLARE_API_TOKEN` | já existe; precisa de **Workers R2: Edit** |

Sem `SUPABASE_SERVICE_ROLE_KEY` o workflow falha na hora — é ele que lê as
tabelas com RLS (o dump precisa ver tudo).

## Rodar à mão (dev)

```bash
SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role>" \
CLOUDFLARE_ACCOUNT_ID="<account>" \
CLOUDFLARE_API_TOKEN="<token com R2 Edit>" \
node scripts/backup-to-r2.mjs
```

`DRY_RUN=1` exporta e grava local (em `.backup-tmp/`) sem subir nada.
`R2_LOCAL=1` usa o R2 simulado do wrangler (teste sem credenciais).

## Recuperar de um backup

> ⚠️ O restore faz **upsert por `id`**: recria o que sumiu e atualiza o que
> mudou. Não apaga o que já está no banco. Mesmo assim, rode primeiro sem
> `--confirm` para ver o plano.

```bash
# 1) Ver o que tem no último backup
R2_LOCAL=0 node scripts/restore-from-r2.mjs --list

# 2) Simular (não escreve nada)
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  node scripts/restore-from-r2.mjs --latest

# 3) Restaurar de verdade
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  node scripts/restore-from-r2.mjs --latest --confirm
```

Opções:

- `--latest` — usa o backup mais recente (`latest/manifest.json`).
- `--key <objeto>` — restaura um arquivo específico, ex.:
  `2026-11-03/2026-11-03T03-30-00-000Z/backup.json.gz`.
- `RESTORE_TABLES=restaurants,categories,products` — restaura só essas tabelas
  (útil para recuperar o cardápio sem mexer em assinaturas).

### Recuperando só o cardápio de uma loja

O restore é por tabela, não por linha. Para um caso pontual, baixe o arquivo e
filtre:

```bash
npx wrangler r2 object get cardapio-cidadela-backups/latest/manifest.json \
  --file=/tmp/manifest.json --remote
npx wrangler r2 object get \
  cardapio-cidadela-backups/2026-11-03/2026-11-03T03-30-00-000Z/backup.json.gz \
  --file=/tmp/backup.json.gz --remote
node -e "const z=require('zlib'),fs=require('fs');
const p=JSON.parse(z.gunzipSync(fs.readFileSync('/tmp/backup.json.gz')));
console.log(p.tables.restaurants.map(r=>({id:r.id,name:r.name,slug:r.slug})));"
```

## Retenção

O R2 tem 10 GB grátis. Um dump deste app fica na casa de **dezenas de KB a
alguns MB** (o cardápio é texto; fotos ficam no Storage, não no dump), então
guardar anos cabe folgado. Se quiser limpar os antigos automaticamente:

```bash
# Apaga backups com mais de 365 dias
npx wrangler r2 bucket lifecycle add cardapio-cidadela-backups expire-1y "" \
  --expire-days 365 --remote
```

## Testar sem nuvem

Os dois scripts aceitam `R2_LOCAL=1` (R2 simulado pelo wrangler). O teste do
ciclo completo é: exportar → subir local → baixar → upsert. Não precisa de
Supabase nem de token da Cloudflare.
