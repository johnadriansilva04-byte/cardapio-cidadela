import { test, expect, type Page } from "@playwright/test";

/**
 * E2E do Financeiro.
 *
 * A queixa era o gráfico de barras "Faturamento": com um só dia de dados o
 * recharts estica a única barra para preencher a largura toda e ela vira um
 * quadrado azul gigante. `maxBarSize` limita a largura, então a barra vira um
 * retângulo fino de pé. Este teste mede a largura renderizada para não regredir.
 */

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "owner-1";

async function loginAsOwnerWithOneOrder(page: Page): Promise<void> {
  await page.addInitScript(
    ({ rest, id }) => {
      const now = new Date().toISOString();
      (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
        user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
      };
      (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = {
        orders: [
          {
            id: "order-fin",
            restaurant_id: rest,
            idempotency_key: "idem-fin",
            comanda: "#fin",
            customer_name: "Cliente Financeiro",
            delivery_type: "entrega",
            subtotal: 18.5,
            delivery_fee: 5,
            total: 78.7,
            payment_method: "pix",
            payment_status: "pending",
            status: "delivered",
            created_at: now,
            updated_at: now,
          },
        ],
        order_items: [],
      };
    },
    { rest: RESTAURANT_ID, id: OWNER_ID },
  );
}

test.describe("financeiro", () => {
  test("a barra do faturamento não estica para a largura toda com um só dia", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 1600 });
    await loginAsOwnerWithOneOrder(page);
    await page.goto("/admin/financeiro");

    // Espera o gráfico montar (o recharts anima a barra de baixo para cima).
    const bar = page.locator(".recharts-bar-rectangle path").first();
    await expect(bar).toBeVisible();

    const { barW, surfaceW } = await page.evaluate(() => {
      const b = document.querySelector(".recharts-bar-rectangle path");
      const s = document.querySelector(".recharts-surface");
      const br = b ? (b as Element).getBoundingClientRect() : null;
      const sr = s ? (s as Element).getBoundingClientRect() : null;
      return { barW: br?.width ?? 0, surfaceW: sr?.width ?? 0 };
    });

    // Um só dia antes esticava para ~85% da largura (o "quadrado azul").
    // Com maxBarSize a barra fica bem mais estreita que o gráfico.
    expect(surfaceW).toBeGreaterThan(300);
    expect(barW).toBeLessThan(surfaceW / 3);
  });
});
