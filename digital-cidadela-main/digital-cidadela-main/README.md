# Digital Cidadela

PROMPT DETALHADO PASSO A PASSO PARA CRIAÇÃO DE CARDÁPIO DIGITAL COMPLETO
INSTRUÇÃO GERAL
Você vai criar um cardápio digital completo do zero. Leia atentamente cada passo. Use EXATAMENTE os nomes das tabelas e colunas que estão especificados aqui. Não invente nomes. Use as palavras exatas que estão descritas.

PASSO 1: CONFIGURAÇÃO INICIAL DO PROJETO
1.1 Criar projeto React + TypeScript + Vite


bash
npm create vite@latest cardapio-digital -- --template react-ts
cd cardapio-digital
npm install
1.2 Instalar dependências


bash
npm install @tanstack/react-router lucide-react zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
1.3 Configurar TailwindCSS
No arquivo tailwind.config.js, configure:



javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brass: "#D4AF37",
        matte: "#2C2C2C",
        olive: "#808000",
        tech: "#00FFFF",
      },
    },
  },
  plugins: [],
}
1.4 Instalar Supabase



bash
npm install @supabase/supabase-js
PASSO 2: ESTRUTURA DE PASTAS
Crie EXATAMENTE esta estrutura:



src/
├── components/
│   ├── cardapio/
│   │   ├── Cardapio.tsx
│   │   ├── PaymentScreen.tsx
│   │   ├── SuccessModal.tsx
│   │   ├── VideoBonusModal.tsx
│   │   ├── AdminModal.tsx
│   │   └── admin/
│   │       ├── MenuPrincipal.tsx
│   │       ├── GerenciarCategorias.tsx
│   │       ├── GerenciarLanches.tsx
│   │       ├── GerenciarPedidos.tsx
│   │       └── DescontosConfig.tsx
├── modules/
│   ├── core/
│   │   ├── store.tsx
│   │   └── utils.ts
│   └── supabase/
│       ├── client.ts
│       └── admin.ts
├── lib/
│   └── types.ts
└── routes/
    └── index.tsx
PASSO 3: CONFIGURAÇÃO SUPABASE
3.1 Criar arquivo [c:/Bunker/AppVariant/Proj Principal/src/modules/supabase/client.ts](cci:4://file:///c:/Bunker/AppVariant/Proj Principal/src/modules/supabase/client.ts:0:0-0:0)


typescript
import { createClient } from '@supabase/supabase-js'
 
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
 
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
3.2 Variáveis de ambiente
Crie arquivo .env:



VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon
VITE_N8N_WEBHOOK_URL=seu_webhook_n8n
VITE_WHATSAPP_NUMBER=seu_whatsapp
VITE_ADMIN_ACCESS_KEY=sua_chave_admin
PASSO 4: TIPOS TYPESCRIPT
4.1 Criar arquivo types.ts


typescript
export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  img: string
}
 
export interface Category {
  id: string
  name: string
  items: MenuItem[]
}
 
export interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  total: number
}
 
export type OrderStatus = "pendente" | "andamento" | "entregue"
 
export interface Order {
  comanda: string
  cliente: string
  email?: string
  telefone: string
  endereco: string
  observacoes: string
  itens: OrderItem[]
  total: number
  tipo_entrega: "entrega" | "retirada"
  taxa_entrega: number
  pagamento: "pix" | "dinheiro" | "cartao"
  troco?: string
  status: OrderStatus
  createdAt: string
  synced: boolean
}
 
export interface AppState {
  store: { name: string; slogan: string; marquee: string; coverPhoto?: string }
  payment: { pixKey: string }
  admin: { accessKey: string; phone?: string; email?: string; storeId?: string; discountTiers?: DiscountTier[] }
  whatsapp: string
  categories: Category[]
  orders: Order[]
  soberania: { points: number; history: SoberaniaTransaction[] }
}
 
export interface DiscountTier {
  points: number
  percentage: number
}
 
export interface SoberaniaTransaction {
  id: string
  type: "earned" | "lost" | "spent" | "rewarded"
  amount: number
  reason: string
  source: "game" | "order" | "ad" | "admin"
  timestamp: string
}
PASSO 5: GERENCIAMENTO DE ESTADO (ZUSTAND)
5.1 Criar arquivo src/modules/core/store.tsx


typescript
import { create } from 'zustand'
import type { AppState, Category, Order, DiscountTier, SoberaniaTransaction } from '@/lib/types'
 
export const useStore = create((set) => ({
  store: {
    name: "Cantina do Pracinha",
    slogan: "Sabor de trincheira, brio de veterano",
    marquee: "ENTREGA EM ATÉ 35 MIN • PIX APROVADO NA HORA",
  },
  payment: { pixKey: "" },
  admin: { accessKey: "", discountTiers: [] },
  whatsapp: "",
  categories: [],
  orders: [],
  soberania: { points: 0, history: [] },
  
  update: (fn) => set(fn),
}))
PASSO 6: FUNÇÕES UTILITÁRIAS
6.1 Criar arquivo src/modules/core/utils.ts


typescript
export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
 
export function newComanda(): string {
  const counter = parseInt(localStorage.getItem("comanda_counter") || "0")
  const newCounter = counter + 1
  localStorage.setItem("comanda_counter", newCounter.toString())
  return `#${newCounter}`
}
 
export function buildThermalTicket(order: Order, storeName: string): string {
  const W = 32
  const line = "-".repeat(W)
  const center = (t: string) => t.padStart(Math.floor((W + t.length) / 2)).padEnd(W)
  const row = (l: string, r: string) => l.slice(0, W - r.length - 1).padEnd(W - r.length) + r
 
  return [
    center(storeName.toUpperCase()),
    center("COMANDA FEB"),
    line,
    `PEDIDO: ${order.comanda}`,
    `DATA..: ${new Date(order.createdAt).toLocaleString("pt-BR")}`,
    `CLIENTE: ${order.cliente}`,
    `FONE...: ${order.telefone}`,
    order.tipo_entrega === "entrega" ? `ENDER..: ${order.endereco}` : "RETIRADA NO BALCAO",
    line,
    ...order.itens.map((i) => row(`${i.quantity}x ${i.name}`, brl(i.total))),
    line,
    row("TAXA", brl(order.taxa_entrega)),
    row("TOTAL", brl(order.total)),
    `PAGTO.: ${order.pagamento.toUpperCase()}${order.troco ? ` (troco p/ ${order.troco})` : ""}`,
    order.observacoes ? `OBS...: ${order.observacoes}` : "",
    line,
    center("A COBRA ESTA FUMANDO"),
    center("HONRA . DIGNIDADE . BRIO"),
    "",
  ]
  .filter(Boolean)
  .join("\n")
}
 
