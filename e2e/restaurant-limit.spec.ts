import { test, expect, type Page } from "@playwright/test";

/**
 * E2E do limite de restaurantes por conta.
 *
 * Regra: o plano gratuito dá 1 restaurante; criar mais é Premium. O gate vive
 * no "servidor" (o stub espelha o trigger `guard_restaurant_limit`), então aqui
 * provamos que a tela explica o motivo e leva ao fluxo de assinatura em vez de
 * deixar o INSERT falhar com um erro cru.
 */

const STORE_A = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "owner-1";

function restaurant(id: string, name: string, slug: string) {
  return {
    id,
    owner_id: OWNER_ID,
    slug,
    name,
    description: "",
    slogan: "",
    logo_url: null,
    banner_url: null,
    status: "published",
    primary_color: "#06b6d4",
    secondary_color: "#8b5cf6",
    delivery_fee: 5,
    whatsapp: "5511999999999",
    address: "",
    pix_key: "",
    operating_hours: null,
    created_at: new Date().toISOString(),
  };
}

async function loginAsOwner(page: Page, seed: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ({ id, s }) => {
      (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
        user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
      };
      (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = s;
    },
    { id: OWNER_ID, s: seed },
  );
}

test.describe("limite de restaurantes por conta", () => {
  test("dono com 1 loja e sem Premium vê o convite em vez do formulário", async ({ page }) => {
    await loginAsOwner(page, { restaurants: [restaurant(STORE_A, "Cidadela Teste", "loja-a")] });
    await page.goto("/admin/restaurantes");

    await page.getByRole("button", { name: /Novo restaurante/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Um restaurante no plano gratuito");
    // O formulário de criação NÃO abre.
    await expect(page.locator("#rest-name")).toHaveCount(0);
  });

  test("o convite leva ao fluxo de assinatura", async ({ page }) => {
    await loginAsOwner(page, { restaurants: [restaurant(STORE_A, "Cidadela Teste", "loja-a")] });
    await page.goto("/admin/restaurantes");

    await page.getByRole("button", { name: /Novo restaurante/ }).click();
    await page.getByRole("button", { name: /Assinar Premium/ }).click();

    await expect(page).toHaveURL(/\/admin\/assinatura/);
  });

  test("com Premium vigente o formulário abre normalmente", async ({ page }) => {
    await loginAsOwner(page, {
      restaurants: [restaurant(STORE_A, "Cidadela Teste", "loja-a")],
      admin_trials: [
        {
          id: "trial-1",
          store_id: STORE_A,
          is_premium: true,
          premium_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        },
      ],
    });
    await page.goto("/admin/restaurantes");

    await page.getByRole("button", { name: /Novo restaurante/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText("Um restaurante no plano gratuito");
    await expect(page.locator("#rest-name")).toBeVisible();
  });
});
