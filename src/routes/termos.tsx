import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LandingLayout } from "../components/landing/LandingLayout";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — A8 Avalia" },
      {
        name: "description",
        content:
          "Termos de Uso da A8 Avalia. Condições de acesso e utilização da plataforma.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <LandingLayout>
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-[600px] mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl text-[#0F2D5C] mb-10 text-center">
            Termos de Uso
          </h1>

          <p className="text-[#666666] leading-relaxed mb-10 text-center">
            Ao utilizar a plataforma A8 Avalia, o usuário
            concorda com os seguintes termos:
          </p>

          <div className="space-y-8 text-[#666666] leading-relaxed">
            <section>
              <h2 className="font-display text-lg text-[#0F2D5C] mb-2">
                1. Uso da Plataforma
              </h2>
              <p>
                O acesso é destinado exclusivamente a profissionais habilitados
                do mercado imobiliário, como corretores, avaliadores, arquitetos
                e engenheiros.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-[#0F2D5C] mb-2">
                2. Laudos Gerados
              </h2>
              <p>
                Os laudos produzidos pela plataforma são de natureza
                mercadológica e informativa. Não substituem laudos técnicos
                oficiais assinados por profissional habilitado perante{" "}
                <span className="text-[#C8A951] font-medium">CNAI</span>,{" "}
                <span className="text-[#C8A951] font-medium">IBAPE</span>,{" "}
                <span className="text-[#C8A951] font-medium">CAU</span> ou{" "}
                <span className="text-[#C8A951] font-medium">CREA</span>.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-[#0F2D5C] mb-2">
                3. Responsabilidade
              </h2>
              <p>
                O usuário é responsável pela veracidade dos dados inseridos na
                plataforma. A A8 Avalia não se
                responsabiliza por avaliações baseadas em informações
                incorretas fornecidas pelo usuário.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-[#0F2D5C] mb-2">
                4. Assinatura e Pagamento
              </h2>
              <p>
                Os planos são cobrados mensalmente via{" "}
                <span className="text-[#C8A951] font-medium">Stripe</span>. O
                cancelamento pode ser realizado a qualquer momento, sem multa,
                com efeito no próximo ciclo de cobrança.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-[#0F2D5C] mb-2">
                5. Propriedade Intelectual
              </h2>
              <p>
                A plataforma, sua identidade visual e tecnologia são de
                propriedade exclusiva da A8 Avalia,
                protegidos pela legislação brasileira.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-[#0F2D5C] mb-2">
                6. Alterações
              </h2>
              <p>
                Estes termos podem ser atualizados a qualquer momento. O uso
                continuado da plataforma implica aceite dos termos vigentes.
              </p>
            </section>
          </div>

          <p className="mt-10 text-[#666666] text-center">
            Dúvidas:{" "}
            <a
              href="mailto:contato@a8investimentos.com.br"
              className="text-[#0F2D5C] underline hover:text-[#C8A951] transition-colors"
            >
              contato@a8investimentos.com.br
            </a>
          </p>

          <div className="mt-14 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-[#C8A951] text-[#0A1F44] font-semibold text-sm px-6 py-3 rounded-md hover:bg-[#E2C97E] transition-all"
            >
              <ArrowLeft size={16} />
              Voltar ao início
            </Link>
          </div>
        </div>
      </main>
    </LandingLayout>
  );
}
