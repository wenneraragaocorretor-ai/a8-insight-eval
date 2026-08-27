import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LandingLayout } from "../components/landing/LandingLayout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — A8 Avalia" },
      {
        name: "description",
        content: "Política de Privacidade da A8 Avalia. Conformidade com a LGPD.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <LandingLayout>
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-[600px] mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl text-[#0F2D5C] mb-8 text-center">
            Política de Privacidade
          </h1>

          <div className="space-y-6 text-[#666666] leading-relaxed text-center">
            <p>
              A A8 Avalia coleta e trata dados pessoais em conformidade com a Lei Geral de Proteção
              de Dados (LGPD — Lei nº 13.709/2018).
            </p>
            <p>
              Suas informações são utilizadas exclusivamente para o funcionamento da plataforma e
              nunca são vendidas a terceiros.
            </p>
            <p>
              Para dúvidas ou solicitações sobre seus dados, entre em contato:{" "}
              <a
                href="mailto:contato@a8investimentos.com.br"
                className="text-[#0F2D5C] underline hover:text-[#C8A951] transition-colors"
              >
                contato@a8investimentos.com.br
              </a>
            </p>
          </div>

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
