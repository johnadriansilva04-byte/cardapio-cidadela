import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { COMPANY, hasSupportContact } from "@/lib/company";

export const Route = createFileRoute("/terms")({
  component: TermsOfUse,
});

function TermsOfUse() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-cyan-400">Termos de Uso</h1>
          <button
            onClick={() => navigate({ to: "/" })}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="space-y-6 text-sm md:text-base">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">
              1. Identificação do Fornecedor
            </h2>
            <p className="text-gray-300 leading-relaxed">
              O serviço Cardápio Cidadela é fornecido por {COMPANY.legalName}, inscrito no CNPJ nº{" "}
              {COMPANY.cnpj}, com sede em {COMPANY.city}/{COMPANY.state}, atuando como{" "}
              {COMPANY.taxRegime}. Estes Termos regem a relação entre o fornecedor e você, usuário
              da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">2. Aceitação dos Termos</h2>
            <p className="text-gray-300 leading-relaxed">
              Ao utilizar o Cardápio Cidadela, você concorda com estes Termos de Uso. Se não
              concordar com qualquer parte destes termos, por favor, não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">3. Descrição do Serviço</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              O Cardápio Cidadela é uma plataforma que permite:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Fazer pedidos online em restaurantes parceiros</li>
              <li>Receber promoções e ofertas especiais</li>
              <li>Acompanhar status de pedidos em tempo real</li>
              <li>Gerenciar cardápios, categorias e produtos pelo painel</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">
              4. Responsabilidades do Usuário
            </h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              Ao usar nossos serviços, você concorda em:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Fornecer informações verdadeiras e precisas</li>
              <li>Manter suas credenciais de acesso seguras</li>
              <li>Não usar a plataforma para fins ilegais</li>
              <li>Respeitar outros usuários e restaurantes</li>
              <li>Pagar pelos pedidos realizados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">5. Pedidos e Pagamentos</h2>
            <p className="text-gray-300 leading-relaxed mb-3">Sobre pedidos e pagamentos:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Os preços estão sujeitos a alteração sem aviso prévio</li>
              <li>Pagamentos devem ser confirmados antes da entrega</li>
              <li>Cancelamentos podem ter taxas dependendo do momento</li>
              <li>Não nos responsabilizamos por problemas de pagamento de terceiros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">6. Propriedade Intelectual</h2>
            <p className="text-gray-300 leading-relaxed">
              Todo o conteúdo da plataforma, incluindo textos, imagens, logotipos e software, é
              protegido por direitos autorais e outras leis de propriedade intelectual. Você não
              pode copiar, modificar ou distribuir este conteúdo sem permissão.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">
              7. Limitação de Responsabilidade
            </h2>
            <p className="text-gray-300 leading-relaxed">
              Não nos responsabilizamos por danos diretos, indiretos, incidentais ou consequentes
              resultantes do uso ou incapacidade de uso de nossos serviços, incluindo perda de dados
              ou lucros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">8. Modificações do Serviço</h2>
            <p className="text-gray-300 leading-relaxed">
              Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer parte do
              serviço a qualquer momento, sem aviso prévio e sem responsabilidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">9. Rescisão</h2>
            <p className="text-gray-300 leading-relaxed">
              Podemos rescindir ou suspender seu acesso a qualquer momento, sem aviso prévio, por
              violação destes Termos de Uso ou por qualquer outro motivo a nosso critério exclusivo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">10. Lei Aplicável</h2>
            <p className="text-gray-300 leading-relaxed">
              Estes Termos de Uso são regidos pelas leis do Brasil. Quaisquer disputas serão
              resolvidas nos tribunais competentes do país.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">11. Contato</h2>
            <p className="text-gray-300 leading-relaxed">
              Dúvidas sobre estes Termos podem ser enviadas para{" "}
              {hasSupportContact ? (
                <>
                  {COMPANY.supportEmail && (
                    <a href={`mailto:${COMPANY.supportEmail}`} className="text-cyan-400 underline">
                      {COMPANY.supportEmail}
                    </a>
                  )}
                  {COMPANY.supportEmail && COMPANY.supportPhone && " ou "}
                  {COMPANY.supportPhone && (
                    <a
                      href={`https://wa.me/${COMPANY.supportPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 underline"
                    >
                      WhatsApp de atendimento
                    </a>
                  )}
                  . O fornecedor do serviço é {COMPANY.legalName}, CNPJ {COMPANY.cnpj}.
                </>
              ) : (
                <>
                  os canais oficiais do serviço. O fornecedor é {COMPANY.legalName}, CNPJ{" "}
                  {COMPANY.cnpj}, com sede em {COMPANY.city}/{COMPANY.state}.
                </>
              )}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">12. Data de Vigência</h2>
            <p className="text-gray-300 leading-relaxed">
              Estes Termos de Uso entram em vigor a partir de 4 de agosto de 2026.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
