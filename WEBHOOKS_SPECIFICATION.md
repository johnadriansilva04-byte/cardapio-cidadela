# ESPECIFICAÇÃO DE WEBHOOKS - CARDÁPIO DIGITAL CIDADELA

## ⚠️ INSTRUÇÕES PARA IA ASSISTENTE

### COMPORTAMENTO OBRIGATÓRIO
1. **ANTI-LOOP**: Quando detectar que o HUMANO entrou na conversa, PARE imediatamente de digitar. Não continue gerando respostas automaticamente.
2. **TIMEOUT DE REPETIÇÃO**: Nunca repita a mesma mensagem ou instrução. Use um timeout de 30 segundos entre tentativas similares.
3. **DETEÇÃO DE USUÁRIO**: Se o usuário enviar qualquer mensagem, interrompa todo processamento automático e aguarde instruções explícitas.
4. **ESTADO DE CONVERSA**: Mantenha controle do estado - se estiver em modo automático e o usuário intervir, mude para modo manual imediatamente.

### ERROS QUE PODEM OCORRIR E COMO TRATAR

#### Webhook 1 - Erros do Pedido
- `network_error`: Falha de conexão com n8n → Tentar novamente após 5s (max 3 tentativas)
- `timeout`: Webhook não respondeu em 15s → Enfileirar para sincronização offline
- `invalid_payload`: Dados do pedido inválidos → Mostrar erro ao usuário e não enviar
- `server_error_500`: Erro interno do servidor n8n → Enfileirar e tentar depois
- `unauthorized_401`: Credenciais inválidas → Alertar administrador
- `rate_limit_429`: Muitas requisições → Implementar backoff exponencial
- `validation_error`: Campos obrigatórios faltando → Validar antes de enviar

#### Webhook 2 - Erros do WhatsApp
- `whatsapp_unavailable`: API WhatsApp fora do ar → Enfileirar mensagem
- `invalid_number`: Número de telefone inválido → Validar formato antes
- `message_too_long`: Mensagem excede limite → Truncar ou dividir
- `media_upload_failed`: Falha ao enviar mídia → Tentar sem mídia
- `blocked_number`: Número bloqueado pelo WhatsApp → Alertar usuário
- `credits_exhausted`: Créditos da API esgotados → Alertar administrador

#### Webhook 3 - Erros de Autenticação
- `invalid_code`: Código não existe no banco → Retornar erro específico
- `code_expired`: Código expirou → Solicitar novo código
- `too_many_attempts`: Muitas tentativas → Bloquear por 5 minutos
- `database_error`: Erro ao acessar banco → Retornar erro genérico
- `token_generation_failed`: Falha ao gerar token → Retornar erro

