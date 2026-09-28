// Telefone dos anúncios.
//
// Por que módulo separado: a lógica de telefoner é onde mora a armadilha do
// +55 (medir o comprimento antes de tirar o prefixo classifica celular como
// fixo), e `coleta.mjs` não é importável — roda `main()` no load. Separado, dá
// pra testar sem browser. O resto do coletor continua sem teste, como sempre.
//
// Duas fontes, dois formatos (verificados contra a API e o DOM em 27/09/2026):
//   Zap/VivaReal  "tel:+5541996990773" (celular) · "tel:+554131213565" (fixo)
//   Apolar        "(41)99121-0624" (celular) · "(41) 3542 - 1322" (fixo)
//
// Telefone do PORTAL não é de pessoa: é da imobiliária anunciante. No Apolar o
// mesmo celular aparece em todos os anúncios de uma loja (`loja` no payload).

/**
 * Lê os `href` de `a[href^="tel:"]` e classifica em celular/fixo.
 *
 * REGRA DO +55: o `tel:` do Zap já vem com o prefixo, então
 *   "+5541996990773" -> 13 dígitos, e 13-2(55) = 11 depois do DDD
 *   "+554131213565"  -> 12 dígitos, e 12-2(55) = 10 depois do DDD
 * Se você medir o comprimento ANTES de tirar o 55, celular e fixo trocam de
 * lugar e o WhatsApp sai errado. Por isso o `local()` vem antes do `length`.
 *
 * Fonte única e não regex solta sobre o texto: o id do anúncio no Zap é
 * "2913835418" e casa com qualquer regex de telefone. Só `a[href^="tel:"]` é
 * confiável, e isso é garantido pelo chamador, não aqui.
 */
export function telefonesDeHrefs(hrefs) {
  const vazio = { phone: "", celular: "", fixo: "" };
  const digitos = (hrefs || [])
    .map((h) => String(h).replace(/^tel:/i, "").replace(/\D/g, ""))
    // 12 = fixo com 55, 13 = celular com 55. Qualquer outra coisa é lixo.
    .filter((d) => d.length === 12 || d.length === 13);
  const local = (d) => d.replace(/^55/, "");
  // `local` = DDD(2) + número. O nono dígito do celular é o índice 2, NÃO o 0 —
  // o índice 0 é o primeiro dígito do DDD, e todo celular brasileiro tem DDD
  // começando com 2 a 9, então testar o 0 classificaria todo fixo como celular.
  const celular = digitos.find((d) => local(d).length === 11 && local(d)[2] === "9");
  const fixo = digitos.find((d) => local(d).length === 10);
  if (!celular && !fixo) return vazio;
  return { phone: `+${celular ?? fixo}`, celular: celular ? `+${celular}` : "", fixo: fixo ? `+${fixo}` : "" };
}

/**
 * Telefone do Apolar para o mesmo formato canônico.
 *
 * A API devolve NACIONAL, sem o 55: "(41)99121-0624" -> 41991210624 (11).
 * Sem prefixar, `buildWhatsAppLink` cai no fallback e o botão fica sem número.
 * Aceita os dois comprimentos porque a API pode mudar entre chamadas.
 */
export function telApolar(bruto) {
  const d = String(bruto ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if (d.length === 12 || d.length === 13) return `+${d}`;
  return "";
}

/** Textos de botão que liberam o número. Variam por anúncio e por portal. */
export const BOTOES_TELEFONE = ['button:has-text("mostrar telefone")', 'button:has-text("WhatsApp")'];

/**
 * Clica no botão e lê o que o portal publica. Thin shell de DOM: toda a lógica
 * está em `telefonesDeHrefs`.
 *
 * Clicar "mostrar telefone" REGISTRA LEAD no painel do anunciante. Por isso o
 * chamador tem que fazer isso depois de todos os filtros — nunca pedir o número
 * de um imóvel que vai ser descartado.
 *
 * `null` = não publicado / botão ausente / clique falhou. Nunca lança: uma leva
 * não pode morrer porque um anúncio está expirado.
 */
export async function extrairTelefone(page, { espera = 10000, clique = 8000 } = {}) {
  const btn = page.locator(BOTOES_TELEFONE.join(", ")).first();
  if ((await btn.count()) === 0) return null;
  try {
    await btn.click({ timeout: clique });
  } catch {
    return null; // expirado, bloqueado, ou já clicado
  }
  await page
    .locator('a[href^="tel:"]')
    .first()
    .waitFor({ timeout: espera })
    .catch(() => {});
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute("href") || ""),
  );
  const t = telefonesDeHrefs(hrefs);
  return t.phone ? t : null;
}
