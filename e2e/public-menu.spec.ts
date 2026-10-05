import { test, expect, type Page } from "@playwright/test";

/**
 * E2E do cardápio público: carregamento, carrinho, checkout e criação de pedido.
 * O backend é o stub em memória (ver playwright.config.ts), então as asserções
 * verificam o que o cliente realmente grava.
 */

const SLUG = "cidadela-teste";

type DbShape = {
  orders: Record<string, unknown>[];
  order_items: Record<string, unknown>[];
  order_status_history: Record<string, unknown>[];
  restaurants?: Record<string, unknown>[];
  products?: Record<string, unknown>[];
  order_tracking?: Record<string, unknown>[];
  failRpc?: string[];
  serverAvailability?: Record<string, boolean>;
};

/** Injeta um dataset parcial antes do stub criar o banco (addInitScript). */
async function seed(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.addInitScript((p) => {
    (window as unknown as { __E2E_SEED__?: Record<string, unknown> }).__E2E_SEED__ = p;
  }, patch);
}

async function readDb(page: Page, table: keyof DbShape): Promise<unknown[]> {
  return page.evaluate((t) => {
    const db = (window as unknown as { __E2E_DB__?: Record<string, unknown[]> }).__E2E_DB__;
    return (db?.[t] as unknown[]) ?? [];
  }, table);
}

async function resetOrders(page: Page): Promise<void> {
  await page.evaluate(() => {
    const db = (window as unknown as { __E2E_DB__?: DbShape }).__E2E_DB__;
    if (!db) return;
    db.orders = [];
    db.order_items = [];
    db.order_status_history = [];
  });
}

/** Preenche o passo 1 do checkout e avança até o passo 3. */
async function fillCheckout(page: Page, opts?: { delivery?: boolean }): Promise<void> {
  await page.locator("#co-name").fill("Fulano de Tal");
  await page.locator("#co-phone").fill("11999998888");
  await page.getByRole("button", { name: /Continuar/ }).click();

  if (opts?.delivery) {
    await page.getByRole("button", { name: /Entrega/ }).click();
    await page.locator("#co-address").fill("Rua Teste, 100");
    await page.locator("#co-neighborhood").selectOption("Centro");
  }
  await page.getByRole("button", { name: /Continuar/ }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test("carrega o cardápio com produtos e categorias", async ({ page }) => {
  await page.goto(`/cardapio/${SLUG}`);
  await expect(page.getByText("Cidadela Teste").first()).toBeVisible();
  await expect(page.getByText("X-Burger").first()).toBeVisible();
  await expect(page.getByText("Refrigerante").first()).toBeVisible();
});

test("oculta da lista os produtos indisponíveis", async ({ page }) => {
  await page.goto(`/cardapio/${SLUG}`);
  await expect(page.getByText("X-Burger").first()).toBeVisible();
  // A lista pública só mostra itens disponíveis (sem "Esgotado" e sem botão).
  await expect(page.getByText("Esgotado")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Adicionar Esgotado/ })).toHaveCount(0);
});

