# PROMPT DETALHADO PARA CRIAÇÃO DE CARDÁPIO DIGITAL COMPLETO

## CONTEXTO GERAL
Você precisa criar um cardápio digital completo do zero para um estabelecimento de lanches, com sistema de pedidos, pagamento PIX, impressão de comandas térmicas, sistema de fidelidade com pontos de soberania, integração com Supabase e painel administrativo completo.

## STACK TECNOLÓGICO RECOMENDADO
- **Frontend**: React + TypeScript + Vite
- **Estilização**: TailwindCSS
- **Gerenciamento de Estado**: Zustand ou Context API
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Integrações**: Webhooks N8N
- **Ícones**: Lucide React
- **Roteamento**: Tanstack Router
- **Impressão**: API nativa do navegador (window.print)

## ARQUITETURA DO PROJETO

### Estrutura de Pastas
```
src/
├── components/
│   ├── cardapio/
│   │   ├── Cardapio.tsx (componente principal)
│   │   ├── PaymentScreen.tsx (tela de pagamento PIX)
│   │   ├── SuccessModal.tsx (modal de sucesso)
│   │   ├── AdminModal.tsx (painel administrativo)
│   │   └── admin/
│   │       ├── MenuPrincipal.tsx (menu do admin)
│   │       ├── GerenciarCategorias.tsx
│   │       ├── GerenciarLanches.tsx
│   │       ├── GerenciarPedidos.tsx
│   │       └── DescontosConfig.tsx
├── modules/
│   ├── core/
│   │   ├── store.tsx (gerenciamento de estado)
│   │   └── utils.ts (funções utilitárias)
│   └── supabase/
│       ├── client.ts (cliente Supabase)
│       └── admin.ts (hook useAdminTrial)
├── lib/
│   └── types.ts (tipos TypeScript)
└── routes/
    └── index.tsx
```

## FUNCIONALIDADES PRINCIPAIS

### 1. CARDÁPIO PRINCIPAL (Cardapio.tsx)

#### Interface Visual
- **Banner Superior**: 
  - Foto de capa (coverPhoto) com gradiente overlay
  - Nome da loja em destaque com efeito de sombra
  - Slogan/propaganda em texto animado
  - Robot garçom animado flutuando com olhos coloridos animados

- **Navegação por Categorias**:
  - Abas horizontais para navegar entre categorias
  - Categorias pré-definidas: Lanches, Adicionais, Bebidas
  - Cada categoria mostra ícone e nome

- **Grid de Produtos**:
  - Cards de produtos com foto, nome, descrição e preço
  - Botão de adicionar ao carrinho
  - Indicador de quantidade no carrinho

- **Carrinho Flutuante**:
  - Botão flutuante no canto inferior direito
  - Mostra quantidade de itens e total
  - Ao clicar abre modal do carrinho

#### Lógica do Carrinho
- **Estado do Carrinho**: Objeto com IDs de produtos e quantidades
- **Cálculo de Totais**: Soma de (preço × quantidade) de todos os itens
- **Sistema de Descontos**: 
  - Baseado em pontos de soberania do cliente
  - Tiers configuráveis pelo administrador
  - Ex: 100 pontos = 5%, 500 pontos = 10%, 1000 pontos = 15%
  - Desconto aplicado automaticamente se cliente tiver pontos suficientes

#### Fluxo de Pedido
1. **Seleção de Produtos**: Cliente adiciona itens ao carrinho
2. **Checkout**: Cliente clica no carrinho e preenche dados:
   - Nome do cliente
   - Telefone
   - E-mail (opcional mas recomendado)
   - Endereço (se entrega)
   - Tipo de entrega (entrega/retirada)
   - Observações
   - Método de pagamento (PIX/dinheiro/cartão)
   - Troco (se dinheiro)
3. **Processamento**:
   - Se PIX: Abre PaymentScreen com QR Code
   - Se dinheiro/cartão: Processa direto
4. **Após Pagamento**:
   - Salva pedido no Supabase
   - Envia webhook N8N
   - Adiciona pontos de soberania (1 ponto por R$30)
   - Mostra modal de sucesso

### 2. SISTEMA DE PAGAMENTO PIX (PaymentScreen.tsx)

