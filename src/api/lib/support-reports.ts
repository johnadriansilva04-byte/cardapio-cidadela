/**
 * Registro durável dos relatos de suporte (Pracinha).
 *
 * O relato nasce na rota (service role) e recebe um protocolo. Gravar ANTES de
 * tentar o e-mail é a ordem que importa: o registro é a fonte da verdade, o
 * e-mail é o aviso. Se o e-mail falhar, o caso continua achável pelo protocolo.
 *
 * Sem `SUPABASE_SERVICE_ROLE_KEY` (ou sem a migração aplicada) a gravação é um
 * no-op que loga: o e-mail ainda sai e o app não quebra — só se perde o
 * histórico, que é o estado de antes desta tabela existir.
 */
import { getServerSupabase } from "./mercadopago";
import { generateProtocol } from "./protocol";

export interface SupportReportInput {
  kind: "suporte" | "erro";
  reporterId?: string;
  reporterEmail?: string;
  restaurantId?: string;
  restaurantName?: string;
  route?: string;
  message?: string;
  detail?: unknown;
}

export interface SupportReportSaved {
  ok: boolean;
  protocol: string;
  id?: string;
}

export async function saveSupportReport(input: SupportReportInput): Promise<SupportReportSaved> {
  const protocol = generateProtocol();
  const supabase = getServerSupabase();
  if (!supabase) {
    console.warn("[support] Supabase não configurado — relato não gravado:", protocol);
    return { ok: false, protocol };
  }

  const { data, error } = await supabase
    .from("support_reports")
    .insert({
      protocol,
      kind: input.kind,
      reporter_id: input.reporterId ?? null,
      reporter_email: input.reporterEmail ?? null,
      restaurant_id: input.restaurantId ?? null,
      restaurant_name: input.restaurantName ?? null,
      route: input.route ?? null,
      message: input.message ?? null,
      detail: input.detail ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Tabela ausente (migração não aplicada) ou RLS: o relato não foi gravado,
    // mas o e-mail ainda deve sair. Loga e segue.
    console.error("[support] falha ao gravar relato:", error.message);
    return { ok: false, protocol };
  }
  return { ok: true, protocol, id: (data as { id?: string })?.id };
}

/** Marca no registro que o aviso por e-mail saiu (best-effort, não bloqueia). */
export async function markReportNotified(id: string | undefined): Promise<void> {
  if (!id) return;
  const supabase = getServerSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("support_reports")
    .update({ email_sent: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.warn("[support] não marcou e-mail como enviado:", error.message);
}
