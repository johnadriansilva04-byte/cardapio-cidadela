import { test, expect, type Page } from "@playwright/test";

/**
 * E2E do chat de criação (Pracinha Monta).
 *
 * Clicar em "Novo restaurante" abre uma conversa em tela cheia, não o
 * formulário: a Pracinha pergunta uma coisa por vez e o cardápio se monta na
 * prévia. Aqui provamos o roteiro ponta a ponta até o botão criar.
 */

const OWNER_ID = "owner-1";

function restaurant(id: string, name: string, slug: string) {
  return {
    id,
    owner_id: OWNER_ID,
    slug,
    name,
    description: "",
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

async function loginAsPremiumOwner(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
      user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
    };
    (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = {
      restaurants: [],
      admin_trials: [
        {
          id: "trial-1",
          store_id: "seed-store",
          is_premium: true,
          premium_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        },
      ],
    };
  }, OWNER_ID);
}

test.describe("chat de criação", () => {
  test("conduz o dono pelo roteiro e cria o cardápio", async ({ page }) => {
    await loginAsPremiumOwner(page);
    await page.goto("/admin/restaurantes");

    await page.getByRole("button", { name: /Novo restaurante/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Qual é o nome do seu restaurante");
    // O formulário gigante não aparece no modo conversa.
    await expect(page.locator("#rest-name")).toHaveCount(0);

    // Nome
    await dialog.getByRole("textbox").fill("Cantina da Pracinha");
    await dialog.getByRole("button", { name: /Enviar resposta/i }).click();
    // A prévia ao vivo já mostra o nome.
    await expect(dialog).toContainText("Cantina da Pracinha");

    // Slogan (pular)
    await expect(dialog).toContainText(/slogan ou uma descrição/i);
    await dialog.getByRole("button", { name: /^Pular$/i }).click();

    // WhatsApp
    await expect(dialog).toContainText(/qual whatsapp vai receber/i);
    await dialog.getByRole("textbox").fill("(48) 99999-9999");
    await dialog.getByRole("button", { name: /Enviar resposta/i }).click();

    // Telefone, endereço, entrega, bairros, PIX: pular os opcionais
    await dialog.getByRole("button", { name: /^Pular$/i }).click(); // telefone
    await dialog.getByRole("button", { name: /^Pular$/i }).click(); // endereço
    await dialog.getByRole("button", { name: /^Pular$/i }).click(); // entrega
    // Bairros: adiciona um e conclui.
    await expect(dialog).toContainText(/cobrar diferente por bairro/i);
    await dialog.getByRole("textbox").fill("Centro 5");
    await dialog.getByRole("button", { name: /Enviar resposta/i }).click();
    await dialog.getByRole("button", { name: /Pronto, é isso/i }).click();
    await dialog.getByRole("button", { name: /^Pular$/i }).click(); // PIX

    // Horário e tema.
    await dialog.getByRole("button", { name: /Todos os dias, 17h/i }).click();
    await dialog.getByRole("button", { name: /Ciano e violeta/i }).click();

    // Revisão.
    await expect(dialog).toContainText("Tudo pronto");
    await expect(dialog).toContainText("Centro");
    await dialog.getByRole("button", { name: /Criar cardápio/i }).click();

    // O restaurante foi criado e aparece na lista.
    await expect(page.locator("h3", { hasText: "Cantina da Pracinha" })).toBeVisible();
  });

  test("dá para trocar para o formulário no meio do caminho", async ({ page }) => {
    await loginAsPremiumOwner(page);
    await page.goto("/admin/restaurantes");

    await page.getByRole("button", { name: /Novo restaurante/ }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("textbox").fill("Bistrô Teste");
    await dialog.getByRole("button", { name: /Enviar resposta/i }).click();
    await dialog.getByRole("button", { name: /Prefiro preencher tudo/i }).click();

    // O formulário abre com o que já foi respondido preservado.
    await expect(page.locator("#rest-name")).toHaveValue("Bistrô Teste");
  });
});