test("adiciona item ao carrinho e abre o checkout", async ({ page }) => {
  await page.goto(`/cardapio/${SLUG}`);
  await page
    .getByRole("button", { name: /Adicionar X-Burger/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByRole("heading", { name: "Finalizar pedido" })).toBeVisible();
  await expect(page.locator("#co-name")).toBeVisible();
});

test("cria pedido com os itens e o preço corretos", async ({ page }) => {
  await page.goto(`/cardapio/${SLUG}`);
  await resetOrders(page);

  await page
    .getByRole("button", { name: /Adicionar X-Burger/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await fillCheckout(page);
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();

  await expect
    .poll(async () => (await readDb(page, "orders")).length, { timeout: 10_000 })
    .toBeGreaterThan(0);

  const orders = (await readDb(page, "orders")) as Record<string, unknown>[];
  expect(orders).toHaveLength(1);
  // O preço é recalculado a partir do banco; o cliente não dita o valor.
  expect(Number(orders[0].subtotal)).toBeCloseTo(18.5, 2);
  expect(orders[0].status).toBe("received");
  expect(orders[0].delivery_type).toBe("retirada");

  const items = (await readDb(page, "order_items")) as Record<string, unknown>[];
  expect(items).toHaveLength(1);
  expect(items[0].product_name).toBe("X-Burger");
  expect(Number(items[0].unit_price)).toBeCloseTo(18.5, 2);

  const history = (await readDb(page, "order_status_history")) as Record<string, unknown>[];
  expect(history.some((h) => h.status === "received")).toBe(true);
});

test("ignora o preço forjado pelo cliente e usa o do servidor", async ({ page }) => {
  await page.goto(`/cardapio/${SLUG}`);
  // Espera o cardápio carregar: só então o stub (e o __E2E_CLIENT__) existe.
  await expect(page.getByText("X-Burger").first()).toBeVisible();
  await resetOrders(page);

  // Chama a RPC como faria um anon malicioso: informa R$ 0,01 no item e no
  // corpo. O banco (stub espelha a RPC) recalcula a partir de `products`.
  const result = await page.evaluate(async () => {
    const client = (
      window as unknown as {
        __E2E_CLIENT__?: {
          rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
        };
      }
    ).__E2E_CLIENT__;
    return client!.rpc("create_order_atomic", {
      p_restaurant_id: "11111111-1111-1111-1111-111111111111",
      p_order: {
        comanda: "#forjado",
        customer_phone: "11999998888",
        delivery_type: "retirada",
        payment_method: "dinheiro",
        subtotal: 0.01,
        total: 0.01,
      },
      p_items: [
        {
          product_id: "prod-1",
          quantity: 1,
          unit_price: 0.01,
          total: 0.01,
          notes: "",
          addon_ids: [],
        },
      ],
    });
  });

  const order = (result as { data: { order: Record<string, unknown> } }).data.order;
  // O preço do banco (R$ 18,50) prevalece sobre o R$ 0,01 enviado.
  expect(Number(order.subtotal)).toBeCloseTo(18.5, 2);
  expect(Number(order.total)).toBeCloseTo(18.5, 2);
});

test("aplica a taxa de entrega do bairro quando é entrega", async ({ page }) => {
  await page.goto(`/cardapio/${SLUG}`);
  await resetOrders(page);

  await page
    .getByRole("button", { name: /Adicionar X-Burger/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await fillCheckout(page, { delivery: true });
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();

  await expect
    .poll(async () => (await readDb(page, "orders")).length, { timeout: 10_000 })
    .toBeGreaterThan(0);
  const orders = (await readDb(page, "orders")) as Record<string, unknown>[];
  expect(orders[0].delivery_type).toBe("entrega");
  expect(Number(orders[0].delivery_fee)).toBeCloseTo(5, 2);
  expect(Number(orders[0].total)).toBeCloseTo(23.5, 2);
});

test("não cria pedido quando o item está indisponível no servidor", async ({ page }) => {
  await page.goto(`/cardapio/${SLUG}`);
  await expect(page.getByText("X-Burger").first()).toBeVisible();
  await resetOrders(page);

  // O item já está na tela; o servidor passa a considerá-lo indisponível no
  // momento do pedido. O stub lê este mapa a cada consulta, então não há corrida.
  await page.evaluate(() => {
    const db = (window as unknown as { __E2E_DB__?: DbShape }).__E2E_DB__;
    if (db) db.serverAvailability = { "prod-1": false };
  });

  await page
    .getByRole("button", { name: /Adicionar X-Burger/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await fillCheckout(page);
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();

  await expect(page.getByText(/indisponível/i).first()).toBeVisible({ timeout: 10_000 });
  expect(await readDb(page, "orders")).toHaveLength(0);
});

test("bloqueia o pedido quando a loja está fechada", async ({ page }) => {
  // Fecha todos os dias no stub — a tela deve impedir a confirmação.
  const closed = {
    seg: { closed: true, open: "00:00", close: "00:00" },
    ter: { closed: true, open: "00:00", close: "00:00" },
    qua: { closed: true, open: "00:00", close: "00:00" },
    qui: { closed: true, open: "00:00", close: "00:00" },
    sex: { closed: true, open: "00:00", close: "00:00" },
    sab: { closed: true, open: "00:00", close: "00:00" },
    dom: { closed: true, open: "00:00", close: "00:00" },
  };
  await seed(page, {
    restaurants: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        owner_id: "owner-1",
        slug: SLUG,
        name: "Cidadela Teste",
        description: "Comida de verdade",
        status: "published",
        delivery_fee: 5,
        operating_hours: closed,
      },
    ],
  });
  await page.goto(`/cardapio/${SLUG}`);
  await resetOrders(page);
  await expect(page.getByText(/fechado/i).first()).toBeVisible();
  // Sem botão de adicionar quando fechado.
  await expect(page.getByRole("button", { name: /Adicionar X-Burger/ })).toHaveCount(0);
  expect(await readDb(page, "orders")).toHaveLength(0);
});

test("abre a página pública de acompanhamento de um pedido", async ({ page }) => {
  const orderId = "22222222-2222-2222-2222-222222222222";
  await page.addInitScript((id) => {
    (window as unknown as { __E2E_DB__: DbShape }).__E2E_DB__ = {
      orders: [],
      order_items: [],
      order_status_history: [],
      order_tracking: [
        {
          id,
          restaurant_id: "11111111-1111-1111-1111-111111111111",
          comanda: "ABC123",
          status: "preparing",
          total: 23.5,
          observations: "",
          created_at: new Date().toISOString(),
        },
      ],
    };
  }, orderId);

  await page.goto(`/pedido/${orderId}`);
  await expect(page.getByText(/ABC123/).first()).toBeVisible();
});