#### Erros Gerais
- `offline_mode`: Sem conexão internet → Ativar modo offline
- `storage_full`: Armazenamento local cheio → Alertar usuário
- `cors_error**: Erro de CORS → Verificar configuração servidor
- `parse_error`: Erro ao parsear JSON → Validar formato

### TRATAMENTO DE ERROS
- Sempre logar erro com timestamp
- Mostrar mensagem amigável ao usuário
- Implementar retry com backoff exponencial
- Enfileirar operações para retry offline
- Alertar administrador em erros críticos

---

## VISÃO GERAL
Este documento define 3 webhooks necessários para o funcionamento do Cardápio Digital PWA com integração WhatsApp e Cidadela.

---

## WEBHOOK 1: RECEBER PEDIDO DO CARDÁPIO (n8n)

### Propósito
Receber pedidos do cardápio digital e processar para envio ao WhatsApp/impressora.

### Endpoint
```
POST /webhook/cardapio/pedido
```

### Headers
```
Content-Type: application/json
```

### Payload (JSON)
```json
{
  "cliente": "string",
  "telefone": "string",
  "endereco": "string",
  "observacoes": "string",
  "total": "number",
  "itens": [
    {
      "id": "string",
      "name": "string",
      "quantity": "number",
      "price": "number",
      "total": "number"
    }
  ],
  "tipo_entrega": "entrega" | "retirada",
  "taxa_entrega": "number",
  "distancia_km": "number",
  "imprimir": "boolean",
  "impressao_largura": "number",
  "origem": "CIDADELA_PWA",
  "comanda": "string",
  "evento": "novo_pedido",
  "timestamp": "string (ISO 8601)",
  "pagamento": "pix" | "dinheiro" | "cartao",
  "troco": "string | undefined",
  "cidadela_code": "string",
  "cidadela_access_type": "15_min" | "15_dias"
}
```

### Resposta Esperada
```json
{
  "success": true,
  "comanda": "string",
  "mensagem": "Pedido recebido com sucesso"
}
```

### Fluxo de Processamento
1. Receber payload do cardápio
2. Validar dados do pedido
3. Verificar campo `cidadela_access_type` para determinar tipo de acesso:
   - `15_min`: Qualquer compra gera código temporário de 15 minutos
   - `15_dias`: Compras >= R$200 geram código VIP de 15 dias
4. Formatar mensagem para WhatsApp incluindo o código `cidadela_code`
5. Enviar para Webhook 2 (WhatsApp) com código de acesso
6. Opcional: Enviar para impressora térmica
7. Retornar confirmação

---

## WEBHOOK 2: ENVIAR MENSAGEM WHATSAPP

### Propósito
Enviar mensagem formatada para o WhatsApp do restaurante.

### Endpoint
```
POST /webhook/whatsapp/enviar
```

### Headers
```
Content-Type: application/json
Authorization: Bearer <TOKEN_WHATSAPP_API>
```

### Payload (JSON)
```json
{
  "numero_destino": "string (formato: 5511999999999)",
  "mensagem_formatada": "string (formato Comanda com markdown)",
  "tipo": "comanda_pedido",
  "comanda": "string"
}
```

### Formato da Mensagem (Comanda)
```
==============================
   *NOVO PEDIDO - [NOME DA LOJA]*
==============================
*Cliente:* [Nome]
*Telefone:* [Telefone]
*Tipo:* [Delivery / Retirada]
*Endereço:* [Rua, Nº - Bairro]
*Obs. Endereço:* [Ponto de referência]

------------------------------
*ITENS DO PEDIDO:*
- 1x X-TUDO (R$ 30,00)
  _Obs: Sem cebola_
- 1x COCA-COLA 2L (R$ 12,00)
------------------------------

*FORMA DE PAGAMENTO:* [PIX / Dinheiro (Troco p/ R$ 50) / Cartão]
*TAXA DE ENTREGA:* R$ 5,00
*TOTAL DO PEDIDO:* R$ 47,00

🔓 *CÓDIGO CIDADELA:* [cidadela_code]
*ACESSO:* [15 minutos / 15 dias]
==============================
```

### Resposta Esperada
```json
{
  "success": true,
  "message_id": "string",
  "status": "enviado"
}
```

### Integrações Sugeridas
- WhatsApp Business API (Meta)
- Twilio API
- MessageBird
- Ou aplicativo local com webhook receiver

---

## WEBHOOK 3: AUTENTICAÇÃO CIDADELA

### Propósito
Validar código de acesso ao painel Cidadela (área restrita).

### Endpoint
```
POST /webhook/cidadela/auth
```

### Headers
```
Content-Type: application/json
```

### Payload (JSON)
```json
{
  "codigo": "string",
  "origem": "CIDADELA_PWA",
  "timestamp": "string (ISO 8601)"
}
```

### Resposta Esperada (Sucesso)
```json
{
  "success": true,
  "autenticado": true,
  "nivel_acesso": "admin" | "operador",
  "token_sessao": "string",
  "expiracao": "string (ISO 8601)"
}
```

### Resposta Esperada (Erro)
```json
{
  "success": false,
  "autenticado": false,
  "erro": "codigo_invalido" | "codigo_expirado" | "tentativas_excedidas"
}
```

### Fluxo de Processamento
1. Receber código do usuário
2. Validar código contra banco de dados
3. Verificar se código está ativo e não expirado
4. Gerar token de sessão
5. Retornar nível de acesso e token

---

## CONFIGURAÇÃO NO n8n

### Workflow 1: Receber Pedido do Cardápio
```
1. Webhook Node (POST /webhook/cardapio/pedido)
2. Function Node (Validar dados)
3. Function Node (Formatar mensagem WhatsApp)
4. HTTP Request Node (Chamar Webhook 2)
5. Function Node (Opcional: formatar para impressora)
6. HTTP Request Node (Opcional: enviar para impressora)
7. Respond to Webhook Node
```

### Workflow 2: Autenticação Cidadela
```
1. Webhook Node (POST /webhook/cidadela/auth)
2. Function Node (Validar código)
3. Database Node (Verificar no banco)
4. Function Node (Gerar token)
5. Respond to Webhook Node
```

---

## VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```env
# n8n
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/cardapio/pedido
N8N_AUTH_URL=https://seu-n8n.com/webhook/cidadela/auth

