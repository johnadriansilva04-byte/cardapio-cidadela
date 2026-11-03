import { test, expect, type Page } from "@playwright/test";

/**
 * E2E do pedido de nota fiscal (NFS-e), sem backend real.
 *
 * O stub em memória implementa `invoice_requests` como qualquer outra tabela,
 * então o teste prova a cadeia do ponto de vista do dono:
 *
 *   1. a aba de nota diz que a nota é pedida pelo app (não manda ao suporte);
 *   2. "Pedir nota fiscal" abre o formulário e o pedido entra na fila;
 *   3. o pedido aparece no histórico com o tipo da compra.
 *
 * No E2E a chamada passa direto pelo insert (sem a rota de e-mail), como o
 * `VITE_E2E=1` já faz com o resto do SDK.
 */

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "owner-1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ id, storeId }) => {
      localStorage.clear();
      // Loja ativa: o pedido de nota é feito para a loja selecionada.
      localStorage.setItem("cidadela:active-store", storeId);
      (window as unknown as { __E2E_SESSION__?: unknown }).__E2E_SESSION__ = {
        user: { id, email: "dono@menufacil.local", user_metadata: { name: "Dono Teste" } },
      };
    },
    { id: OWNER_ID, storeId: RESTAURANT_ID },
  );
});

/** Abre a aba "nota" a partir do atalho do hub. */
async function openInvoiceTab(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Nota fiscal/ }).click();
}

/** Preenche o formulário de nota (PF) e envia. */
async function submitCpfRequest(page: Page, taxId = "111.444.777-35"): Promise<void> {
  await page.getByRole("button", { name: /Diária \(24h\)/i }).click();
  await page.getByRole("button", { name: /Pessoa \(CPF\)/ }).click();
  await page.getByLabel("Nome completo").fill("Maria Souza");
  await page.getByLabel("CPF").fill(taxId);
  await page.getByLabel(/E-mail para receber a nota/i).fill("maria@exemplo.com");
  await page.getByRole("button", { name: /Enviar pedido de nota/i }).click();
}

test("a nota é pedida pelo app, não pelo suporte", async ({ page }) => {
  await page.goto("/admin/assinatura");
  await openInvoiceTab(page);
  // O texto antigo mandava o dono ao suporte; agora aponta o fluxo do app.
  await expect(page.getByText(/registre o pedido abaixo/i)).toBeVisible();
  await expect(page.getByText(/peça o documento pelo canal de suporte/i)).toHaveCount(0);
});

test("pedir nota registra o pedido e ele aparece na fila", async ({ page }) => {
  await page.goto("/admin/assinatura");
  await openInvoiceTab(page);
  await submitCpfRequest(page);

  await expect(page.getByText(/Pedido de nota registrado/i)).toBeVisible();
  await expect(page.getByText("Seus pedidos")).toBeVisible();
  await expect(page.getByText(/Diária \(24h\)/).last()).toBeVisible();
});

test("CPF inválido é barrado antes de registrar", async ({ page }) => {
  await page.goto("/admin/assinatura");
  await openInvoiceTab(page);
  await submitCpfRequest(page, "111.111.111-11");

  await expect(page.getByText(/CPF inválido/i)).toBeVisible();
});