#### Interface
- **QR Code**: Gerado automaticamente via API (api.qrserver.com)
- **Chave PIX**: Exibida com botão de copiar
- **Instruções**: Texto explicativo de como pagar
- **Botões**: Cancelar e "Já paguei"

#### Lógica
- **Geração de QR Code**: Usa chave PIX configurada no painel admin
- **Cópia de Chave**: Copia para clipboard com feedback visual
- **Confirmação**: Após clicar "Já paguei", processa pedido com delay de 3 segundos
- **Pagamentos Não-PIX**: Dinheiro e cartão processam automaticamente em 2 segundos

### 3. SISTEMA DE FIDELIDADE - PONTOS DE SOBERANIA

#### Acumulação de Pontos
- **Por Pedido**: 1 ponto a cada R$30 gastos
- **Por Vídeo**: Bônus adicional ao assistir vídeo promocional
- **Por Jogos**: Pontos ao jogar na Cidadela (não implementado no cardápio)

#### Sistema de Descontos
- **Tiers Configuráveis**: Administrador define faixas de pontos e porcentagens
- **Cálculo Automático**: Verifica pontos do cliente e aplica maior desconto disponível
- **Exemplo**:
  - 100 pontos = 5% de desconto
  - 500 pontos = 10% de desconto
  - 1000 pontos = 15% de desconto

#### Armazenamento
- **Supabase**: Tabela `soberania_points` (store_id, customer_email, customer_phone, points, last_updated, created_at)
- **Histórico**: Tabela `soberania_transactions` (store_id, customer_email, customer_phone, type, amount, reason, source, timestamp)


### 5. PAINEL ADMINISTRATIVO (AdminModal.tsx)

#### Sistema de Login
- **Trial Gratuito**: 2 minutos de teste
- **Login por E-mail**: Busca conta existente no Supabase
- **Login com Google**: OAuth via Supabase
- **Código de Acesso**: ADM-XXXXXX gerado automaticamente
- **Ativação Premium**: Código ADM-XXXXXX ativa 30 dias de premium

#### Módulos do Painel

##### 1. Menu Principal (MenuPrincipal.tsx)
- Botões para acessar cada módulo
- Ícones e descrições
- Status do trial/premium

##### 2. Configuração Operacional (Config.tsx)
- **Dados da Loja**:
  - Nome da loja
  - Slogan
  - Texto de marquee (propaganda)
  - Foto de capa
- **Pagamento**:
  - Chave PIX
- **Contato**:
  - WhatsApp
- **Metas**:
  - Meta de operação (R$)
- **Chave Administrativa**:
  - Access key para painel

##### 3. Gerenciar Categorias (GerenciarCategorias.tsx)
- **Criar Categoria**: Input + botão adicionar
- **Editar Categoria**: Clique no ícone de editar
- **Excluir Categoria**: Clique no ícone de excluir
- **Persistência**: Salva no state local e Supabase

##### 4. Gerenciar Lanches (GerenciarLanches.tsx)
- **Selecionar Categoria**: Grid de categorias
- **Adicionar Lanche**:
  - Nome
  - Descrição (opcional)
  - Preço
- **Editar Lanche**: Edição inline com campos
- **Excluir Lanche**: Botão de excluir
- **Persistência**: Salva no state local e Supabase

##### 5. Gerenciar Pedidos (GerenciarPedidos.tsx)
- **Listagem de Pedidos**: Busca do Supabase
- **Status de Pagamento**:
  - pending
  - awaiting_confirmation
  - paid
  - rejected
- **Ações**:
  - Ver comprovante de pagamento (imagem)
  - Confirmar pagamento
  - Rejeitar pagamento (com motivo)
- **Persistência**: Tabela `orders` no Supabase

##### 6. Configurar Descontos (DescontosConfig.tsx)
- **Tiers de Desconto**:
  - Pontos necessários
  - Porcentagem de desconto
- **Adicionar Tier**: Botão para criar nova faixa
- **Editar Tier**: Campos editáveis
- **Excluir Tier**: Botão de excluir
- **Persistência**: Salva no state local e Supabase (admin_trials.discount_tiers)

### 6. IMPRESSÃO DE COMANDAS TÉRMICAS

#### Formato do Ticket
- **Largura**: 32 colunas (padrão impressoras térmicas)
- **Cabeçalho**:
  - Nome da loja (centralizado)
  - "COMANDA FEB" (centralizado)
  - Linha separadora
