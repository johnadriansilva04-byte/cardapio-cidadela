import { BarChart3 } from "lucide-react";
import { ExpandableSection, InfoRow } from "@/modules/ui/ExpandableSection";
import { useAnalyticsConsent } from "@/modules/analytics/usePageView";

/**
 * Controle de consentimento do analytics por dispositivo.
 *
 * O padrão é desligado quando não há endpoint; mesmo com endpoint o usuário
 * pode desligar aqui. Respeita Do Not Track do navegador.
 */
export function AnalyticsConsentCard() {
  const { status, setEnabled } = useAnalyticsConsent();

  const stateLabel = status.doNotTrack
    ? "Bloqueado pelo navegador"
    : status.hasEndpoint
      ? status.optedOut
        ? "Desligado neste dispositivo"
        : "Ligado"
      : "Não configurado";

  const canToggle = status.hasEndpoint && !status.doNotTrack;

  return (
    <ExpandableSection
      icon={<BarChart3 className="size-5" />}
      tone="violet"
      title="Estatísticas de uso"
      summary={stateLabel}
    >
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-gray-400">
          Ajuda a entender quais telas do cardápio os clientes mais usam. Nenhum dado pessoal (nome,
          telefone, endereço) é enviado — só contagens e tipos de evento.
        </p>

        <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
          <InfoRow label="Status" value={stateLabel} />
          <InfoRow
            label="Neste dispositivo"
            value={status.optedOut ? "Desativado por você" : "Ativado"}
          />
        </div>

        {canToggle && (
          <button
            type="button"
            onClick={() => setEnabled(status.optedOut)}
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-gray-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {status.optedOut ? "Ativar estatísticas neste dispositivo" : "Desativar estatísticas"}
          </button>
        )}

        {!status.hasEndpoint && (
          <p className="text-[11px] text-gray-500">
            Nenhum servidor de estatísticas está configurado, então nada é coletado no momento.
          </p>
        )}
      </div>
    </ExpandableSection>
  );
}
