import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { COMPANY, hasSupportContact } from "@/lib/company";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-cyan-400">Política de Privacidade</h1>
          <button
            onClick={() => navigate({ to: "/" })}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="space-y-6 text-sm md:text-base">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">1. Introdução</h2>
            <p className="text-gray-300 leading-relaxed">
              Bem-vindo à Política de Privacidade do Cardápio Cidadela. Esta política descreve como
              coletamos, usamos e protegemos suas informações pessoais ao utilizar nossos serviços
              de pedidos online e acesso à plataforma.
            </p>
            <p className="mt-3 text-gray-300 leading-relaxed">
              O controlador dos dados pessoais tratados nesta plataforma é {COMPANY.legalName}, CNPJ
              nº {COMPANY.cnpj}, com sede em {COMPANY.city}/{COMPANY.state}, atuando como{" "}
              {COMPANY.taxRegime}, nos termos da Lei nº 13.709/2018 (LGPD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">2. Informações Coletadas</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              Coletamos as seguintes informações:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Nome e telefone para contato e entrega</li>
              <li>Endereço de entrega (quando aplicável)</li>
              <li>Detalhes do pedido (itens, quantidade, valores)</li>
              <li>Informações de pagamento (quando aplicável)</li>
              <li>Dados de uso da plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">3. Uso das Informações</h2>
            <p className="text-gray-300 leading-relaxed mb-3">Utilizamos suas informações para:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Processar e entregar seus pedidos</li>
              <li>Comunicar-se sobre o status do pedido</li>
              <li>Melhorar nossos serviços</li>
              <li>Enviar promoções e ofertas (com seu consentimento)</li>
              <li>Garantir a segurança da plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">
              4. Compartilhamento de Dados
            </h2>
            <p className="text-gray-300 leading-relaxed">
              Não vendemos suas informações pessoais. Compartilhamos dados apenas com:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 mt-3">
              <li>Restaurantes parceiros para entrega</li>
              <li>Serviços de pagamento (quando aplicável)</li>
              <li>Provedores de serviços técnicos necessários</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">5. Segurança dos Dados</h2>
            <p className="text-gray-300 leading-relaxed">
              Implementamos medidas de segurança robustas para proteger suas informações, incluindo
              criptografia, autenticação e monitoramento constante. Seus dados são armazenados em
              servidores seguros e acessíveis apenas por pessoal autorizado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">6. Seus Direitos</h2>
            <p className="text-gray-300 leading-relaxed mb-3">Você tem o direito de:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Acessar suas informações pessoais</li>
              <li>Corrigir dados incorretos</li>
              <li>Solicitar exclusão de seus dados</li>
              <li>Revogar consentimento</li>
              <li>Exportar seus dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">7. Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              Utilizamos cookies para melhorar sua experiência, analisar tráfego e personalizar
              conteúdo. Você pode gerenciar suas preferências de cookies nas configurações do
              navegador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">8. Contato</h2>
            <p className="text-gray-300 leading-relaxed">
              Para dúvidas sobre esta política ou para exercer seus direitos como titular de dados
              (acesso, correção, exclusão, portabilidade), o encarregado é {COMPANY.legalName}, CNPJ{" "}
              {COMPANY.cnpj}.{" "}
              {hasSupportContact
                ? "Fale com o encarregado pelo "
                : "Use os canais oficiais do serviço."}
              {hasSupportContact && (
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
                  .
                </>
              )}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">9. Atualizações</h2>
            <p className="text-gray-300 leading-relaxed">
              Esta política pode ser atualizada periodicamente. Notificaremos usuários sobre
              mudanças significativas através da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-cyan-400">10. Data de Vigência</h2>
            <p className="text-gray-300 leading-relaxed">
              Esta política entra em vigor a partir de 4 de agosto de 2026.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
