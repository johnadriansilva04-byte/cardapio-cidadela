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

test("calculadora de economia mostra o número e abre no painel", async ({ page }) => {
  await page.goto("/");
  // Espera a hidratação: sem isso o primeiro clique pode cair antes do handler.
  await page.waitForLoadState("networkidle");

  // O número aparece na tela principal, sem clique: é o argumento da página.
  await expect(page.getByText(/Quanto você está perdendo\? Ex\.: pagando/)).toBeVisible();
  await expect(page.getByText(/no seu bolso/)).toBeVisible();

  await page.getByRole("button", { name: /Fazer a conta/ }).click();

  // O painel abre por cima com a pergunta, o resultado já calculado e o X.
  await expect(
    page.getByRole("heading", { name: /Quer ver quanto de dinheiro você está perdendo/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar" })).toBeVisible();
  await expect(page.getByText("Você economiza", { exact: true })).toBeVisible();

  // O dono ajusta o que paga hoje e o número acompanha na hora.
  await page.getByLabel(/Quanto você paga por mês/).fill("200");
  await expect(page.getByText("Você paga hoje", { exact: true })).toBeVisible();
  await expect(page.getByText("Melhor plano pra você", { exact: true })).toBeVisible();
  // A economia no ano é sempre positiva para um gasto acima do plano.
  await expect(page.getByText(/\/ano/).first()).toBeVisible();
  // CTA de conversão.
  await expect(page.getByRole("link", { name: /Comece grátis/ })).toHaveAttribute(
    "href",
    "/login?mode=register",
  );

  // O X fecha o painel e volta ao hub.
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByText("Você economiza", { exact: true })).toHaveCount(0);
});

test("landing é viva: cardápio dentro do botão, chat do garçom e criação por conversa", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // As seções vivas estão na página (rolam com o visitante).
  await expect(page.getByText(/numa conversa/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /sai do salão/i })).toBeVisible();

  // O cardápio NÃO fica solto na página: ele mora dentro do botão-convite.
  const reveal = page.getByRole("button", { name: /Ver cardápio real/i });
  await expect(reveal).toBeVisible();
  await expect(page.getByText("Enviar pedido")).toHaveCount(0);

  // Ao tocar, o botão se abre e vira o cardápio interativo.
  await reveal.click();
  await expect(page.getByText(/Cardápio ao vivo/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar pedido" })).toBeVisible();

  // E fecha de novo.
  await page
    .getByRole("button", { name: /Fechar/i })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Enviar pedido" })).toHaveCount(0);

  // O garçom virtual responde sozinho: a pergunta aparece e a resposta chega.
  await expect(page.getByText(/Suporte oficial/i)).toBeVisible();
  await page.getByRole("button", { name: /Meus pedidos não estão chegando/ }).click();
  await expect(page.getByText(/Vou verificar o alerta/i)).toBeVisible();
});

test("os atalhos abrem cada assunto em painel por cima", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /Pracinha/ }).click();
  await expect(page.getByRole("heading", { name: /Conheça o Pracinha/ })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  await page
    .getByRole("button", { name: /Preços/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /Escolha como pagar/ })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  await expect(page.getByText("Você economiza", { exact: true })).toHaveCount(0);
});

test("templates prontos: escolher um tema troca o preview na hora", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // A seção aparece na página, com o primeiro tema ativo.
  await expect(page.getByText(/Não comece do zero/i)).toBeVisible();
  await expect(page.getByText("Hamburgueria").first()).toBeVisible();
  await expect(page.getByText("X-Burger").first()).toBeVisible();

  // Trocar de tema troca os itens do preview.
  await page.getByRole("button", { name: /Pizzaria/ }).click();
  await expect(page.getByText("Margherita").first()).toBeVisible();
  await expect(page.getByText(/Usar o tema Pizzaria/)).toBeVisible();
});

test("landing mostra a missão da Variant", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Quem faz", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Variant existe por um motivo/ })).toBeVisible();
  await expect(page.getByText(/Reduzir a mortalidade das pequenas empresas/)).toBeVisible();
});
