# Especificação de Integração N8N - Cidadela Pracinha

## Endpoints Configurados

### 1. Webhook de Pedidos (Cardápio)

**URL:** `http://localhost:5678/webhook/pracinha` (configurável via `VITE_N8N_WEBHOOK_URL`)

**Payload Recebido:**

```json
{
  "cliente": "string",
  "telefone": "string",
  "endereco": "string",
  "observacoes": "string",
  "total": number,
  "itens": [
    {
      "id": "string",
      "name": "string",
      "quantity": number,
      "price": number,
      "total": number
    }
  ],
  "tipo_entrega": "entrega" | "retirada",
  "taxa_entrega": number,
  "distancia_km": 0,
  "imprimir": true,
  "impressao_largura": 32,
  "origem": "CIDADELA_PWA",
  "comanda": "string",
  "evento": "novo_pedido",
  "timestamp": "ISO8601",
  "pagamento": "pix" | "dinheiro" | "cartao",
  "troco": "string | undefined",
  "cidadela_code": "string",
  "cidadela_access_type": "15_min" | "15_dias"
}
```

**Lógica de Acesso:**

- `total >= 200`: `cidadela_access_type = "15_dias"`, código prefixo "FEB-VIP"
- `total < 200`: `cidadela_access_type = "15_min"`, código prefixo "FEB-ACESSO"

**Resposta Esperada:** HTTP 200 (sucesso) ou HTTP 500 (erro)

---

### 2. Webhook de Autenticação Cidadela

**URL:** `http://localhost:5678/webhook/cidadela` (configurável via `VITE_N8N_CIDADELA_AUTH_URL`)

**Payload Recebido:**

```json
{
  "codigo": "string",
  "origem": "CIDADELA_PWA",
  "timestamp": "ISO8601"
}
```

**Resposta Esperada:**

```json
{
  "success": boolean,
  "autenticado": boolean,
  "nivel_acesso": "admin" | "operador" | undefined,
  "token_sessao": "string" | undefined,
  "expiracao": "ISO8601" | undefined,
  "erro": "codigo_invalido" | "codigo_expirado" | "tentativas_excedidas" | undefined
}
```

**Códigos de Erro:**

- `codigo_invalido`: Código não existe ou está incorreto
- `codigo_expirado`: Código existe mas expirou
- `tentativas_excedidas`: Muitas tentativas em pouco tempo

---

## Fluxo de Pagamento e Liberação Premium

### 1. Usuário Cria Trial (Admin)

- Frontend cria trial no Supabase (tabela `admin_trials`)
- Gera código: `FEB-{RANDOM}-TRIAL`
- Expira em 2 dias
- Salva no localStorage e Supabase

### 2. Trial Expira - Usuário Clica WhatsApp

- Mensagem: "Quero código do painel Pracinha. Trial expirou."
- Direciona para seu WhatsApp configurado

### 3. Webhook Recebe Mensagem (N8N)

- Recebe mensagem do WhatsApp
- Gera código de liberação
- Insere na tabela `liberation_codes` do Supabase
- Envia código e PIX para o usuário

### 4. Usuário Insere Código

- Frontend valida código na tabela `liberation_codes`
- Ativa premium no trial do usuário
- Define `premium_expires_at` baseado na duração

**Payload para Inserir Código de Liberação:**

```json
{
  "code": "FEB-{RANDOM}-LIBERATION",
  "store_id": "uuid do admin_trials",
  "plan_type": "mensal" | "semestral" | "anual",
  "duration_days": number,
  "used": false,
  "created_at": "ISO8601"
}
```

---

## Variáveis de Ambiente

Configure no arquivo `.env`:

```env
VITE_N8N_WEBHOOK_URL=http://localhost:5678/webhook/pracinha
VITE_N8N_CIDADELA_AUTH_URL=http://localhost:5678/webhook/cidadela
VITE_WHATSAPP_NUMBER=5511999999999
```

---

## Supabase - Tabelas Relacionadas

### admin_trials

```sql
CREATE TABLE admin_trials (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  admin_phone TEXT NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  trial_started_at TIMESTAMPTZ NOT NULL,
  trial_expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
```

### liberation_codes

```sql
CREATE TABLE liberation_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  store_id TEXT REFERENCES admin_trials(id),
  plan_type TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
```

---

## Fila de Sincronização Offline

O sistema possui fila local para pedidos offline:

- Chave: `n8n_pending_queue` no localStorage
- Função: `flushQueue()` sincroniza pedidos pendentes
- Exibe contador no Dashboard: `FILA WEBHOOK: X`

---

## Resumo de Integrações

| Componente    | Webhook             | Payload             | Ação                           |
| ------------- | ------------------- | ------------------- | ------------------------------ |
| Cardapio      | `/webhook/pracinha` | N8nPayload          | Envia pedido + código Cidadela |
| CidadelaModal | `/webhook/cidadela` | CidadelaAuthPayload | Valida código de acesso        |
| AdminModal    | Supabase            | admin_trials        | Cria/valida trial              |
| BattleArena   | Supabase            | battles             | Batalhas online                |
| Chat          | Supabase            | chat_messages       | Chat persistente               |

---

## Próximos Passos para N8N

1. Criar webhook POST `/webhook/pracinha`
2. Criar webhook POST `/webhook/cidadela`
3. Configurar integração WhatsApp para receber mensagens
4. Criar fluxo para gerar códigos de liberação
5. Conectar Supabase para inserir `liberation_codes`
6. Enviar PIX e código via WhatsApp