export function printTicket(ticket: string) {
  const win = window.open("", "_blank", "width=380,height=640")
  if (!win) return
  win.document.write(
    `

${ticket.replace(/[<>&]/g, (c) => ({ "<": "&​lt;", ">": "&​gt;", "&": "&​amp;" })[c] as string)}

`,
  )
  win.document.close()
  win.focus()
  win.print()
}
PASSO 7: HOOK SUPABASE ADMIN
7.1 Criar arquivo admin.ts


typescript
import { useState, useEffect } from 'react'
import { supabase } from './client'
 
interface AdminTrial {
  id: string
  store_id: string
  store_name: string
  store_slogan: string
  store_marquee: string
  pix_key: string
  whatsapp: string
  admin_phone: string
  admin_email: string
  trial_started_at: string
  trial_expires_at: string
  is_active: boolean
  is_premium: boolean
  premium_expires_at: string
}
 
export function useAdminTrial() {
  const [trial, setTrial] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExpired, setIsExpired] = useState(false)
  const [daysRemaining, setDaysRemaining] = useState(0)
 
  // Função para gerar código ADM-XXXXXX
  function generateAdminCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = 'ADM-'
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
 
  // Criar trial - salva código em store_id
  async function createTrial(storeName: string, adminPhone: string, adminEmail: string) {
    const trialStartedAt = new Date()
    const trialExpiresAt = new Date(trialStartedAt.getTime() + 2 * 60 * 1000) // 2 minutos
    
    // Gerar código de administrador (ADM-XXXXXX) como store_id
    const storeId = generateAdminCode()
 
    const { data, error } = await supabase
      .from("admin_trials")
      .insert({
        store_id: storeId,
        store_name: storeName,
        admin_phone: adminPhone,
        admin_email: adminEmail,
        trial_started_at: trialStartedAt.toISOString(),
        trial_expires_at: trialExpiresAt.toISOString(),
        created_at: new Date().toISOString(),
        is_active: true,
        is_premium: false,
      })
      .select()
      .single()
 
    if (error) {
      console.error("Error creating trial:", error)
      return null
    }
 
    localStorage.setItem("admin_trial", JSON.stringify(data))
    setTrial(data)
    return data
  }
 
  // Validar acesso por e-mail
  async function validateAccessCode(email: string) {
    const { data, error } = await supabase
      .from("admin_trials")
      .select("*")
      .eq("admin_email", email)
      .single()
 
    if (error || !data) {
      return { valid: false, trial: null }
    }
 
    const trialData = data as AdminTrial
    const now = new Date()
    const expiresAt = new Date(trialData.trial_expires_at)
 
    const isValid = trialData.is_active && (now <= expiresAt || trialData.is_premium)
 
    localStorage.setItem("admin_trial", JSON.stringify(trialData))
    setTrial(trialData)
 
    return { valid: isValid, trial: trialData }
  }
 
  // Ativar código premium - busca em store_id
  async function activateLiberationCode(code: string) {
    const { data, error } = await supabase
      .from("admin_trials")
      .select("*")
      .eq("store_id", code)
      .single()
 
    if (error || !data) {
      return { success: false, message: "Código inválido ou não encontrado" }
    }
 
    const adminTrial = data as AdminTrial
 
    if (adminTrial.is_premium) {
      return { success: false, message: "Esta conta já é premium" }
    }
 
    const now = new Date()
    const premiumExpiresAt = new Date()
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + 30)
 
    const { error: updateError } = await supabase
      .from("admin_trials")
      .update({
        is_premium: true,
        premium_expires_at: premiumExpiresAt.toISOString(),
      })
      .eq("id", adminTrial.id)
 
    if (updateError) {
      return { success: false, message: "Erro ao ativar código" }
    }
 
    localStorage.setItem("admin_trial", JSON.stringify({ ...adminTrial, is_premium: true, premium_expires_at: premiumExpiresAt.toISOString() }))
    setTrial({ ...adminTrial, is_premium: true, premium_expires_at: premiumExpiresAt.toISOString() })
 
    return { success: true, message: "Código ativado com sucesso!" }
  }
 
  // Carregar configurações do admin
  async function loadAdminConfig(storeId: string) {
    const { data, error } = await supabase
      .from("admin_trials")
      .select("store_name, store_slogan, store_marquee, pix_key, whatsapp")
      .eq("id", storeId)
      .single()
 
    if (data) {
      return data
    }
  }
 
  // Atualizar configurações do admin
  async function updateAdminConfig(storeId: string, config: {
    store_name?: string
    store_slogan?: string
    store_marquee?: string
    pix_key?: string
    whatsapp?: string
  }) {
    const { error } = await supabase
      .from("admin_trials")
      .update({
        ...config,
        config_updated_at: new Date().toISOString(),
      })
      .eq("id", storeId)
 
    if (error) {
      console.error("Erro ao atualizar configurações:", error)
      return false
    }
 
    return true
  }
 
  // Carregar pedidos do Supabase
  async function loadOrdersFromSupabase(storeId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
 
    if (error) {
      console.error("Erro ao carregar pedidos:", error)
      return []
    }
 
    return data || []
  }
 
  // Função para recarregar trial
  function reloadTrial() {
    const savedTrial = localStorage.getItem("admin_trial")
    if (savedTrial) {
      const parsed = JSON.parse(savedTrial)
      setTrial(parsed)
    }
  }
 
  // Limpar trial
  function clearTrial() {
    localStorage.removeItem("admin_trial")
    setTrial(null)
  }
 
  return {
    trial,
    isLoading,
    isExpired,
    daysRemaining,
    createTrial,
    validateAccessCode,
    activateLiberationCode,
    loadAdminConfig,
    updateAdminConfig,
    loadOrdersFromSupabase,
    reloadTrial,
    clearTrial,
  }
}
PASSO 8: COMPONENTE CARDÁPIO PRINCIPAL - INTERFACE CYBERPUNK
8.1 Criar arquivo Cardapio.tsx
Este é o componente principal do cardápio com interface cyberpunk centralizada.

8.1.1 Interface Visual - Banner Superior Cyberpunk
O banner deve ser centralizado no meio da tela com:

Background Preto: bg-black em todo o componente
Foto de Capa:
Altura de 256px (h-64)
Largura total (w-full)
Background image com bg-cover bg-center bg-no-repeat
Se não tiver foto: usar gradiente radial cyberpunk:
radial-gradient(ellipse at center top, #e8f4fc 0%, #87ceeb 30%, #4682b4 60%, #1e3a5f 100%)
Gradiente overlay: bg-gradient-to-b from-transparent via-black/30 to-black
Nome da Loja:
Posicionado no topo centralizado (absolute top-4 left-0 right-0 px-4 text-center)
Texto branco com tamanho 4xl (text-4xl)
Fonte black com tracking-tight (font-black tracking-tight)
Drop shadow neon vermelho: drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]
Slogan:
Abaixo do nome (mt-1)
Texto pequeno (text-sm)
Fonte medium (font-medium)
Cor ciano neon (text-cyan-300)
Texto: "Qual será o seu pedido?"
Robot Garçom Animado:
Posicionado centralizado abaixo do nome (absolute left-1/2 top-20 -translate-x-1/2)
Animação de flutuação: animate-float (3s ease-in-out infinite)
SVG com viewBox="0 0 200 240"
Tamanho 160px (size-40)
Gradientes 3D:
head3D: Radial gradient branco → azul claro → azul escuro
body3D: Linear gradient branco → azul claro → azul escuro → azul marinho
suitGradient: Linear gradient cinza escuro → preto
shirtGradient: Linear gradient branco → cinza claro
trayGradient: Linear gradient prata
glassGradient: Linear gradient vidro transparente
waterGradient: Linear gradient água azul
Filtros 3D:
shadow3D: Drop shadow com desfoque
glow3D: Gaussian blur para efeito de brilho neon
Cabeça do robot:
Ellipse 3D com gradiente head3D
Face display preto com borda azul
Olhos LED animados com cor mudando:
Animação eyeColorChange: 4s ease-in-out infinite
Cores: ciano → magenta → verde → amarelo
Efeito de brilho com glow3D
Pontos brancos nos olhos
Sorriso ciano com brilho neon
Corpo do robot:
Pescoço com gradiente body3D
Corpo branco/azul 3D
Terno cinza escuro
Colete preto
Camisa branca
Gravata preta com ponto azul
Braços atrás e com toalha
Bandeja com copos de água
Toalha de serviço no braço direito
Três copos de água na bandeja
8.1.2 Animações CSS
Adicionar estas animações no componente:



css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
 