# WhatsApp
WHATSAPP_API_URL=https://api.whatsapp.com/v1/messages
WHATSAPP_API_TOKEN=seu_token_aqui
WHATSAPP_NUMERO_RESTAURANTE=5511999999999

# Cidadela
CIDADELA_AUTH_SECRET=chave_secreta_para_tokens
```

---

## TESTE DOS WEBHOOKS

### Teste Webhook 1 (Pedido)
```bash
curl -X POST https://seu-n8n.com/webhook/cardapio/pedido \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": "João Silva",
    "telefone": "11999999999",
    "endereco": "Rua Teste, 123 - Centro",
    "observacoes": "Sem cebola",
    "total": 47.00,
    "itens": [{"id": "1", "name": "X-TUDO", "quantity": 1, "price": 30.00, "total": 30.00}],
    "tipo_entrega": "entrega",
    "taxa_entrega": 5.00,
    "distancia_km": 0,
    "imprimir": true,
    "impressao_largura": 32,
    "origem": "CIDADELA_PWA",
    "comanda": "CMD-001",
    "evento": "novo_pedido",
    "timestamp": "2026-07-26T22:00:00Z",
    "pagamento": "pix",
    "cidadela_code": "FEB-ACESSO-ABCD-1944",
    "cidadela_access_type": "15_min"
  }'
```

### Teste Webhook 2 (WhatsApp)
```bash
curl -X POST https://seu-whatsapp-api.com/webhook/enviar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -d '{
    "numero_destino": "5511999999999",
    "mensagem_formatada": "==============================\n   *NOVO PEDIDO - TESTE*\n==============================",
    "tipo": "comanda_pedido",
    "comanda": "CMD-001"
  }'
```

### Teste Webhook 3 (Cidadela)
```bash
curl -X POST https://seu-n8n.com/webhook/cidadela/auth \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "ABC123",
    "origem": "CIDADELA_PWA",
    "timestamp": "2026-07-26T22:00:00Z"
  }'
```

---

## NOTAS IMPORTANTES

1. **Offline Support**: O cardápio já implementa fila local. Pedidos ficam enfileirados quando offline e sincronizam quando a conexão volta.

2. **Segurança**: Webhook 3 deve implementar rate limiting para evitar brute force em códigos.

3. **Impressão**: Opcional, mas recomendado para automação completa da cozinha.

4. **WhatsApp**: Pode usar API oficial ou solução local com aplicativo no celular do restaurante.

5. **Logs**: Implementar logs de todos os webhooks para debugging e auditoria.

6. **Códigos Cidadela**: O sistema gera automaticamente códigos de acesso baseados no valor do pedido:
   - Qualquer compra: Código temporário de 15 minutos (prefixo FEB-ACESSO)
   - Compras >= R$200: Código VIP de 15 dias (prefixo FEB-VIP)
   - O código deve ser incluído na mensagem WhatsApp enviada ao cliente
   - O cliente usa o código para acessar a Cidadela no cardápio
