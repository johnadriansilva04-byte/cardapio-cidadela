import { test, expect, type Page } from "@playwright/test";

/**
 * E2E das áreas do restaurante (`/admin/restaurante/$id`).
 *
 * A área escolhida vive na URL (`?tab=`) e abre um painel por cima (`Sheet`),
 * não conteúdo inline. Por isso a barra é um `radiogroup` — não há `tabpanel`
 * na página para um `tablist` apontar. O painel é modal, então enquanto está
 * aberto o Radix esconde o resto da tela da árvore de acessibilidade: os testes
 * fecham o painel antes de voltar a consultar a barra.
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

test("a área escolhida vive na URL e sobrevive ao recarregar", async ({ page }) => {
  await asOwner(page);
  await page.goto(URL);

  // Nenhuma área aberta por padrão.
  await expect(page.getByRole("radio", { name: /Cardápio/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );

  await page.getByRole("radio", { name: /Configurações/ }).click();
  await expect(page).toHaveURL(/tab=config/);
  await expect(page.getByRole("dialog")).toBeVisible();

  // F5 mantém a área aberta (antes voltava para o Cardápio).
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/tab=config/);
});

test("trocar de área não polui o histórico (replace)", async ({ page }) => {
  await asOwner(page);
  await page.goto(URL);

  await page.getByRole("radio", { name: /Configurações/ }).click();
  await expect(page).toHaveURL(/tab=config/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("radio", { name: /Cardápio/ }).click();
  await expect(page).toHaveURL(/tab=cardapio/);
  await page.keyboard.press("Escape");

  // Um "voltar" sai da página, não percorre cada área tocada.
  await page.goBack();
  await expect(page).not.toHaveURL(new RegExp(`/admin/restaurante/${RESTAURANT_ID}`));
});

test("as setas navegam entre as áreas", async ({ page }) => {
  await asOwner(page);
  await page.goto(URL);

  await page.getByRole("radio", { name: /Cardápio/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/tab=config/);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