@keyframes eyeColorChange {
  0%, 100% { fill: #00ffff; }
  25% { fill: #ff00ff; }
  50% { fill: #00ff00; }
  75% { fill: #ffff00; }
}
8.1.3 Navegação por Categorias
Abas horizontais abaixo do banner
Cada categoria mostra:
Nome da categoria
Ícone (opcional)
Categoria ativa destacada com cor brass
Scroll horizontal se muitas categorias
8.1.4 Grid de Produtos Cyberpunk
Grid responsivo (grid-cols-2 no mobile, grid-cols-3 no desktop)
Cards com:
Background slate-900 (#0F172A)
Borda com border-border
Hover com border-brass e hover:bg-slate-800
Foto do produto (emoji ou imagem)
Nome do produto em branco
Descrição em cinza claro (text-gray-400)
Preço em cor brass (#D4AF37)
Botão de adicionar com background brass
Efeito de glow no botão (ember-glow)
8.1.5 Carrinho Flutuante
Botão flutuante no canto inferior direito
Background brass com efeito glow
Ícone ShoppingBag
Badge com quantidade de itens
Ao clicar abre modal do carrinho
8.1.6 Modal do Carrinho
Background preto com backdrop-blur
Modal centralizado
Lista de itens com:
Nome do produto
Preço unitário
Quantidade com botões +/-
Total do item
Desconto aplicado (se houver) em verde
Total final em destaque
Botão de checkout com background brass
8.1.7 Sistema de Descontos
Buscar state.soberania.points
Buscar state.admin.discountTiers
Calcular desconto baseado em tiers
Mostrar desconto aplicado no carrinho
Exemplo: "Desconto (10%): -R$5,00"
8.1.8 Checkout
Formulário com campos:
Nome do cliente
Telefone
E-mail (opcional)
Endereço (se entrega)
Tipo de entrega (radio: entrega/retirada)
Observações (textarea)
Método de pagamento (radio: pix/dinheiro/cartao)
Troco (se dinheiro)
Botão de confirmar pedido
Validação de campos obrigatórios
8.1.9 Processamento do Pedido
Gerar comanda com newComanda()
Se PIX: Abrir PaymentScreen
Se dinheiro/cartão: Processar direto
Após pagamento:
Salvar pedido na tabela orders
Salvar itens na tabela order_items
Calcular pontos: Math.floor(total / 30)
Salvar pontos na tabela soberania_points
Salvar transação na tabela soberania_transactions
Se pontos > 0: Abrir VideoBonusModal
Se pontos = 0: Abrir SuccessModal
Enviar webhook N8N
PASSO 9: COMPONENTE VÍDEO BÔNUS (GOOGLE ADSENSE)
9.1 Criar arquivo src/components/cardapio/VideoBonusModal.tsx
Este componente mostra um vídeo promocional para ganhar pontos extras.

9.1.1 Interface do Modal
Background preto com backdrop-blur
Modal centralizado
Título: "Assista ao vídeo para ganhar pontos extras!"
Descrição: "Você ganhou X pontos. Assista ao vídeo para dobrar seus pontos!"
Player de vídeo:
Duração: 3 minutos
Vídeo do Google AdSense
Timer de progresso
Botões:
"Pular vídeo" (perde bônus)
"Assistir vídeo" (ganha bônus)
9.1.2 Lógica do Vídeo
Calcular pontos bônus: Mesma quantidade de pontos do pedido
Mostrar modal: Se pointsEarned > 0
Timer de 3 minutos:
Contador regressivo
Barra de progresso
Atualização a cada segundo
Ao completar vídeo:
Adicionar pontos bônus
Salvar na tabela soberania_points
Salvar transação na tabela soberania_transactions com source "ad"
Fechar modal
Abrir SuccessModal
Ao pular vídeo:
Não adiciona pontos bônus
Fecha modal
Abre SuccessModal
9.1.3 Integração Google AdSense
Usar iframe do Google AdSense
Vídeo de 3 minutos
Configurar ID do publisher AdSense
Rastrear visualização do vídeo
PASSO 10: COMPONENTE PAGAMENTO PIX
10.1 Criar arquivo PaymentScreen.tsx
Este componente deve:

Receber order como prop
Mostrar valor total do pedido em destaque
Gerar QR Code usando state.payment.pixKey
API: https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encodeURIComponent(pixKey)}
Mostrar chave PIX com botão de copiar
Instruções em caixa azul:
"Abra o app do seu banco"
"Escaneie o QR Code ou copie a chave PIX"
Botão "Já paguei":
Mostra loading por 3 segundos
Chama onSuccess()
Pagamentos não-PIX:
Processam automaticamente em 2 segundos
Chama onSuccess()
PASSO 11: COMPONENTE PAINEL ADMINISTRATIVO
11.1 Criar arquivo AdminModal.tsx
Este é o painel administrativo completo com interface cyberpunk.

11.1.1 Interface do Painel
Background preto
Modal centralizado
Borda com cor brass
Título em cor tech (ciano)
Botões com efeito glow
11.1.2 Sistema de Login
Trial Gratuito: 2 minutos
Login por e-mail: Chama validateAccessCode(email)
Código ADM-XXXXXX: Gerado automaticamente e salvo em store_id
Ativação Premium: Chama activateLiberationCode(code) buscando em store_id
Cronômetro: Mostra tempo restante do trial em formato MM:SS
11.1.3 Menu Principal
Botões para cada módulo:
Configuração Operacional
Gerenciar Categorias
Gerenciar Lanches
Gerenciar Pedidos
Configurar Descontos
Ícones de cada módulo
Status do trial/premium
11.1.4 Configuração Operacional
Campo Nome da loja: Salva em admin_trials.store_name
Campo Slogan: Salva em admin_trials.store_slogan
Campo Marquee: Salva em admin_trials.store_marquee
Campo Chave PIX: Salva em admin_trials.pix_key
Campo WhatsApp: Salva em admin_trials.whatsapp
Campo Meta de operação: Salva localmente
Campo Chave administrativa: Salva localmente
Botão Salvar: Chama updateAdminConfig()
11.1.5 Gerenciar Categorias
Input para nova categoria
Botão Adicionar: Cria categoria com crypto.randomUUID()
Lista de categorias: Mostra state.categories
Botão Editar: Edita nome da categoria
Botão Excluir: Remove categoria do state
Persistência: Salva no state local
11.1.6 Gerenciar Lanches
Selecionar categoria: Grid de categorias
Adicionar lanche:
Campo Nome
Campo Descrição (opcional)
Campo Preço
Botão Adicionar: Cria item com crypto.randomUUID()
Lista de lanches: Mostra itens da categoria
Botão Editar: Edita nome, descrição, preço
Botão Excluir: Remove item do state
Persistência: Salva no state local
11.1.7 Gerenciar Pedidos
Carregar pedidos: Chama loadOrdersFromSupabase(storeId)
Listar pedidos: Mostra da tabela orders
Status de pagamento:
pending (cinza)
awaiting_confirmation (amarelo)
paid (verde)
rejected (vermelho)
Botão Ver comprovante: Mostra payment_proof_url
Botão Confirmar pagamento: Atualiza orders.payment_status para "paid"
Botão Rejeitar pagamento: Atualiza orders.payment_status para "rejected" com motivo
11.1.8 Configurar Descontos
Tiers de desconto:
Campo "Pontos necessários"
Campo "Desconto (%)"
Botão Adicionar Tier: Cria nova faixa
Lista de tiers: Mostra state.admin.discountTiers
Botão Editar: Edita pontos e porcentagem
Botão Excluir: Remove tier
Persistência: Salva no state local
PASSO 12: IMPRESSÃO DE COMANDAS
12.1 Conexão com Impressora
Para conectar com impressora térmica:

Usar window.print(): Abre diálogo de impressão do navegador
Formatar ticket: Usar buildThermalTicket(order, storeName)
Fonte monospace: Garante alinhamento correto
32 colunas: Padrão de impressoras térmicas
A função printTicket() deve:

Abrir nova janela
Escrever HTML com pre tag
Usar fonte monospace (ui-monospace, monospace)
Chamar window.print()
Fechar janela após impressão
PASSO 13: SISTEMA DE PONTOS DE SOBERANIA
13.1 Acumulação de Pontos
Quando um pedido é concluído:

Calcular pontos: Math.floor(total / 30)
Buscar pontos existentes na tabela soberania_points
Se não existir: Criar novo registro
Se existir: Atualizar pontos
Registrar transação na tabela soberania_transactions
13.2 Tabela soberania_points
Campos EXATOS:

id (UUID, PK)
store_id (VARCHAR)
customer_email (VARCHAR)
customer_phone (VARCHAR)
points (INTEGER)
last_updated (TIMESTAMP)
created_at (TIMESTAMP)
13.3 Tabela soberania_transactions
Campos EXATOS:

id (UUID, PK)
store_id (VARCHAR)
customer_email (VARCHAR)
customer_phone (VARCHAR)
type (VARCHAR) - CHECK (type IN ('earned', 'lost', 'spent', 'rewarded'))
amount (INTEGER)
reason (TEXT)
source (VARCHAR) - CHECK (source IN ('game', 'order', 'ad', 'admin'))
timestamp (TIMESTAMP)
created_at (TIMESTAMP)
13.4 Sistema de Descontos
No carrinho, calcular desconto:

Buscar pontos do cliente em soberania_points
Buscar tiers em state.admin.discountTiers
Encontrar maior desconto aplicável
Aplicar desconto no total
Exemplo de tiers:

100 pontos = 5%
500 pontos = 10%
1000 pontos = 15%
PASSO 14: INTEGRAÇÃO SUPABASE - TABELAS EXISTENTES
14.1 Tabela admin_trials
Use EXATAMENTE estes campos:

id (UUID, PK)
store_id (VARCHAR, UNIQUE) - Código ADM-XXXXXX vai aqui
store_name (VARCHAR)
store_slogan (TEXT)
store_marquee (TEXT)
pix_key (VARCHAR)
whatsapp (VARCHAR)
admin_phone (VARCHAR)
admin_email (VARCHAR)
access_code (VARCHAR, opcional)
trial_started_at (TIMESTAMP)
trial_expires_at (TIMESTAMP)
is_active (BOOLEAN)
is_premium (BOOLEAN)
premium_expires_at (TIMESTAMP)
config_updated_at (TIMESTAMP)
created_at (TIMESTAMP)
14.2 Tabela orders
Use EXATAMENTE estes campos:

id (UUID, PK)
store_id (VARCHAR)
customer_name (VARCHAR)
customer_email (VARCHAR)
customer_phone (VARCHAR)
delivery_address (TEXT)
delivery_type (VARCHAR)
observations (TEXT)
subtotal (DECIMAL)
delivery_fee (DECIMAL)
total (DECIMAL)
payment_method (VARCHAR)
change_for (DECIMAL)
comanda (VARCHAR)
status (VARCHAR)
payment_status (VARCHAR)
payment_confirmed_at (TIMESTAMP)
payment_proof_url (TEXT)
payment_rejected_reason (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
14.3 Tabela order_items
Use EXATAMENTE estes campos:

id (UUID, PK)
order_id (UUID, FK)
product_id (VARCHAR)
product_name (VARCHAR)
quantity (INTEGER)
unit_price (DECIMAL)
total (DECIMAL)
created_at (TIMESTAMP)
PASSO 15: WEBHOOK N8N
15.1 Enviar Pedido
Quando um pedido é concluído, enviar para N8N:



typescript
async function sendToN8N(webhookUrl: string, payload: any) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch (error) {
    console.error('Erro ao enviar webhook:', error)
    return false
  }
}
Payload deve incluir:

Dados do pedido (cliente, itens, total)
Dados da loja (nome, whatsapp)
store_id
PASSO 16: ESTILO E DESIGN CYBERPUNK
16.1 Paleta de Cores
Use EXATAMENTE estas cores:

brass: "#D4AF37" (dourado neon)
matte: "#2C2C2C" (cinza escuro)
olive: "#808000" (verde oliva)
tech: "#00FFFF" (ciano neon)
background: "#000000" (preto)
cards: "#0F172A" (slate-900)
border: "#334155" (slate-700)
16.2 Efeitos Neon
Adicionar efeitos de brilho:

Drop shadow em textos: drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]
Glow em botões: ember-glow classe customizada
Borda brilhante: border-[color:var(--brass)]
Texto neon: text-[color:var(--tech)]
16.3 Animações
Adicionar no CSS global:



css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
 
@keyframes eyeColorChange {
  0%, 100% { fill: #00ffff; }
  25% { fill: #ff00ff; }
  50% { fill: #00ff00; }
  75% { fill: #ffff00; }
}
 
@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(212, 175, 55, 0.5); }
  50% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.8); }
}
 
.ember-glow {
  animation: glow 2s ease-in-out infinite;
}
PASSO 17: RESPONSIVIDADE
17.1 Mobile
Layout otimizado para telas pequenas
Modais abrem em tela cheia (fixed inset-0)
Botões grandes para toque
Grid de produtos 2 colunas
17.2 Desktop
Layout com grid 3 colunas
Modais centrados com max-width
Navegação por mouse
Espaçamento maior entre elementos
PASSO 18: TESTES
18.1 Testar Fluxo do Cliente
Acessar cardápio
Ver banner cyberpunk com robot animado
Adicionar itens ao carrinho
Ver desconto aplicado se tiver pontos
Fazer checkout
Pagar com PIX
Assistir vídeo de 3 minutos para ganhar pontos extras
Verificar pontos de soberania dobrados
Verificar modal de sucesso
18.2 Testar Fluxo do Admin
Fazer login com e-mail
Ver cronômetro de trial
Configurar dados da loja
Criar categorias
Criar lanches
Configurar descontos por tiers
Receber pedido
Confirmar pagamento
Imprimir comanda
PASSO 19: DEPLOYMENT
19.1 Build



bash
npm run build
19.2 Preview



bash
npm run preview
19.3 Deploy
Usar Vercel ou Netlify
Configurar variáveis de ambiente
Testar em produção
INSTRUÇÕES FINAIS
Use EXATAMENTE os nomes das tabelas e colunas especificados
Não invente novos nomes
Siga cada passo em ordem
Teste cada funcionalidade
Use as palavras exatas descritas aqui
Não pule nenhum passo
Verifique se tudo está funcionando antes de entregar
Interface deve ser cyberpunk centralizada no meio
Vídeo AdSense deve ter 3 minutos de duração
Robot garçom deve ter animação de flutuação e olhos coloridos
CRÍTICO:

O código ADM deve ser salvo em store_id, não em access_code
O sistema de trial é de 2 minutos, não 2 dias
Use as tabelas existentes do Supabase com os nomes exatos
Interface cyberpunk centralizada com robot animado
Vídeo AdSense de 3 minutos para ganhar pontos extras
Sistema de pontos de soberania com bônus por vídeo


Feedback submitted



Cara, não é possível como que você consegue ser tão um lixo assim. Cara, leia o meu projeto e é para você replicar. Veja as abas, a interface, principalmente o botão da cidadela, que é aquela lua lá em cima, brilhante em neon. Mano, é pra você descrever exatamente como tá o meu projeto, pra ele replicar tudo de uma vez, entendeu? Não é pra inventar coisa nova. Só escreva de novo tudo, entendeu? Exatamente como tá, como tá o botão centralizado no meio, embaixo lá tem a cidadela, tem o painel, entendeu? É pra ser exatamente como tá, as mesmas cores, do mesmo jeito, entendeu?

Read
Cardapio.tsx
#L1-811
PROMPT DETALHADO PASSO A PASSO PARA CRIAÇÃO DE CARDÁPIO DIGITAL COMPLETO
INSTRUÇÃO GERAL
Você vai criar um cardápio digital completo do zero. Leia atentamente cada passo. Use EXATAMENTE os nomes das tabelas e colunas que estão especificados aqui. Não invente nomes. Use as palavras exatas que estão descritas. REPLIQUE EXATAMENTE A INTERFACE EXISTENTE.

PASSO 1: CONFIGURAÇÃO INICIAL DO PROJETO
1.1 Criar projeto React + TypeScript + Vite


bash
npm create vite@latest cardapio-digital -- --template react-ts
cd cardapio-digital
npm install
1.2 Instalar dependências


bash
npm install @tanstack/react-router lucide-react zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
1.3 Configurar TailwindCSS
No arquivo tailwind.config.js, configure:



javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brass: "#D4AF37",
        matte: "#2C2C2C",
        olive: "#808000",
        tech: "#00FFFF",
      },
    },
  },
  plugins: [],
}
1.4 Instalar Supabase



