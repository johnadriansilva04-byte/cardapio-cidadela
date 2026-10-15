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
