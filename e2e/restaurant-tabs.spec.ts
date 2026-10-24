import { test, expect, type Page } from "@playwright/test";

/**
 * E2E das abas de área do restaurante (`/admin/restaurante/$id`).
 *
 * A aba vive na URL (`?tab=`), então trocar de área, recarregar e voltar no
 * navegador precisam manter a área aberta — era exatamente o que falhava
 * quando a aba era só estado local (um F5 caía sempre no Cardápio).
 */

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";

async function asOwner(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
      user: { id: "owner-1", email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
    };
  });
}

const URL = `/admin/restaurante/${RESTAURANT_ID}`;

test("a aba escolhida vive na URL e sobrevive ao recarregar", async ({ page }) => {
  await asOwner(page);
  await page.goto(URL);

  const cardapio = page.getByRole("tab", { name: /Cardápio/ });
  const config = page.getByRole("tab", { name: /Configurações/ });

  // Abre no Cardápio por padrão.
  await expect(cardapio).toHaveAttribute("aria-selected", "true");

  await config.click();
  await expect(config).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/tab=config/);

  // F5 mantém a área aberta (antes voltava para o Cardápio).
  await page.reload();
  await expect(page.getByRole("tab", { name: /Configurações/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("trocar de aba não polui o histórico (replace)", async ({ page }) => {
  await asOwner(page);
  await page.goto(URL);

  await page.getByRole("tab", { name: /Configurações/ }).click();
  await page.getByRole("tab", { name: /Cardápio/ }).click();
  await page.getByRole("tab", { name: /Configurações/ }).click();

  // Um "voltar" sai da página, não percorre cada aba tocada.
  await page.goBack();
  await expect(page).not.toHaveURL(new RegExp(`/admin/restaurante/${RESTAURANT_ID}`));
});

test("as setas navegam entre as áreas", async ({ page }) => {
  await asOwner(page);
  await page.goto(URL);

  await page.getByRole("tab", { name: /Cardápio/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Configurações/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: /Cardápio/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