bash
npm install @supabase/supabase-js
PASSO 2: ESTRUTURA DE PASTAS
Crie EXATAMENTE esta estrutura:



src/
├── components/
│   ├── cardapio/
│   │   ├── Cardapio.tsx
│   │   ├── PaymentScreen.tsx
│   │   ├── SuccessModal.tsx
│   │   ├── VideoBonusModal.tsx
│   │   ├── AdminModal.tsx
│   │   ├── CartSheet.tsx
│   │   └── CheckoutModal.tsx
│   └── CobraFumando.tsx
├── modules/
│   ├── core/
│   │   ├── store.tsx
│   │   └── utils.ts
│   └── supabase/
│       ├── client.ts
│       └── admin.ts
├── lib/
│   └── types.ts
└── routes/
    ├── index.tsx
    ├── cidadela.tsx
    ├── privacy.tsx
    └── terms.tsx
PASSO 3: CONFIGURAÇÃO SUPABASE
3.1 Criar arquivo [c:/Bunker/AppVariant/Proj Principal/src/modules/supabase/client.ts](cci:4://file:///c:/Bunker/AppVariant/Proj Principal/src/modules/supabase/client.ts:0:0-0:0)


typescript
import { createClient } from '@supabase/supabase-js'
 
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
 
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
3.2 Variáveis de ambiente
Crie arquivo .env:



VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon
VITE_N8N_WEBHOOK_URL=seu_webhook_n8n
VITE_WHATSAPP_NUMBER=seu_whatsapp
VITE_ADMIN_ACCESS_KEY=sua_chave_admin
PASSO 4: TIPOS TYPESCRIPT
4.1 Criar arquivo types.ts


typescript
export interface MenuItem {
  id: string
  name: string
  desc: string
  price: number
  img: string
}
 
export interface Category {
  id: string
  name: string
  items: MenuItem[]
}
 
export interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  total: number
}
 
