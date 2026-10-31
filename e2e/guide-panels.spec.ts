import { test, expect, type Page } from "@playwright/test";

/**
 * E2E das guias em tela cheia (GuidePanel).
 *
 * A queixa era ter de rolar a tela para achar o conteúdo: cada assunto abre
 * por cima, com X para fechar, e o fundo não rola. Este teste prova, nas telas
 * que passaram por essa troca (restaurante, configurações e gestão mobile):
 *
 *   1. o atalho abre a guia por cima (o conteúdo só aparece depois do toque);
 *   2. o X fecha a guia;
 *   3. com a guia aberta, a página de fundo não rola.
 */

const OWNER_ID = "owner-1";
const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";

async function loginAsOwner(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.addInitScript(
    ({ id }) => {
      (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
        user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
      };
    },
    { id: OWNER_ID },
  );
}

/** O scroll da página de fundo precisa ficar travado enquanto a guia está aberta. */
async function expectBackgroundLocked(page: Page): Promise<void> {
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight + 8);
}

test.beforeEach(async ({ page }) => {
  await loginAsOwner(page);
});

test("restaurante: a área abre em guia por cima e fecha no X", async ({ page }) => {
  await page.goto(`/admin/restaurante/${RESTAURANT_ID}`);

  const openMenu = page.getByRole("button", { name: /Abrir Cardápio de/i });
  await expect(openMenu).toBeVisible();

  // Fechada, o conteúdo do cardápio não está montado na página.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await openMenu.click();
  const guide = page.getByRole("dialog");
  await expect(guide).toBeVisible();
  await expect(guide.getByText("Cardápio", { exact: true })).toBeVisible();
  await expectBackgroundLocked(page);

  await guide.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("configurações: cada atalho abre a própria guia", async ({ page }) => {
  await page.goto("/admin/config");

  await page.getByRole("button", { name: /Dados da conta/ }).click();
  const guide = page.getByRole("dialog");
  await expect(guide).toBeVisible();
  await expect(guide.getByText("Telefone:", { exact: false })).toBeVisible();
  await expectBackgroundLocked(page);

  await guide.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Outro atalho abre outra guia, não a mesma.
  await page.getByRole("button", { name: /Alterar senha/ }).click();
  await expect(page.getByRole("dialog").getByText("Senha atual")).toBeVisible();
});

test("gestão mobile: atalhos abrem guia por cima e o fundo fica travado", async ({ page }) => {
  await page.goto("/mobile/config");

  await page.getByRole("button", { name: /Alertas de novos pedidos/ }).click();
  const guide = page.getByRole("dialog");
  await expect(guide).toBeVisible();
  await expect(guide.getByText("Alerta sonoro")).toBeVisible();
  await expectBackgroundLocked(page);

  await guide.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
