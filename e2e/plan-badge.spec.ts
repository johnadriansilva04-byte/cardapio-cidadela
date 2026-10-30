import { test, expect, type Page } from "@playwright/test";

/**
 * E2E do selo de plano e da assinatura sem rolagem.
 *
 * O selo vive no cabeçalho de toda tela autenticada: precisa mostrar Grátis
 * com a cota e virar Premium (dourado, com o vencimento) quando o webhook
 * ativa o plano. A tela de assinatura tem que caber numa tela só — a queixa
 * era ter de rolar para achar o botão de assinar.
 */

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "owner-1";

async function loginAsOwner(page: Page, seed?: Record<string, unknown>): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.addInitScript(
    ({ id, extra }) => {
      (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
        user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
      };
      if (extra) (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = extra;
    },
    { id: OWNER_ID, extra: seed ?? null },
  );
}

/** Não deve haver rolagem vertical na página (tolerância p/ arredondamento). */
async function expectNoPageScroll(page: Page): Promise<void> {
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight + 8);
}

test.describe("selo de plano", () => {
  test("aparece 'Grátis' com a cota no topo de todas as telas", async ({ page }) => {
    await loginAsOwner(page);

    for (const url of ["/admin", "/admin/pedidos", "/mobile", "/mobile/config"]) {
      await page.goto(url);
      const badge = page.locator(".plan-badge").first();
      await expect(badge).toBeVisible();
      await expect(badge).toContainText("Grátis");
      // Cota do plano gratuito (5/mês, sem bônus no stub).
      await expect(badge).toContainText("5/5");
    }
  });

  test("vira 'Premium' dourado com os dias até vencer", async ({ page }) => {
    const inTenDays = new Date(Date.now() + 10 * 86_400_000).toISOString();
    await loginAsOwner(page, {
      admin_trials: [
        {
          store_id: RESTAURANT_ID,
          is_premium: true,
          premium_expires_at: inTenDays,
          admin_email: null,
          mercadopago_preapproval_id: "preap-123",
          mercadopago_payer_email: null,
        },
      ],
    });

    await page.goto("/admin");
    const badge = page.locator(".plan-badge").first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("Premium");
    await expect(badge).toContainText("10d");
    await expect(badge).toHaveClass(/plan-badge-premium/);
  });
});

test.describe("assinatura sem rolagem", () => {
  test("a tela cabe numa tela só, com o botão de assinar visível", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/assinatura");

    await expect(page.getByRole("button", { name: /Assinar agora/ })).toBeVisible();
    await expectNoPageScroll(page);
  });

  test("cada assunto abre por cima, sem esticar o fundo", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/assinatura");

    for (const label of ["O que muda", "E-mail do Mercado Pago", "Pedidos e detalhes"]) {
      await page
        .getByRole("button", { name: new RegExp(label) })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      // O painel é sobreposto: o fundo não pode crescer.
      await expectNoPageScroll(page);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    }
  });

  test("o e-mail interno (telefone@menufacil.local) nunca aparece na tela", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/assinatura");
    await page
      .getByRole("button", { name: /E-mail do Mercado Pago/ })
      .first()
      .click();

    await expect(page.getByPlaceholder("voce@email.com")).toBeVisible();
    await expect(page.getByText(/menufacil\.local/)).toHaveCount(0);
  });
});