export type OrderStatus = "pendente" | "andamento" | "entregue"
 
export interface Order {
  comanda: string
  cliente: string
  email?: string
  telefone: string
  endereco: string
  observacoes: string
  itens: OrderItem[]
  total: number
  tipo_entrega: "entrega" | "retirada"
  taxa_entrega: number
  pagamento: "pix" | "dinheiro" | "cartao"
  troco?: string
  status: OrderStatus
  createdAt: string
  synced: boolean
}
 
export interface AppState {
  store: { name: string; slogan: string; marquee: string; coverPhoto?: string }
  payment: { pixKey: string }
  admin: { accessKey: string; phone?: string; email?: string; storeId?: string; discountTiers?: DiscountTier[] }
  whatsapp: string
  categories: Category[]
  orders: Order[]
  soberania: { points: number; history: SoberaniaTransaction[] }
  cidadela: { codes: any[] }
  integrations: { n8nWebhookUrl: string }
}
 
export interface DiscountTier {
  points: number
  percentage: number
}
 
export interface SoberaniaTransaction {
  id: string
  type: "earned" | "lost" | "spent" | "rewarded"
  amount: number
  reason: string
  source: "game" | "order" | "ad" | "admin"
  timestamp: string
}
PASSO 5: GERENCIAMENTO DE ESTADO (ZUSTAND)
5.1 Criar arquivo src/modules/core/store.tsx


typescript
import { create } from 'zustand'
import type { AppState, Category, Order, DiscountTier, SoberaniaTransaction } from '@/lib/types'
 
export const useStore = create((set) => ({
  store: {
    name: "Cantina do Pracinha",
    slogan: "Sabor de trincheira, brio de veterano",
    marquee: "ENTREGA EM ATÉ 35 MIN • PIX APROVADO NA HORA",
  },
  payment: { pixKey: "" },
  admin: { accessKey: "", discountTiers: [] },
  whatsapp: "",
  categories: [],
  orders: [],
  soberania: { points: 0, history: [] },
  cidadela: { codes: [] },
  integrations: { n8nWebhookUrl: "" },
  
  update: (fn) => set(fn),
}))
PASSO 6: FUNÇÕES UTILITÁRIAS
6.1 Criar arquivo src/modules/core/utils.ts


typescript
export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
 
export function newComanda(): string {
  const counter = parseInt(localStorage.getItem("comanda_counter") || "0")
  const newCounter = counter + 1
  localStorage.setItem("comanda_counter", newCounter.toString())
  return `#${newCounter}`
}
 
export function generatePromoCode(prefix?: string, accessType: "15_min" | "15_dias" = "15_min") {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = prefix || ''
  if (accessType === "15_dias") {
    code = 'VIP-'
  } else {
    code = 'CID-'
  }
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  const now = new Date()
  const expiration = new Date(now.getTime() + (accessType === "15_dias" ? 15 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000))
  
  return { code, expiration }
}
 
export function buildThermalTicket(order: Order, storeName: string): string {
  const W = 32
  const line = "-".repeat(W)
  const center = (t: string) => t.padStart(Math.floor((W + t.length) / 2)).padEnd(W)
  const row = (l: string, r: string) => l.slice(0, W - r.length - 1).padEnd(W - r.length) + r
 
  return [
    center(storeName.toUpperCase()),
    center("COMANDA FEB"),
    line,
    `PEDIDO: ${order.comanda}`,
    `DATA..: ${new Date(order.createdAt).toLocaleString("pt-BR")}`,
    `CLIENTE: ${order.cliente}`,
    `FONE...: ${order.telefone}`,
    order.tipo_entrega === "entrega" ? `ENDER..: ${order.endereco}` : "RETIRADA NO BALCAO",
    line,
    ...order.itens.map((i) => row(`${i.quantity}x ${i.name}`, brl(i.total))),
    line,
    row("TAXA", brl(order.taxa_entrega)),
    row("TOTAL", brl(order.total)),
    `PAGTO.: ${order.pagamento.toUpperCase()}${order.troco ? ` (troco p/ ${order.troco})` : ""}`,
    order.observacoes ? `OBS...: ${order.observacoes}` : "",
    line,
    center("A COBRA ESTA FUMANDO"),
    center("HONRA . DIGNIDADE . BRIO"),
    "",
  ]
  .filter(Boolean)
  .join("\n")
}
 
export function printTicket(ticket: string) {
  const win = window.open("", "_blank", "width=380,height=640")
  if (!win) return
  win.document.write(
    `

${ticket.replace(/[<>&]/g, (c) => ({ "<": "&​lt;", ">": "&​gt;", "&": "&​amp;" })[c] as string)}

`,
  )
  win.document.close()
  win.focus()
  win.print()
}
PASSO 7: COMPONENTE CARDÁPIO PRINCIPAL - INTERFACE EXATA
7.1 Criar arquivo Cardapio.tsx
Este é o componente principal do cardápio com interface EXATA do projeto.

7.1.1 Header com Botão Voltar
Container: min-h-screen bg-black
Title Bar: flex items-center justify-between px-4 py-3
Botão voltar: SVG com path d="M19 12H5M12 19l-7-7 7-7"
Cor do botão: text-white
7.1.2 Banner Superior EXATO
Container: relative
Cover Photo: h-64 w-full bg-cover bg-center bg-no-repeat
Background se não tiver foto: radial-gradient(ellipse at center top, #e8f4fc 0%, #87ceeb 30%, #4682b4 60%, #1e3a5f 100%)
Gradient Overlay: absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black
7.1.3 Nome da Loja EXATO
Posição: absolute top-4 left-0 right-0 px-4 text-center
Nome: text-4xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]
Slogan: mt-1 text-sm font-medium text-cyan-300
Texto do slogan: "Qual será o seu pedido?"
7.1.4 Robot Garçom Animado EXATO
Posição: absolute left-1/2 top-20 -translate-x-1/2 flex flex-col items-center animate-float
Animação float CSS:


