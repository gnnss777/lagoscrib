import type { Metadata } from "next";
import { PRIVACY_POLICY_VERSION, PRIVACY_CONTACT_EMAIL } from "@/lib/privacy";
import { APP_PROFILES, resolveAppProfile } from "@/lib/constants";

// Mesmo app, dois clientes: o texto legal é o do perfil do build (nome e
// contato do encarregado). O conteúdo das cláusulas não muda — a lei é a mesma
// para os dois; só a identidade citada é a de quem está pagando o deploy.
const identidade = APP_PROFILES[resolveAppProfile(process.env)];

export const metadata: Metadata = {
  // `absolute`: a página nomeia o app por perfil e não quer o template do
  // layout somando o nome de novo no fim do título.
  title: { absolute: `Política de Privacidade — ${identidade.appName}` },
  description: "Como tratamos seus dados pessoais (LGPD — Lei nº 13.709/2018)",
  robots: { index: false, follow: false },
};

export default function PrivacidadePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">Política de Privacidade</h1>
      <p className="text-sm opacity-70 mb-8">
        Versão {PRIVACY_POLICY_VERSION} — em conformidade com a LGPD (Lei nº 13.709/2018).
        Este documento descreve o tratamento de dados no {identidade.appName}.
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
            art. 7º, V). Contatos de corretores/imobiliárias exibidos nos anúncios são dados
            tornados públicos nos portais de origem, e o telefone fica visível no app assim que
            o anúncio o publica — não há janela de horário comercial para contato de
            imobiliária. O botão de WhatsApp usa o celular quando o anúncio o divulga, senão cai
            para o link ao anúncio original. O link do anúncio é sempre a via preferida
            (legítimo interesse + minimização, art. 7º, IX). Ver{" "}
            <code>docs/ADR-004-telefone-coleta.md</code> para a regra de coleta.
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
