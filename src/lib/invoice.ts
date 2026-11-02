/**
 * Pedido de nota fiscal (NFS-e): validação e rótulos.
 *
 * O app não emite nota — só coleta o pedido do dono para o fornecedor emitir.
 * Por isso a validação aqui é deliberadamente rígida: um CPF/CNPJ errado faz o
 * pedido voltar depois de já ter saído da fila.
 */

export type InvoicePersonType = "cpf" | "cnpj";

export interface InvoiceRequestInput {
  personType: InvoicePersonType;
  taxId: string;
  legalName: string;
  email: string;
  address?: string;
  notes?: string;
}

/** Só os dígitos, para comparar/validar. */
export function normalizeTaxId(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Todos os dígitos iguais (111.111.111-11) passam no cálculo, mas não existem. */
function allSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

/** CPF pelos dois dígitos verificadores (módulo 11). */
export function isValidCpf(value: string): boolean {
  const digits = normalizeTaxId(value);
  if (digits.length !== 11 || allSameDigits(digits)) return false;

  const dv = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return dv(9) === Number(digits[9]) && dv(10) === Number(digits[10]);
}

/** CNPJ pelos dois dígitos verificadores (módulo 11). */
export function isValidCnpj(value: string): boolean {
  const digits = normalizeTaxId(value);
  if (digits.length !== 14 || allSameDigits(digits)) return false;

  const dv = (length: number): number => {
    const weights =
      length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return dv(12) === Number(digits[12]) && dv(13) === Number(digits[13]);
}

/** Valida pelo tipo escolhido — o mesmo campo aceita CPF ou CNPJ. */
export function isValidTaxId(value: string, type: InvoicePersonType): boolean {
  return type === "cpf" ? isValidCpf(value) : isValidCnpj(value);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const INVOICE_KIND_LABELS: Record<string, string> = {
  annual: "Assinatura anual",
  monthly: "Assinatura mensal",
  day_pass: "Diária (24h)",
};

/**
 * Devolve a mensagem de erro, ou `null` quando o pedido está válido.
 * Mesmo contrato de `validateReviewInput` — a UI mostra a mensagem direto.
 */
export function validateInvoiceRequest(input: InvoiceRequestInput): string | null {
  const name = (input.legalName ?? "").trim();
  if (name.length < 3) return "Informe a razão social ou o nome completo.";
  if (name.length > 200) return "Nome muito longo.";

  if (!isValidTaxId(input.taxId, input.personType)) {
    return input.personType === "cpf" ? "CPF inválido." : "CNPJ inválido.";
  }

  const email = (input.email ?? "").trim();
  if (!EMAIL_RE.test(email)) return "Informe um e-mail válido para receber a nota.";
  if (email.length > 200) return "E-mail muito longo.";

  if ((input.address ?? "").length > 300) return "Endereço muito longo.";
  if ((input.notes ?? "").length > 500) return "Observação muito longa.";

  return null;
}

/** Formata o CPF/CNPJ enquanto o dono digita (máscara progressiva). */
export function formatTaxId(value: string, type: InvoicePersonType): string {
  const d = normalizeTaxId(value).slice(0, type === "cpf" ? 11 : 14);
  if (type === "cpf") {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