css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
Animação eyeColorChange CSS:


css
@keyframes eyeColorChange {
  0%, 100% { fill: #00ffff; }
  25% { fill: #ff00ff; }
  50% { fill: #00ff00; }
  75% { fill: #ffff00; }
}
SVG viewBox="0 0 200 240"
Tamanho: size-40
Gradientes 3D: head3D, body3D, suitGradient, shirtGradient, trayGradient, glassGradient, waterGradient
Filtros: shadow3D, glow3D
Cabeça ellipse 3D com gradiente
Face display preto com borda azul
Olhos LED animados com classe animate-eye-color
Sorriso ciano com glow
Corpo com terno, colete, camisa, gravata
Braços com toalha e bandeja
Três copos de água
7.1.5 Botão da Cidadela (Lua Neon) EXATO
Posição: absolute right-4 top-16 z-50
Tamanho: size-20 (80px)
Container: flex flex-col items-center justify-center rounded-full border-2 border-cyan-400 bg-black/70 shadow-[0_0_30px_rgba(34,211,238,0.7)]
Pulse effect: absolute inset-0 animate-pulse rounded-full bg-cyan-400/60
Texto: text-[10px] font-bold text-cyan-300 tracking-tight leading-tight
Texto: "CONHEÇA A CIDADELA"
Ícone cadeado: size-7 text-yellow-400 mt-1
SVG cadeado: rect x="5" y="11" width="14" height="10" rx="2" e path d="M8 11V7a4 4 0 0 1 8 0v4"
Hover: hover:scale-105 active:scale-95
Ao clicar: navega para /cidadela
7.1.6 Navegação por Categorias EXATA
Container: sticky top-0 z-20 border-b border-red-500/20 bg-black/90 backdrop-blur
Flex container: flex gap-2 overflow-x-auto px-4 py-3
Botões de categoria:
shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold transition-all
Categoria ativa: bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500
Categoria inativa: bg-black/50 text-gray-400 hover:bg-red-500/10 border border-red-500/30
Ao clicar: seta activeCat e scroll suave para seção
7.1.7 Grid de Produtos EXATO
Container main: px-4 pb-24
Container centralizado: mx-auto max-w-xl
Seção: scroll-mt-20 pt-6
Título da categoria: mb-4 text-lg font-bold text-white
Cards de produto:
group relative flex items-center gap-4 rounded-xl border border-red-500/20 bg-black/40 p-4 transition-all hover:border-red-500/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]
Ponto vermelho pulsante no lugar da imagem:
size-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8),0_0_16px_rgba(239,68,68,0.6),0_0_24px_rgba(239,68,68,0.4)] animate-pulse
Nome: text-base font-bold text-white group-hover:text-red-400 transition-colors
Descrição: mt-1 text-xs text-gray-400 line-clamp-2
Preço: text-sm font-bold text-white
Botão ADD: flex items-center gap-1 rounded-lg border border-red-500/50 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]
Contador de quantidade: flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-500/30 p-1
Botão menos: grid size-6 place-items-center rounded-full bg-black/50 hover:bg-black/70
Botão mais: grid size-6 place-items-center rounded-full bg-red-600 hover:bg-red-500
7.1.8 Navegação Inferior EXATA
Container: fixed bottom-0 left-0 right-0 z-40 border-t border-red-500/20 bg-black/95 backdrop-blur
Flex container: flex items-center justify-around py-3
3 botões: CARDÁPIO, CIDADELA, PAINEL
CARDÁPIO ativo:
Ícone menu com pulse: absolute inset-0 rounded-full bg-red-500/20 animate-pulse
Ícone: size-6 text-red-500
Texto: text-[10px] font-semibold text-red-500
CIDADELA inativo:
Ícone usuário: size-6 text-gray-500
Texto: text-[10px] font-semibold text-gray-500
Hover: hover:text-gray-300
PAINEL inativo:
Ícone settings: size-6 text-gray-500
Texto: text-[10px] font-semibold text-gray-500
Hover: hover:text-gray-300
Footer com links:
Container: flex items-center justify-center gap-4 border-t border-red-500/10 pt-2 pb-3
Botão Privacidade: text-[9px] text-gray-500 hover:text-gray-300 transition-colors
Separador: text-[9px] text-gray-600
Botão Termos: text-[9px] text-gray-500 hover:text-gray-300 transition-colors
7.1.9 Carrinho Flutuante EXATO
Posição: fixed inset-x-4 bottom-20 z-30 mx-auto
Container: flex max-w-md items-center justify-between rounded-full bg-red-600 px-5 py-4 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]
Ícone ShoppingBag: size-4
Texto: text-sm font-semibold
Total: text-sm font-bold
Só aparece se count > 0 e cartOpen false e checkoutOpen false
7.1.10 Sistema de Descontos
Calcular discountPercentage baseado em state.admin.discountTiers
Calcular discountAmount = total * (discountPercentage / 100)
Calcular totalWithDiscount = total - discountAmount
7.1.11 Processamento do Pedido
Gerar comanda com newComanda()
Se PIX: Abrir PaymentScreen
Se dinheiro/cartão: Processar direto
Após pagamento:
Gerar código promocional com generatePromoCode()
Se total >= 200: accessType = "15_dias"
Se total < 200: accessType = "15_min"
Salvar código na tabela cidadela_codes
Salvar pedido na tabela orders
Salvar itens na tabela order_items
Calcular pontos: Math.floor(total / 30)
Salvar pontos na tabela soberania_points
Salvar transação na tabela soberania_transactions
Se pontos > 0: Abrir VideoBonusModal
Se pontos = 0: Abrir SuccessModal
Enviar webhook N8N com código da Cidadela
PASSO 8: COMPONENTE VÍDEO BÔNUS
8.1 Criar arquivo src/components/cardapio/VideoBonusModal.tsx
Modal com background preto e backdrop-blur
Título: "Assista ao vídeo para ganhar pontos extras!"
Descrição: "Você ganhou X pontos. Assista ao vídeo para dobrar seus pontos!"
Timer de 3 minutos
Botão "Pular vídeo": perde bônus, vai para SuccessModal
Botão "Assistir vídeo": ganha bônus, adiciona pontos, vai para SuccessModal
PASSO 9: COMPONENTE PAGAMENTO PIX
9.1 Criar arquivo PaymentScreen.tsx
Modal com background preto e backdrop-blur
Mostrar valor total
QR Code com API: https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encodeURIComponent(pixKey)}
Chave PIX com botão de copiar
Instruções em caixa azul
Botão "Já paguei" com loading de 3 segundos
Pagamentos não-PIX processam em 2 segundos
PASSO 10: COMPONENTE CARRINHO (CartSheet)
10.1 Criar arquivo src/components/cardapio/CartSheet.tsx
Modal com background preto e backdrop-blur
Lista de itens com nome, preço, quantidade
Botões +/-
Mostrar desconto se houver
Total com desconto
Botão "Finalizar pedido"
PASSO 11: COMPONENTE CHECKOUT (CheckoutModal)
11.1 Criar arquivo src/components/cardapio/CheckoutModal.tsx
Modal com background preto e backdrop-blur
Formulário:
Nome do cliente
Telefone
E-mail (opcional)
Endereço (se entrega)
Tipo de entrega (radio)
Observações (textarea)
Método de pagamento (radio)
Troco (se dinheiro)
Botão confirmar pedido
Validação de campos
PASSO 12: HOOK SUPABASE ADMIN
12.1 Criar arquivo admin.ts
Use EXATAMENTE os nomes das tabelas:

