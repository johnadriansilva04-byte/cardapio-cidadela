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

test("a home rola de propósito e nada que vende fica escondido", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // A página ROLA: as seções vivas (chat+IA e Variant) ficam visíveis, não
  // atrás de uma aba. Antes era um cockpit de uma tela só, e o que vendia o
  // produto ficava em abas que ninguém abria.
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollHeight - el.clientHeight;
  });
  expect(overflow).toBeGreaterThan(100);

  // O simulador fica na cara, sem clique — é o argumento da página.
  await expect(page.getByText("Simulador de economia")).toBeVisible();

  // O chat que monta a loja e o garçom digital são SEÇÕES, não abas.
  await expect(page.getByRole("heading", { name: /Você não preenche formulário/ })).toBeVisible();
  await expect(page.getByText("Suporte oficial", { exact: false }).first()).toBeVisible();

  // A identidade Variant também é uma seção visível.
  await expect(page.getByRole("heading", { name: /Variant existe por um motivo/ })).toBeVisible();
  await expect(page.getByText(/Reduzir a mortalidade das pequenas empresas/)).toBeVisible();
});

test("em tela média o cardápio aparece inteiro, sem corte", async ({ page }) => {
  // Regressão: com `hidden lg:block` a cena sumia abaixo de 1024px e, quando o
  // layout forçava tudo numa tela só, o painel do cardápio ficava espremido e
  // cortava os últimos itens. Agora, abaixo de `lg`, a página rola e o painel
  // cresce com o conteúdo — nada é escondido.
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Simulador de economia")).toBeVisible();

  // O painel do cardápio não tem mais rolagem interna própria: ele cresce com
  // o conteúdo e a página rola. (As abas e os chats têm scroll interno de
  // propósito; o que não pode é o PAINEL cortar o cardápio.)
  const cortado = await page.evaluate(() => {
    const painel = document
      .querySelector("main")!
      .querySelector("div.flex-col.rounded-3xl") as HTMLElement | null;
    if (!painel) return true;
    return painel.scrollHeight > painel.clientHeight + 2;
  });
  expect(cortado).toBe(false);

  // E o cardápio real continua acessível, sem corte, no fim do painel.
  await expect(page.getByRole("link", { name: /Abrir o cardápio real/i })).toBeVisible();
});

test("calculadora de economia mostra o número e abre no painel", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // O simulador aparece no herói, sem clique: o número é o argumento da página.
  await expect(page.getByText("Simulador de economia")).toBeVisible();
  const cta = page.getByRole("button", { name: /é o seu plano/ });
  await expect(cta).toBeVisible();
  await cta.click();

  // O painel abre por cima com a pergunta, o resultado já calculado e o X.
  await expect(
    page.getByRole("heading", { name: /Quer ver quanto de dinheiro você está perdendo/ }),
  ).toBeVisible();
  await expect(page.getByText("Você economiza", { exact: true })).toBeVisible();

  // O dono ajusta o que paga hoje e o número acompanha na hora.
  await page.getByLabel("Quanto você paga por mês no seu cardápio atual").fill("200");
  await expect(page.getByText("Você paga hoje", { exact: true })).toBeVisible();
  await expect(page.getByText("Melhor plano pra você", { exact: true })).toBeVisible();
  await expect(page.getByText(/\/ano/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Comece grátis/ })).toHaveAttribute(
    "href",
    "/login?mode=register",
  );

  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByText("Você economiza", { exact: true })).toHaveCount(0);
});

test("as abas trocam o painel na hora, sem rolar a página", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Cardápio (aba inicial): nada de mockup na página. O botão aponta direto
  // para o cardápio REAL (mesma URL que o cliente da loja abre), em outra aba.
  const reveal = page.getByRole("link", { name: /Abrir o cardápio real/i });
  await expect(reveal).toBeVisible();
  await expect(reveal).toHaveAttribute("href", /\/cardapio\/dona-da-pensao$/);
  await expect(reveal).toHaveAttribute("target", "_blank");
  // O cardápio não é renderizado dentro da landing — só o link.
  await expect(page.getByText("Enviar pedido")).toHaveCount(0);

  // Templates: escolher um tema troca o preview.
  await page.getByRole("button", { name: "Templates" }).click();
  await expect(page.getByText("Hamburgueria").first()).toBeVisible();
  await page.getByRole("button", { name: /Pizzaria/ }).click();
  await expect(page.getByText("Margherita").first()).toBeVisible();
  await expect(page.getByText(/Usar o tema Pizzaria/)).toBeVisible();
});

test("o chat de montagem e o garçom digital ficam visíveis, sem clique", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Seção "Monte a loja conversando": o wizard animado roda sozinho.
  const chat = page.locator("#chat");
  await chat.scrollIntoViewIfNeeded();
  await expect(chat.getByRole("heading", { name: /numa conversa/i })).toBeVisible();
  await expect(chat.getByText("Monte seu cardápio")).toBeVisible();

  // O garçom digital responde — sem precisar abrir aba nenhuma.
  await page.getByRole("button", { name: /Meus pedidos não estão chegando/ }).click();
  await expect(page.getByText(/Vou verificar o alerta/i)).toBeVisible();
});

test("os atalhos do topo abrem cada assunto em painel por cima", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Preços", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Escolha como pagar/ })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // "Quem faz" rola até a seção visível (não abre mais painel por cima).
  await page.getByRole("button", { name: "Quem faz", exact: true }).click();
  await expect(page.locator("#variant")).toBeInViewport();

  await expect(page.getByText("Você economiza", { exact: true })).toHaveCount(0);
});
