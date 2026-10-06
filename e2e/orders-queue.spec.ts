import { test, expect, type Page } from "@playwright/test";

/**
 * E2E da fila de pedidos com volume alto.
 *
 * Prova que 40 pedidos NÃO esticam a tela: a lista mostra só os primeiros e
 * resume o resto em "Ver mais". O backend é o stub em memória (E2E=1), com
 * sessão injetada via `__E2E_SESSION__` para exercitar as telas autenticadas.
 */

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "owner-1";
const TOTAL = 40;

function makeOrder(index: number) {
  const n = String(index).padStart(2, "0");
  // Mais antigo primeiro quando a lista ordena por created_at desc.
  const createdAt = new Date(Date.now() - (TOTAL - index) * 60_000).toISOString();
  return {
    id: `order-${n}`,
    restaurant_id: RESTAURANT_ID,
    idempotency_key: `idem-${n}`,
    comanda: `PED-${n}`,
    customer_id: null,
    guest_id: null,
    customer_name: `Cliente ${n}`,
    customer_phone: `1199999${n}${n}`,
    customer_email: "",
    delivery_address: "",
    customer_complement: "",
    customer_neighborhood: "",
    customer_city: "",
    delivery_type: "retirada",
    observations: "",
    subtotal: 18.5,
    delivery_fee: 0,
    total: 18.5,
    payment_method: "pix",
    payment_status: "pending",
    status: "received",
    cidadela_unlocked: false,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

/** Injeta a sessão logada (o stub passa a devolvê-la em getSession/getUser). */
async function loginAsOwner(page: Page): Promise<void> {
  await page.addInitScript(
    ({ id }) => {
      (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
        user: {
          id,
          email: "dono@menufacil.local",
          user_metadata: { name: "Dono Teste" },
        },
      };
    },
    { id: OWNER_ID },
  );
}

/** Semeia 40 pedidos ativos do dono antes do stub criar o banco. */
async function seedManyOrders(page: Page): Promise<void> {
  const orders = Array.from({ length: TOTAL }, (_, i) => makeOrder(i + 1));
  await page.addInitScript((rows) => {
    (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = { orders: rows };
  }, orders);
}

/** Quantos cards de pedido estão realmente montados no DOM. */
function cardCount(page: Page) {
  return page.getByText(/^PED-\d{2}$/).count();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test("mobile: 40 pedidos aparecem como 2 + 'Ver mais', sem esticar a tela", async ({ page }) => {
  await loginAsOwner(page);
  await seedManyOrders(page);

  await page.goto("/mobile");
  await expect(page.getByText("PED-40")).toBeVisible();

  // Só 2 cards montados, mesmo com 40 pedidos na fila.
  await expect.poll(() => cardCount(page)).toBe(2);
  await expect(page.getByRole("button", { name: /Ver mais 8 pedidos/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ver mais 8 pedidos/ })).toContainText("+38");
  await expect(page.getByText("PED-38")).toHaveCount(0);

  // Um toque libera o próximo lote (8), não os 40 de uma vez.
  await page.getByRole("button", { name: /Ver mais 8 pedidos/ }).click();
  await expect.poll(() => cardCount(page)).toBe(10);
  await expect(page.getByText("PED-31")).toBeVisible();
  await expect(page.getByText("PED-30")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ver mais 8 pedidos/ })).toContainText("+30");

  // "Mostrar menos" volta ao resumo.
  await page.getByRole("button", { name: /Mostrar menos/ }).click();
  await expect.poll(() => cardCount(page)).toBe(2);
});

test("admin: a coluna do Kanban também resume o volume", async ({ page }) => {
  await loginAsOwner(page);
  await seedManyOrders(page);

  await page.goto("/admin/pedidos");
  await expect(page.getByText("PED-40")).toBeVisible();

  // A coluna "Recebidos" tem 40, mas monta só 2 cards + resumo.
  await expect.poll(() => cardCount(page)).toBe(2);
  await expect(page.getByRole("button", { name: /Ver mais 8 pedidos/ })).toBeVisible();

  await page.getByRole("button", { name: /Ver mais 8 pedidos/ }).click();
  await expect.poll(() => cardCount(page)).toBe(10);
});

test("criar pedidos reais pelo cardápio continua funcionando", async ({ page }) => {
  // Fluxo público ponta a ponta (mesma prova do spec do cardápio), para
  // garantir que a mudança de apresentação não quebrou a criação de pedido.
  await page.goto("/cardapio/cidadela-teste");
  await page
    .getByRole("button", { name: /Adicionar X-Burger/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.locator("#co-name").fill("Fulano de Tal");
  await page.locator("#co-phone").fill("11999998888");
  await page.getByRole("button", { name: /Continuar/ }).click();
  // Passo de entrega/retirada: sem escolher, o "Confirmar" não aparece.
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const db = (window as unknown as { __E2E_DB__?: { orders?: unknown[] } }).__E2E_DB__;
          return db?.orders?.length ?? 0;
        }),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0);
});
