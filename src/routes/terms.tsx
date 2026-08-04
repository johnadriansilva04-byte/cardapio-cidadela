import { createFileRoute } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/terms')({
  component: TermsOfUse,
});

function TermsOfUse() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-tech">Termos de Uso</h1>
          <button
            onClick={() => navigate({ to: '/' })}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="space-y-6 text-sm md:text-base">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">1. Aceitação dos Termos</h2>
            <p className="text-gray-300 leading-relaxed">
              Ao utilizar o Cardápio Digital Cidadela, você concorda com estes Termos de Uso. Se não concordar com qualquer parte destes termos, por favor, não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">2. Descrição do Serviço</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              O Cardápio Digital Cidadela é uma plataforma que permite:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Fazer pedidos online em restaurantes parceiros</li>
              <li>Acessar a plataforma Cidadela com jogos exclusivos</li>
              <li>Receber promoções e ofertas especiais</li>
              <li>Acompanhar status de pedidos em tempo real</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">3. Responsabilidades do Usuário</h2>
            <p className="text-gray-300 leading-relaxed mb-3">Ao usar nossos serviços, você concorda em:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Fornecer informações verdadeiras e precisas</li>
              <li>Manter suas credenciais de acesso seguras</li>
              <li>Não usar a plataforma para fins ilegais</li>
              <li>Respeitar outros usuários e restaurantes</li>
              <li>Pagar pelos pedidos realizados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">4. Pedidos e Pagamentos</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              Sobre pedidos e pagamentos:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Os preços estão sujeitos a alteração sem aviso prévio</li>
              <li>Pagamentos devem ser confirmados antes da entrega</li>
              <li>Cancelamentos podem ter taxas dependendo do momento</li>
              <li>Não nos responsabilizamos por problemas de pagamento de terceiros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">5. Acesso à Cidadela</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              O acesso à plataforma Cidadela é concedido através de códigos promocionais:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Códigos têm validade limitada</li>
              <li>O uso indevido pode resultar em suspensão</li>
              <li>Conteúdo dos jogos é propriedade da Cidadela</li>
              <li>Compartilhamento de contas é proibido</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">6. Propriedade Intelectual</h2>
            <p className="text-gray-300 leading-relaxed">
              Todo o conteúdo do Cardápio Digital Cidadela, incluindo textos, imagens, logotipos, software e jogos, é protegido por direitos autorais e outras leis de propriedade intelectual. Você não pode copiar, modificar ou distribuir este conteúdo sem permissão.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">7. Limitação de Responsabilidade</h2>
            <p className="text-gray-300 leading-relaxed">
              Não nos responsabilizamos por danos diretos, indiretos, incidentais ou consequentes resultantes do uso ou incapacidade de uso de nossos serviços, incluindo perda de dados ou lucros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">8. Modificações do Serviço</h2>
            <p className="text-gray-300 leading-relaxed">
              Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer parte do serviço a qualquer momento, sem aviso prévio e sem responsabilidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">9. Rescisão</h2>
            <p className="text-gray-300 leading-relaxed">
              Podemos rescindir ou suspender seu acesso a qualquer momento, sem aviso prévio, por violação destes Termos de Uso ou por qualquer outro motivo a nosso critério exclusivo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">10. Lei Aplicável</h2>
            <p className="text-gray-300 leading-relaxed">
              Estes Termos de Uso são regidos pelas leis do Brasil. Quaisquer disputas serão resolvidas nos tribunais competentes do país.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">11. Contato</h2>
            <p className="text-gray-300 leading-relaxed">
              Para dúvidas sobre estes termos, entre em contato através dos canais disponíveis em nossa plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-tech">12. Data de Vigência</h2>
            <p className="text-gray-300 leading-relaxed">
              Estes Termos de Uso entram em vigor a partir de 4 de agosto de 2026.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
