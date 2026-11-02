import { supabase } from "./client";

const TABLE = "invoice_requests";

/** PostgREST devolve 42P01 quando a tabela ainda não foi criada no banco. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? "");
}

export interface InvoiceRequest {
  id: string;
  restaurant_id: string;
  kind: string;
  reference_id: string | null;
  quantity: number;
  status: "pending" | "emitted" | "rejected";
  person_type: "cpf" | "cnpj";
  tax_id: string;
  legal_name: string;
  email: string;
  address: string | null;
  notes: string | null;
  created_at: string;
  emitted_at: string | null;
}

export interface InvoiceRequestsResult {
  requests: InvoiceRequest[];
  /** `true` quando a migração de notas ainda não foi aplicada. */
  unavailable: boolean;
}

/**
 * Pedidos de nota de uma loja, mais recentes primeiro. Sem a migração aplicada
 * devolve lista vazia e sinaliza `unavailable` — a UI esconde a seção em vez de
 * quebrar, como em `reviews.ts`.
 */
export async function getInvoiceRequests(restaurantId: string): Promise<InvoiceRequestsResult> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, restaurant_id, kind, reference_id, quantity, status, person_type, tax_id, legal_name, email, address, notes, created_at, emitted_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (!isMissingTable(error)) console.error("Error fetching invoice requests:", error);
    return { requests: [], unavailable: isMissingTable(error) };
  }
  return { requests: (data ?? []) as InvoiceRequest[], unavailable: false };
}

export interface CreateInvoiceRequestParams {
  restaurantId: string;
  kind: "annual" | "monthly" | "day_pass";
  referenceId?: string | null;
  quantity?: number;
  personType: "cpf" | "cnpj";
  taxId: string;
  legalName: string;
  email: string;
  address?: string;
  notes?: string;
}

/**
 * Cria o pedido de nota. O `amount_cents` NÃO é enviado: o guard do banco
 * anula qualquer valor vindo do cliente — o preço é do servidor. O status
 * também é forçado para `pending` pelo trigger.
 */
export async function createInvoiceRequest(
  params: CreateInvoiceRequestParams,
): Promise<{ request: InvoiceRequest | null; error?: string }> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      restaurant_id: params.restaurantId,
      kind: params.kind,
      reference_id: params.referenceId ?? null,
      quantity: params.quantity ?? 1,
      person_type: params.personType,
      tax_id: params.taxId.replace(/\D/g, ""),
      legal_name: params.legalName.trim(),
      email: params.email.trim(),
      address: params.address?.trim() || null,
      notes: params.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return { request: null, error: "Recurso de nota indisponível no momento." };
    }
    // Índice único do pedido pendente: a mesma compra já foi pedida.
    if (error.code === "23505") {
      return { request: null, error: "Já existe um pedido de nota para esta compra." };
    }
    console.error("Error creating invoice request:", error);
    return { request: null, error: "Não foi possível registrar o pedido de nota." };
  }
  return { request: data as InvoiceRequest };
}
