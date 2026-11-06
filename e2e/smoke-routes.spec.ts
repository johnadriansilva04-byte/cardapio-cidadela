import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke de todas as rotas: cada tela precisa renderizar sem cair no boundary de
 * erro. É a rede de segurança para inauguração — pega crash de render, import
 * quebrado, RPC/consulta que estoura e "undefined" formatado (ex.: brl()), que
 * em tela cheia vira "Algo deu errado".
 *
 * Não valida regra de negócio (isso é o premium-flow / public-menu); valida que
 * a página abre. O boundary do root mostra "Não foi possível carregar a página".
 */

const OWNER_ID = "owner-1";
const ORDER_ID = "order-01";

const CRASH = /Não foi possível carregar a página|Algo deu errado/i;

async function asOwner(page: Page): Promise<void> {
  await page.addInitScript(
    ({ id }) => {
      (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
        user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
      };
    },
    { id: OWNER_ID },
  );
}

/** Semeia um pedido do dono (com itens) para as telas de pedido não ficarem vazias. */
async function seedOneOrder(page: Page): Promise<void> {
  await page.addInitScript(
    ({ rest, oid }) => {
      const now = new Date().toISOString();
      (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = {
        orders: [
          {
            id: oid,
            restaurant_id: rest,
            idempotency_key: "idem-smoke",
            comanda: "#smoke",
            customer_id: null,
            guest_id: null,
            customer_name: "Cliente Smoke",
            customer_phone: "11999990000",
            customer_email: "",
            delivery_address: "Rua Teste, 1",
            customer_complement: "",
            customer_neighborhood: "Centro",
            customer_city: "Cidade",
            delivery_type: "entrega",
            observations: "",
            subtotal: 18.5,
            delivery_fee: 5,
            total: 23.5,
            payment_method: "pix",
            payment_status: "pending",
            status: "received",
            cidadela_unlocked: false,
            created_at: now,
            updated_at: now,
          },
        ],
        order_items: [
          {
            id: "item-smoke",
            order_id: oid,
            product_id: "prod-1",
            product_name: "X-Burger Especial",
            quantity: 1,
            unit_price: 18.5,
            total: 18.5,
            notes: "",
            created_at: now,
          },
        ],
      };
    },
    { rest: "11111111-1111-1111-1111-111111111111", oid: ORDER_ID },
  );
}

const PUBLIC_ROUTES = ["/", "/login", "/terms", "/privacy", "/cardapio/cidadela-teste"];

const OWNER_ROUTES = [
  "/admin",
  "/admin/pedidos",
  "/admin/cardapio",
  "/admin/restaurantes",
  "/admin/financeiro",
  "/admin/compartilhar",
  "/admin/config",
  "/admin/assinatura",
  "/mobile",
  "/mobile/clientes",
  "/mobile/dashboard",
  "/mobile/config",
];

for (const route of PUBLIC_ROUTES) {
  test(`smoke público ${route}`, async ({ page }) => {
    await seedOneOrder(page);
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText(CRASH);
    await page.waitForTimeout(600);
    await expect(page.locator("body")).not.toContainText(CRASH);
  });
}

for (const route of OWNER_ROUTES) {
  test(`smoke dono ${route}`, async ({ page }) => {
    await asOwner(page);
    await seedOneOrder(page);
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText(CRASH);
    await page.waitForTimeout(600);
    await expect(page.locator("body")).not.toContainText(CRASH);
  });
}

test("smoke acompanhamento de pedido", async ({ page }) => {
  await seedOneOrder(page);
  await page.goto(`/pedido/${ORDER_ID}`);
  await expect(page.locator("body")).not.toContainText(CRASH);
  await page.waitForTimeout(600);
  await expect(page.locator("body")).not.toContainText(CRASH);
});

// O CNPJ do fornecedor precisa aparecer nas páginas legais e no rodapé da
// landing — é o que identifica quem vende o SaaS para o cliente.
for (const route of ["/", "/terms", "/privacy"]) {
  test(`CNPJ visível em ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("body")).toContainText("65.025.130/0001-24");
  });
}

test("a home é um bloco único: a página não rola", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // O cockpit cabe na viewport: herói, outdoor e botões de ação ficam visíveis
  // de uma vez. O único scroll é o de DENTRO dos painéis; o documento em si não
  // cresce — se crescer, o visitante perde o botão de ação rolando a tela.
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollHeight - el.clientHeight;
  });
  expect(overflow).toBeLessThanOrEqual(4);
});

test("o outdoor mostra o Pracinha atendendo ao vivo", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // A tela do outdoor tem cabeçalho e selo "ao vivo" fixos...
  await expect(page.getByText("Pracinha - Assistente IA")).toBeVisible();
  await expect(page.getByText(/ao vivo/i)).toBeVisible();

  // ...e a legenda troca de cena sozinha (mortalidade, montagem, pedido,
  // preços). A primeira cena é a dor que abre a página.
  await expect(page.getByText(/Comissão de 23-30% quebra pequenos negócios/)).toBeVisible();
});

test("a calculadora de economia abre no painel e calcula", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // O simulador vive no herói e abre o painel por cima — a página de fundo não
  // cresce.
  await page.getByRole("button", { name: /Calcular minha economia/ }).click();

  await expect(
    page.getByRole("heading", { name: /Quer ver quanto de dinheiro você está perdendo/ }),
  ).toBeVisible();
  await expect(page.getByText("Você economiza", { exact: true })).toBeVisible();

  // O dono ajusta o que paga hoje e o número acompanha na hora.
  await page.getByLabel("Quanto você paga por mês no seu cardápio atual").fill("200");
  await expect(page.getByText("Você paga hoje", { exact: true })).toBeVisible();
  await expect(page.getByText("Melhor plano pra você", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Comece grátis/ })).toHaveAttribute(
    "href",
    "/login?mode=register",
  );

  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByText("Você economiza", { exact: true })).toHaveCount(0);
});

test("os atalhos do topo abrem cada assunto em painel por cima", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Cardápio: o cardápio REAL, interativo, dentro do painel (sem mockup solto).
  await page.getByRole("button", { name: "Cardápio", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Cardápio real/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Abrir o cardápio real/i })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // Templates: escolher um tema troca o preview.
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(page.getByText("Hamburgueria").first()).toBeVisible();
  await page.getByRole("button", { name: /Pizzaria/ }).click();
  await expect(page.getByText("Margherita").first()).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // Preços: planos e diária.
  await page.getByRole("button", { name: "Preços", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Escolha como pagar/ })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // Recursos: passos + wizard de montagem + garçom digital, tudo no painel.
  await page.getByRole("button", { name: "Recursos", exact: true }).click();
  await expect(page.getByText("Monte o cardápio")).toBeVisible();
  await expect(page.getByText("Garçom Digital").first()).toBeVisible();
  await expect(page.getByText("Monte conversando").first()).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // Quem faz: a identidade da Variant, agora acessível.
  await page.getByRole("button", { name: "Quem faz", exact: true }).click();
  await expect(page.getByRole("heading", { name: /existe por um motivo/ })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // Dúvidas: perguntas frequentes.
  await page.getByRole("button", { name: "Dúvidas", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Perguntas frequentes/ })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  await expect(page.getByText("Você economiza", { exact: true })).toHaveCount(0);
});

test("o botão Ver cardápio abre o cardápio real da loja", async ({ page }) => {
  // Sem mockup na landing: o botão abre o cardápio de VERDADE, na mesma URL que
  // o cliente da loja usa. Gravamos a chamada de window.open em vez de abrir a
  // aba (o destino é o domínio canônico, fora do dev server).
  await page.addInitScript(() => {
    (window as unknown as { __OPENED__: string[] }).__OPENED__ = [];
    window.open = ((url?: string | URL) => {
      (window as unknown as { __OPENED__: string[] }).__OPENED__.push(String(url));
      return null;
    }) as typeof window.open;
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Cardápio real funcionando")).toBeVisible();
  await expect(page.getByText("Enviar pedido")).toHaveCount(0);
  await page.getByRole("button", { name: /Ver cardápio/ }).click();

  const opened = await page.evaluate(
    () => (window as unknown as { __OPENED__: string[] }).__OPENED__,
  );
  expect(opened.some((u) => /\/cardapio\/dona-da-pensao$/.test(u))).toBe(true);
});
