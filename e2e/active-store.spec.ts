import { test, expect, type Page } from "@playwright/test";

/**
 * E2E da loja ativa global.
 *
 * A queixa era confusão com vários restaurantes: cada tela escolhia a própria
 * loja, então trocar no dashboard não mudava Pedidos nem Financeiro. Aqui o
 * seletor do cabeçalho é a única fonte da verdade — trocar nele muda o painel
 * inteiro e a escolha sobrevive ao recarregar.
 */

const STORE_A = "11111111-1111-1111-1111-111111111111";
const STORE_B = "22222222-2222-2222-2222-222222222222";
const OWNER_ID = "owner-1";

const SEED = {
  restaurants: [
    {
      id: STORE_A,
      owner_id: OWNER_ID,
      slug: "loja-a",
      name: "Cidadela Teste",
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
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      id: STORE_B,
      owner_id: OWNER_ID,
      slug: "loja-b",
      name: "Cantina da Praça",
      description: "",
      slogan: "",
      logo_url: null,
      banner_url: null,
      status: "published",
      primary_color: "#f97316",
      secondary_color: "#8b5cf6",
      delivery_fee: 5,
      whatsapp: "5511888888888",
      address: "",
      pix_key: "",
      operating_hours: null,
      created_at: new Date().toISOString(),
    },
  ],
};

async function loginAsOwner(page: Page): Promise<void> {
  await page.addInitScript(
    ({ id, seed }) => {
      (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
        user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
      };
      (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = seed;
    },
    { id: OWNER_ID, seed: SEED },
  );
}

test.describe("loja ativa global", () => {
  test("troca a loja pelo cabeçalho e o painel inteiro acompanha", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin");

    // A loja mais recente (Cantina) abre como ativa por padrão.
    const switcher = page.getByRole("button", { name: /Loja ativa/ });
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText("Cantina da Praça");

    await switcher.click();
    await page.getByRole("menuitem", { name: "Cidadela Teste" }).click();
    await expect(switcher).toContainText("Cidadela Teste");

    // Pedidos e Compartilhar leem a mesma loja ativa — sem seletor próprio.
    await page.goto("/admin/pedidos");
    await expect(page.getByText("Cidadela Teste", { exact: false }).first()).toBeVisible();

    await page.goto("/admin/compartilhar");
    await expect(page.getByText("Cidadela Teste", { exact: false }).first()).toBeVisible();
  });

  test("a escolha sobrevive ao recarregar", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin");

    await page.getByRole("button", { name: /Loja ativa/ }).click();
    await page.getByRole("menuitem", { name: "Cidadela Teste" }).click();

    await page.reload();

    await expect(page.getByRole("button", { name: /Loja ativa/ })).toContainText("Cidadela Teste");
  });

  test("com uma loja só o seletor não aparece", async ({ page }) => {
    await page.addInitScript(
      ({ id }) => {
        (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
          user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
        };
      },
      { id: OWNER_ID },
    );

    await page.goto("/admin");
    await expect(page.getByText("Cidadela Teste").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Loja ativa/ })).toHaveCount(0);
  });
});