- **Dados do Pedido**:
  - Número da comanda
  - Data e hora
  - Nome do cliente
  - Telefone
  - Endereço (se entrega) ou "RETIRADA NO BALCAO"
- **Itens**:
  - Quantidade × Nome ... Preço
- **Totais**:
  - Taxa de entrega
  - Total
  - Método de pagamento
  - Troco (se aplicável)
- **Observações**: Se houver
- **Rodapé**:
  - "A COBRA ESTA FUMANDO"
  - "HONRA . DIGNIDADE . BRIO"

#### Função de Impressão
- **buildThermalTicket**: Gera string formatada
- **printTicket**: Abre nova janela e aciona impressão
- **Formatação**: Usa fonte monospace para alinhamento

### 7. INTEGRAÇÃO SUPABASE

#### Tabelas Principais

##### admin_trials
```sql
- id (UUID, PK)
- store_id (VARCHAR, UNIQUE) - Código ADM-XXXXXX
- store_name (VARCHAR)
- store_slogan (TEXT)
- store_marquee (TEXT)
- pix_key (VARCHAR)
- whatsapp (VARCHAR)
- admin_phone (VARCHAR)
- admin_email (VARCHAR)
- access_code (VARCHAR, opcional)
- trial_started_at (TIMESTAMP)
- trial_expires_at (TIMESTAMP)
- is_active (BOOLEAN)
- is_premium (BOOLEAN)
- premium_expires_at (TIMESTAMP)
- config_updated_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

##### orders
```sql
- id (UUID, PK)
- store_id (VARCHAR)
- customer_name (VARCHAR)
- customer_email (VARCHAR)
- customer_phone (VARCHAR)
- delivery_address (TEXT)
- delivery_type (VARCHAR)
- observations (TEXT)
- subtotal (DECIMAL)
- delivery_fee (DECIMAL)
- total (DECIMAL)
- payment_method (VARCHAR)
- change_for (DECIMAL)
- comanda (VARCHAR)
- status (VARCHAR)
- payment_status (VARCHAR)
- payment_confirmed_at (TIMESTAMP)
- payment_proof_url (TEXT)
- payment_rejected_reason (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

##### order_items
```sql
- id (UUID, PK)
- order_id (UUID, FK)
- product_id (VARCHAR)
- product_name (VARCHAR)
- quantity (INTEGER)
- unit_price (DECIMAL)
- total (DECIMAL)
- created_at (TIMESTAMP)
```

##### soberania_points
```sql
- id (UUID, PK)
- store_id (VARCHAR)
- customer_email (VARCHAR)
- customer_phone (VARCHAR)
- points (INTEGER)
- last_updated (TIMESTAMP)
- created_at (TIMESTAMP)
```

##### soberania_transactions
```sql
- id (UUID, PK)
- store_id (VARCHAR)
- customer_email (VARCHAR)
- customer_phone (VARCHAR)
- type (VARCHAR) - CHECK (type IN ('earned', 'lost', 'spent', 'rewarded'))
- amount (INTEGER)
- reason (TEXT)
- source (VARCHAR) - CHECK (source IN ('game', 'order', 'ad', 'admin'))
- timestamp (TIMESTAMP)
- created_at (TIMESTAMP)
```

### 8. INTEGRAÇÃO WEBHOOKS N8N

#### Webhook de Pedidos
- **URL**: Configurável no painel admin
- **Payload**:
  - Dados do pedido (cliente, itens, total, etc.)
  - Dados da loja
  - WhatsApp do admin
- **Uso**: Envia pedido para sistema de gestão

#### Webhook de Trial Admin
- **URL**: Configurável no painel admin
- **Payload**:
  - Nome da loja
  - Telefone do admin
  - E-mail do admin
- **Uso**: Notifica criação de novo trial

### 9. DESIGN E UX

#### Paleta de Cores
- **Primary**: Brass (#D4AF37)
- **Secondary**: Matte (#2C2C2C)
- **Olive**: Verde oliva
- **Tech**: Ciano para textos técnicos
- **Background**: Preto (#000000)
- **Cards**: Slate-900 (#0F172A)

#### Animações
- **Float**: Robot garçom flutuando (3s ease-in-out infinite)
- **Eye Color**: Mudança de cor dos olhos (4s ease-in-out infinite)
- **Glow**: Efeito de brilho em botões

#### Responsividade
- **Mobile**: Layout otimizado para telas pequenas
- **Desktop**: Layout adaptado com grid e modais centrados
- **Tablet**: Transição suave entre layouts

### 10. FLUXO COMPLETO DO USUÁRIO

#### Cliente
1. Acessa cardápio
2. Navega por categorias
3. Adiciona itens ao carrinho
4. Clica no carrinho
5. Preenche dados do pedido
6. Escolhe método de pagamento
7. Se PIX: Escaneia QR Code e confirma
8. Recebe confirmação do pedido

#### Administrador
1. Acessa painel administrativo
2. Faz login (trial ou premium)
3. Configura dados da loja
4. Gerencia categorias e lanches
5. Configura descontos por pontos
6. Recebe e gerencia pedidos
7. Confirma/rejeita pagamentos
8. Imprime comandas térmicas

### 11. REQUISITOS TÉCNICOS

#### Performance
- **Lazy Loading**: Carregar componentes sob demanda
- **Memoization**: Usar useMemo e useCallback
- **Otimização de Imagens**: Comprimir e usar formatos modernos
- **Cache**: Implementar cache de dados frequentes

#### Segurança
- **Validação de Inputs**: Sanitizar todos os dados
- **Autenticação**: Supabase Auth com JWT
- **Autorização**: Verificar permissões no backend
- **HTTPS**: Obrigatório em produção

#### Acessibilidade
- **ARIA Labels**: Em todos os elementos interativos
- **Contraste**: Mínimo de 4.5:1 para textos
- **Navegação por Teclado**: Suporte completo
- **Screen Readers**: Compatibilidade com leitores de tela

### 12. DEPLOYMENT

#### Ambiente
- **Desenvolvimento**: Vite dev server
- **Produção**: Vite build + hospedagem (Vercel/Netlify)
- **Variáveis de Ambiente**:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
  - VITE_N8N_WEBHOOK_URL
  - VITE_WHATSAPP_NUMBER
  - VITE_ADMIN_ACCESS_KEY

#### Build
```bash
npm run build
```

#### Preview
```bash
npm run preview
```

## INSTRUÇÕES PARA A AGÊNCIA

1. **Analisar o Código Existente**: Estude todos os arquivos mencionados
2. **Recriar do Zero**: Não copie código, reimplemente com melhorias
3. **Simplificar**: Remova complexidade desnecessária
4. **Otimizar**: Foque em performance e UX
5. **Documentar**: Adicione comentários claros
6. **Testar**: Teste todos os fluxos
7. **Deploy**: Prepare para produção

## PONTOS DE ATENÇÃO

- **Sistema de Trial**: 2 minutos, não 2 dias
- **Código ADM**: Salvar em store_id (formato ADM-XXXXXX)
- **Pontos de Soberania**: 1 ponto por R$30
- **Descontos**: Configuráveis por tiers
- **Impressão**: Formato térmico 32 colunas
- **Supabase**: Usar tabelas existentes (admin_trials, orders, order_items, soberania_points, soberania_transactions)
- **Webhooks**: Enviar payloads completos
- **Responsividade**: Mobile-first
- **Performance**: Otimizar carregamento
- **Nomes Reais**: Usar exatamente os nomes das tabelas e colunas do schema existente

## ENTREGÁVEIS

1. **Código Fonte Completo**: React + TypeScript
2. **Documentação**: README com instruções
3. **Schema SQL**: Arquivo com supabase_schema.sql
4. **Variáveis de Ambiente**: .env.example
5. **Guia de Deploy**: Instruções de produção
6. **Testes**: Testes básicos dos fluxos principais

## CRITÉRIOS DE SUCESSO

- [ ] Cardápio funcional com todas as features
- [ ] Sistema de pagamento PIX operacional
- [ ] Impressão de comandas funcionando
- [ ] Painel administrativo completo
- [ ] Sistema de fidelidade operacional
- [ ] Integração Supabase funcionando
- [ ] Webhooks enviando dados corretos
- [ ] Design responsivo e bonito
- [ ] Performance otimizada
- [ ] Código limpo e documentado

---

**IMPORTANTE**: Este é um projeto crítico para o cliente. Não deixe passar nenhum detalhe. Teste exaustivamente antes de entregar. Qualquer problema pode causar perda de vendas e insatisfação dos clientes.
