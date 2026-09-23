import type { Metadata } from "next";
import { PRIVACY_POLICY_VERSION, PRIVACY_CONTACT_EMAIL } from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Política de Privacidade — lagoscrib",
  description: "Como tratamos seus dados pessoais (LGPD — Lei nº 13.709/2018)",
  robots: { index: false, follow: false },
};

export default function PrivacidadePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">Política de Privacidade</h1>
      <p className="text-sm opacity-70 mb-8">
        Versão {PRIVACY_POLICY_VERSION} — em conformidade com a LGPD (Lei nº 13.709/2018).
      </p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="font-semibold mb-1">1. Quais dados coletamos</h2>
          <p>
            Conta: nome, e-mail e senha (armazenada apenas como hash bcrypt, nunca em texto).
            Uso do app: imóveis salvos, status de prospecção, follow-ups de retorno do corretor
            e notas — sempre vinculados à sua conta.
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">2. Finalidade e base legal</h2>
          <p>
            Operar sua conta e sincronizar seus dados entre dispositivos (execução de contrato,
            art. 7º, V). Contatos de corretores/anunciantes exibidos na central agregadora são
            dados tornados públicos nos anúncios de origem — exibimos o telefone somente em
            horário comercial e, fora dele, apenas o link ao anúncio original (legítimo
            interesse + minimização, art. 7º, IX).
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">3. Seus direitos</h2>
          <p>
            Acesso e portabilidade (exportação dos seus dados em JSON), correção e eliminação
            (anonimização da conta, mediante confirmação de senha), e revogação de consentimento
            — tudo exercível no app, na seção Minha Conta. Contato do encarregado:{" "}
            {PRIVACY_CONTACT_EMAIL}.
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">4. Segurança e retenção</h2>
          <p>
            Senhas com bcrypt, sessões em cookie httpOnly, rate limit contra abuso, logs sem
            dados pessoais e purga automática de tokens expirados. Mantemos seus dados apenas
            enquanto a conta existir; a eliminação remove tudo do titular.
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">5. Remoção de anúncios</h2>
          <p>
            Anunciantes podem solicitar a remoção de seus dados da central agregadora pelo
            canal de remoção — cada pedido é triado e auditado.
          </p>
        </div>
      </section>
    </main>
  );
}
