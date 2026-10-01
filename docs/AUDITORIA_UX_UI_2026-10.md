# Auditoria UX/UI — apresentação e fluxo (out/2026)

Escopo: **camada de apresentação**. Nenhuma mudança em banco, tabelas, rotas,
APIs, permissões, fluxos ou regras de negócio. Tudo o que está abaixo altera
apenas hierarquia visual, espaçamento, estados e leitura.

## Mobile (prioridade)

1. **Cabeçalho repetido em cada aba.**
   - Motivo: cada rota montava o próprio `<h1>` + subtítulo com espaçamentos
     diferentes.
   - Impacto: a navegação parecia quatro aplicativos distintos; sem referência
     fixa de "onde estou" nem do estado da loja.
   - Solução: `PageHeader` único (título, contexto, ações na mesma linha de
     base) e cabeçalho de app com nome da loja + selo aberto/fechado
     (`StoreStatusBadge`).
   - Futuro: transformar o cabeçalho em barra fixa com busca global.

2. **Consultas duplicadas ao trocar de aba.**
   - Motivo: `mobile.index`, `clientes`, `dashboard` e `config` chamavam
     `useOwnerOrders` individualmente.
   - Impacto: recarregar a mesma lista a cada troca de aba e possível piscar de
     conteúdo.
   - Solução: `MobileStoreProvider` faz uma única carga (restaurantes, pedidos,
     realtime) e as abas consomem `useMobileStore()`.
   - Futuro: cache com `staleTime` para navegação instantânea.

3. **Dois banners empilhados no topo dos Pedidos.**
   - Motivo: `PushBanner` e `InstallCard` apareciam separados, cada um pedindo
     uma ação.
   - Impacto: os primeiros pedidos ficavam abaixo de dois avisos.
   - Solução: `AlertsBanner` une push + instalação em uma linha, com um toque
     resolve e os detalhes sob demanda; desaparece quando já está tudo ativo.
   - Futuro: checklist único de preparo no primeiro acesso.

4. **Gutter duplicado no celular.**
   - Motivo: `AppLayout` já aplica `p-4` e as rotas mobile repetiam `p-4`.
   - Impacto: conteúdo espremido, com 32px de margem em telas estreitas.
   - Solução: as rotas mobile usam só `space-y-*`; o padding fica no layout.
   - Futuro: padronizar o mesmo contrato nas rotas admin.

5. **Aba ativa sem sinal na barra inferior.**
   - Motivo: a barra só mudava a cor do texto.
   - Impacto: difícil saber em que aba se está, sobretudo com o badge de
     pedidos competindo por atenção.
   - Solução: indicador superior na aba ativa + `aria-current`.
   - Futuro: transição compartilhada entre abas.

6. **Painel com resumo fragmentado.**
   - Motivo: "Hoje" e "Ticket médio" em um cartão, o total de 7 dias só dentro
     de uma seção recolhida.
   - Impacto: obrigava a abrir a seção para o número principal do período.
   - Solução: três métricas lado a lado (Hoje, 7 dias, Ticket) e o dia atual
     destacado no gráfico.
   - Futuro: comparativo com o período anterior.

7. **Barras de status proporcionais ao histórico.**
   - Motivo: a largura usava o total de todos os pedidos.
   - Impacto: com muito histórico, todas as barras ficavam rentes ao zero.
   - Solução: escala pelo maior grupo, deixando a comparação imediata.
   - Futuro: filtro de período no painel.

## Admin

8. **Cabeçalhos com três tamanhos diferentes** (`text-lg`, `text-2xl`,
   `font-bold` vs `font-black`).
   - Solução: `PageHeader` em Dashboard, Pedidos, Restaurantes, Financeiro,
     Configurações e Compartilhar.
   - Futuro: tokens de tipografia.

9. **Estados vazios, de carregamento e de erro recriados em cada tela.**
   - Motivo: spinners com alturas e margens próprias; erros com "!" ou ícone
     avulso.
   - Impacto: a mesma situação parecia diferente dependendo da página.
   - Solução: `LoadingState`, `EmptyState` e `InlineError` compartilhados,
     com ação de saída (criar restaurante, limpar busca, tentar de novo).
   - Futuro: estado vazio com ilustração por contexto.

10. **Números estáticos nos KPIs.**
    - Motivo: os valores apareciam prontos.
    - Solução: contagem animada reutilizável (`useCountUp`) no `StatTile` e no
      `KpiCard`, respeitando `prefers-reduced-motion`.
    - Futuro: destaque de variação (alta/queda) no próprio número.

## Configurações (conta) vs. dados da loja

11. **Tela de Configurações com tudo aberto.**
    - Motivo: dados da conta, senha, ações, instalação e um aviso repetido
      apareciam todos abertos ao mesmo tempo.
    - Impacto: a tela virava uma parede de formulários; o usuário perdia o
      que era conta e o que era loja.
    - Solução: tudo em módulos expansíveis recolhidos (`ExpandableSection`),
      com prévia curta no cabeçalho. Removido o banner redundante (o atalho
      "Restaurantes" já leva aos dados da loja) e o texto passou a dizer
      explicitamente que dados da loja ficam em Restaurantes → Config.
    - O atalho "Editar dados e senha" da gestão mobile (`#conta`) abre os
      módulos de conta por padrão.

## Verificação

- `npx tsc --noEmit`, `npx vitest run` (147 testes), `npm run build` e
  `npx eslint` nos arquivos tocados.
- Rotas `/`, `/login`, `/privacy`, `/mobile`, `/admin`, `/admin/pedidos` e
  `/admin/restaurantes` respondem 200 no servidor de desenvolvimento.
