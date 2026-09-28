/**
 * Validação de telefone da coleta. Função pura, sem env e sem horário.
 *
 * Antes este arquivo era `phone-gate.ts` e tinha também `isBusinessHours` +
 * `maskPhone`, que escondiam o telefone fora de horário comercial. Isso foi
 * removido de propósito: o telefone é de contato PROFISSIONAL de imobiliária,
 * já público no anúncio de origem, e o app não tem gate de leitura
 * (os componentes leem `apartment.phone` direto do `lib/data.ts`, sem passar
 * por API). Manter a janela horária dava a falsa impressão de que o número
 * estava protegido. Ver `docs/ADR-004-telefone-coleta.md` e `app/privacidade`.
 */

/**
 * Telefone brasileiro em E.164, ou string vazia = não publicado.
 *
 * O coletor entrega dois formatos e só um passa:
 *   Zap/VivaReal  "+5541996990773" (celular) · "+554131213565" (fixo)
 *   Apolar        idem, depois de prefixar o 55 que a API não devolve
 *
 * Por que check de formato e não regex genérica: o id do anúncio no Zap é
 * "2913835418" e casa com qualquer regex de telefone solta. A armadilha real é
 * o coletor gravar lixo no lugar do número, e isso se pega por formato.
 *
 * Celular = 11 dígitos depois do +55, com DDD de 2 e nono dígito = 9.
 * Fixo    = 10 dígitos depois do +55.
 */
export function ehTelefoneValido(phone: string | undefined | null): boolean {
  if (!phone) return false;
  if (!/^\+55\d{10,11}$/.test(phone)) return false;
  const n = phone.slice(3); // tira "+55"
  if (n.length === 11) return n[2] === "9";
  return n[2] !== "9";
}
