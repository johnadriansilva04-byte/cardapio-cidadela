import { test, expect, type Page } from "@playwright/test";

/**
 * E2E do plano Premium (fluxo do dinheiro, sem backend real).
 *
 * O stub em memória implementa as RPCs de assinatura (`get_order_for_owner`,
 * `owner_locked_stores`) com a mesma regra do banco: cota de 5 pedidos/mês no
 * plano grátis e detalhes bloqueados quando a cota estoura (`>= 5`). O teste
 * prova a cadeia inteira do ponto de vista do dono:
 *
 *   1. com a cota estourada, o card bloqueia os detalhes e esconde as ações;
 *   2. a tela mostra o aviso de plano com CTA para assinar;
 *   3. "assinar" (o que o webhook faz) destrava os detalhes sem recarregar a
 *      página — o bloqueio é leitura, não RLS.
 *
 * Não substitui o teste real contra o Mercado Pago (sandbox), mas garante que
 * a regra de negócio do plano não regride.
 */

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "owner-1";
const FREE_LIMIT = 5;

function makeOrder(index: number, createdAt: string) {
  const n = String(index).padStart(2, "0");
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

function makeItem(index: number) {
  const n = String(index).padStart(2, "0");
  return {
    id: `item-${n}`,
    order_id: `order-${n}`,
    product_id: "prod-1",
    product_name: "X-Burger Especial",
    quantity: 1,
    unit_price: 18.5,
    total: 18.5,
    notes: "",
    created_at: new Date().toISOString(),
  };
}

/** Semeia `count` pedidos deste mês (contam na cota do plano grátis). */
async function seedOrders(page: Page, count: number): Promise<void> {
  const base = Date.now() - 60 * 60 * 1000;
  // PED-01 é o mais recente (aparece primeiro na lista, que ordena por data desc).
  const orders = Array.from({ length: count }, (_, i) =>
    makeOrder(i + 1, new Date(base - i * 60_000).toISOString()),
  );
  const items = Array.from({ length: count }, (_, i) => makeItem(i + 1));
  await page.addInitScript(
    ({ rows, its }) => {
      (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = {
        orders: rows,
        order_items: its,
      };
    },
    { rows: orders, its: items },
  );
}

/** Ativa o Premium como o webhook faria, sem recarregar a página. */
async function activatePremium(page: Page): Promise<void> {
  await page.evaluate((storeId) => {
    const fn = (window as unknown as { __E2E_ACTIVATE_PREMIUM__?: (id: string) => void })
      .__E2E_ACTIVATE_PREMIUM__;
    fn?.(storeId);
  }, RESTAURANT_ID);
}

/** O card de um pedido, escopado pela comanda (evita casar com outros cards). */
function cardFor(page: Page, comanda: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: new RegExp(comanda) }) });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.addInitScript(
    ({ id }) => {
      (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
        user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
      };
    },
    { id: OWNER_ID },
  );
});

test("cota estourada bloqueia os detalhes e oferece assinar", async ({ page }) => {
  await seedOrders(page, FREE_LIMIT + 1);

  await page.goto("/mobile");
  await expect(page.getByText("PED-01")).toBeVisible();

  // Aviso de plano no topo, com CTA para a assinatura.
  await expect(page.getByText(/Limite do plano gratuito atingido/i)).toBeVisible();

  // Abre o card: é ao expandir que os detalhes são consultados e vêm bloqueados.
  const card = cardFor(page, "PED-01");
  await card.getByRole("button", { name: /PED-01/ }).click();
  await expect(card.getByText(/detalhes deste pedido estão bloqueados/i)).toBeVisible();
  // Os itens NÃO podem vazar enquanto está bloqueado.
  await expect(card.getByText("X-Burger Especial")).toHaveCount(0);
  // Sem ações de operação no card bloqueado.
  await expect(card.getByRole("button", { name: "Preparando" })).toHaveCount(0);
  await expect(card.getByRole("link", { name: /Assinar Premium agora/i })).toBeVisible();
});

test("assinar destrava os pedidos que chegaram bloqueados", async ({ page }) => {
  await seedOrders(page, FREE_LIMIT + 1);

  await page.goto("/mobile");
  const card = cardFor(page, "PED-01");
  const header = card.getByRole("button", { name: /PED-01/ });
  await header.click(); // abre → consulta bloqueada
  await expect(card.getByText(/detalhes deste pedido estão bloqueados/i)).toBeVisible();

  // Simula a aprovação do pagamento (webhook) e reabre o card para nova consulta.
  await activatePremium(page);
  await header.click(); // recolhe
  await header.click(); // reabre → nova consulta

  await expect(card.getByRole("listitem").filter({ hasText: /X-Burger Especial/ })).toBeVisible({
    timeout: 10_000,
  });
  await expect(card.getByText(/detalhes deste pedido estão bloqueados/i)).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Preparando" })).toBeVisible();
});

test("dentro da cota os detalhes ficam liberados e sem aviso de plano", async ({ page }) => {
  await seedOrders(page, FREE_LIMIT - 1);

  await page.goto("/mobile");
  await expect(page.getByText("PED-01")).toBeVisible();
  await expect(page.getByText(/Limite do plano gratuito atingido/i)).toHaveCount(0);

  const card = cardFor(page, "PED-01");
  await card.getByRole("button", { name: /PED-01/ }).click();
  // A prévia recolhida também cita o item, então escopamos na lista de itens.
  await expect(card.getByRole("listitem").filter({ hasText: /X-Burger Especial/ })).toBeVisible({
    timeout: 10_000,
  });
  await expect(card.getByRole("button", { name: "Preparando" })).toBeVisible();
});
