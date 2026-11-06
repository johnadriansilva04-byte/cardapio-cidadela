import { test, expect, type Page } from "@playwright/test";

/**
 * E2E do cardápio por FOTO (exclusivo do plano Anual).
 *
 * O recurso custa IA por uso, então o gate é do plano anual: quem não tem vê o
 * convite de upgrade (e segue digitando); quem tem vê o botão de foto. O envio
 * real da imagem depende do Workers AI (sem token no E2E), então aqui provamos
 * só o gate — que é o que decide quem pode gastar a cota.
 */

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "owner-1";

function restaurant() {
  return {
    id: RESTAURANT_ID,
    owner_id: OWNER_ID,
    slug: "loja-foto",
    name: "Cantina da Pracinha",
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

test.describe("cardápio por foto (plano anual)", () => {
  test("sem o plano anual mostra o convite e leva à assinatura", async ({ page }) => {
    await loginAsOwner(page, { restaurants: [restaurant()] });
    await page.goto(`/admin/restaurante/${RESTAURANT_ID}?tab=cardapio`);

    const upsell = page.getByRole("button", { name: /Enviar foto \(Anual\)/ });
    await expect(upsell).toBeVisible();

    await upsell.click();
    await expect(page).toHaveURL(/\/admin\/assinatura/);
  });

  test("com o ciclo anual mostra o botão de foto do cardápio", async ({ page }) => {
    await loginAsOwner(page, {
      restaurants: [restaurant()],
      admin_trials: [
        {
          id: "trial-1",
          store_id: RESTAURANT_ID,
          is_premium: true,
          premium_expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
          premium_cycle: "annual",
        },
      ],
    });
    await page.goto(`/admin/restaurante/${RESTAURANT_ID}?tab=cardapio`);

    await expect(page.getByRole("button", { name: /Foto do cardápio/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Enviar foto \(Anual\)/ })).toHaveCount(0);
  });

  test("no ciclo mensal o recurso continua bloqueado", async ({ page }) => {
    await loginAsOwner(page, {
      restaurants: [restaurant()],
      admin_trials: [
        {
          id: "trial-1",
          store_id: RESTAURANT_ID,
          is_premium: true,
          premium_expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
          premium_cycle: "monthly",
        },
      ],
    });
    await page.goto(`/admin/restaurante/${RESTAURANT_ID}?tab=cardapio`);

    // Mesmo Premium, mas mensal: a foto é exclusiva do anual.
    await expect(page.getByRole("button", { name: /Enviar foto \(Anual\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Foto do cardápio/ })).toHaveCount(0);
  });
});