admin_trials
orders
order_items
cidadela_codes
soberania_points
soberania_transactions
Funções:

generateAdminCode(): gera código ADM-XXXXXX
createTrial(): salva código em store_id
validateAccessCode(): busca por admin_email
activateLiberationCode(): busca por store_id
loadAdminConfig(): carrega configurações
updateAdminConfig(): atualiza configurações
loadOrdersFromSupabase(): carrega pedidos
reloadTrial(): recarrega do localStorage
clearTrial(): limpa localStorage
PASSO 13: IMPRESSÃO DE COMANDAS
13.1 Função printTicket
Abre nova janela
Escreve HTML com pre tag
Fonte monospace
Chama window.print()
PASSO 14: INTEGRAÇÃO SUPABASE - TABELAS EXISTENTES
14.1 Tabela admin_trials
Campos EXATOS:

id (UUID, PK)
store_id (VARCHAR, UNIQUE) - Código ADM-XXXXXX
store_name (VARCHAR)
store_slogan (TEXT)
store_marquee (TEXT)
pix_key (VARCHAR)
whatsapp (VARCHAR)
admin_phone (VARCHAR)
admin_email (VARCHAR)
access_code (VARCHAR, opcional)
trial_started_at (TIMESTAMP)
trial_expires_at (TIMESTAMP)
is_active (BOOLEAN)
is_premium (BOOLEAN)
premium_expires_at (TIMESTAMP)
config_updated_at (TIMESTAMP)
created_at (TIMESTAMP)
14.2 Tabela orders
Campos EXATOS:

id (UUID, PK)
store_id (VARCHAR)
customer_name (VARCHAR)
customer_email (VARCHAR)
customer_phone (VARCHAR)
delivery_address (TEXT)
delivery_type (VARCHAR)
observations (TEXT)
subtotal (DECIMAL)
delivery_fee (DECIMAL)
total (DECIMAL)
payment_method (VARCHAR)
change_for (DECIMAL)
comanda (VARCHAR)
status (VARCHAR)
cidadela_code (VARCHAR)
cidadela_access_type (VARCHAR)
payment_status (VARCHAR)
payment_confirmed_at (TIMESTAMP)
payment_proof_url (TEXT)
payment_rejected_reason (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
14.3 Tabela order_items
Campos EXATOS:

id (UUID, PK)
order_id (UUID, FK)
product_id (VARCHAR)
product_name (VARCHAR)
quantity (INTEGER)
unit_price (DECIMAL)
total (DECIMAL)
created_at (TIMESTAMP)
14.4 Tabela cidadela_codes
Campos EXATOS:

id (UUID, PK)
code (VARCHAR)
store_id (VARCHAR)
customer_email (VARCHAR)
customer_phone (VARCHAR)
access_type (VARCHAR) - CHECK (access_type IN ('15_min', '15_dias'))
order_total (DECIMAL)
expires_at (TIMESTAMP)
is_active (BOOLEAN)
used_at (TIMESTAMP)
created_at (TIMESTAMP)
14.5 Tabela soberania_points
Campos EXATOS:

id (UUID, PK)
store_id (VARCHAR)
customer_email (VARCHAR)
customer_phone (VARCHAR)
points (INTEGER)
last_updated (TIMESTAMP)
created_at (TIMESTAMP)
14.6 Tabela soberania_transactions
Campos EXATOS:

id (UUID, PK)
store_id (VARCHAR)
customer_email (VARCHAR)
customer_phone (VARCHAR)
type (VARCHAR) - CHECK (type IN ('earned', 'lost', 'spent', 'rewarded'))
amount (INTEGER)
reason (TEXT)
source (VARCHAR) - CHECK (source IN ('game', 'order', 'ad', 'admin'))
timestamp (TIMESTAMP)
created_at (TIMESTAMP)
PASSO 15: WEBHOOK N8N
15.1 Enviar Pedido
Payload deve incluir:

Dados do pedido
Código da Cidadela
Tipo de acesso
Dados da loja
WhatsApp do admin
PASSO 16: INSTRUÇÕES FINAIS
Use EXATAMENTE os nomes das tabelas e colunas especificados
Não invente novos nomes
Siga cada passo em ordem
Teste cada funcionalidade
Use as palavras exatas descritas aqui
Não pule nenhum passo
Verifique se tudo está funcionando antes de entregar
Interface deve ser EXATAMENTE como descrita
Botão da Cidadela: size-20, border-cyan-400, shadow neon ciano, texto "CONHEÇA A CIDADELA"
Abas de categorias: sticky top-0, border-red-500/20, bg-black/90 backdrop-blur
Cards de produtos: border-red-500/20, bg-black/40, ponto vermelho pulsante
Navegação inferior: 3 botões (CARDÁPIO, CIDADELA, PAINEL), CARDÁPIO ativo em vermelho
Carrinho flutuante: bg-red-600, shadow neon vermelho, centralizado
Robot garçom: SVG completo com gradiente 3D, olhos animados, flutuação
CRÍTICO:

O código ADM deve ser salvo em store_id, não em access_code
O sistema de trial é de 2 minutos, não 2 dias
Use as tabelas existentes do Supabase com os nomes exatos
Interface deve ser EXATAMENTE como descrita neste prompt
Não invente cores, classes ou posições
Use EXATAMENTE as classes Tailwind especificadas*

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/68fdfd62-607c-4a3e-971f-191ca6657087).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
